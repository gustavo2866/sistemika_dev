"""Procesador de mensajes entrantes que quedaron pendientes del agente."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from agente.v2.core.delivery import TurnDeliveryService
from agente.v2.core.runtime import should_auto_process
from app.models import CRMMensaje
from app.models.base import current_utc_time
from app.models.enums import CanalMensaje, TipoMensaje
from app.services.meta_webhook_service import MetaWebhookService

logger = logging.getLogger(__name__)

PROCESSING_KEY = "agent_v2_processing"
LAST_ERROR_KEY = "agent_v2_last_error"
LAST_RETRY_KEY = "agent_v2_last_retry_at"
RETRY_ATTEMPTS_KEY = "agent_v2_retry_attempts"


def _parse_iso_datetime(raw_value: Any) -> datetime | None:
    if not raw_value:
        return None
    try:
        parsed = datetime.fromisoformat(str(raw_value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _skip_reason(
    message: CRMMensaje,
    *,
    stale_after_seconds: int,
    allow_delivery_backoff_bypass: bool,
) -> str | None:
    if message.deleted_at is not None:
        return "deleted"
    if message.tipo != TipoMensaje.ENTRADA.value:
        return "not_inbound"
    if message.canal != CanalMensaje.WHATSAPP.value:
        return "not_whatsapp"
    if not message.origen_externo_id:
        return "missing_external_id"
    if not message.oportunidad_id:
        return "missing_oportunidad"

    metadata = dict(message.metadata_json or {})
    agent_meta = dict(metadata.get("agent_v2") or {})

    if agent_meta.get("delivery_processed_at"):
        return "already_delivered"
    if TurnDeliveryService.has_recent_pending_delivery(message):
        return "delivery_in_progress"
    if (
        not allow_delivery_backoff_bypass
        and TurnDeliveryService.has_recent_delivery_attempt(message)
    ):
        return "delivery_backoff"

    return None


def _set_processing_marker(session: Session, message: CRMMensaje, *, source: str) -> None:
    metadata = dict(message.metadata_json or {})
    attempt = int(metadata.get(RETRY_ATTEMPTS_KEY) or 0) + 1
    metadata[RETRY_ATTEMPTS_KEY] = attempt
    metadata[PROCESSING_KEY] = {
        "source": source,
        "attempt": attempt,
        "started_at": current_utc_time().isoformat(),
    }
    message.metadata_json = metadata
    session.add(message)
    session.commit()
    session.refresh(message)


def _clear_processing_marker(session: Session, message: CRMMensaje) -> None:
    metadata = dict(message.metadata_json or {})
    metadata.pop(PROCESSING_KEY, None)
    metadata[LAST_RETRY_KEY] = current_utc_time().isoformat()
    message.metadata_json = metadata
    session.add(message)
    session.commit()
    session.refresh(message)


def _record_processing_error(session: Session, message_id: int, exc: Exception, *, source: str) -> None:
    message = session.get(CRMMensaje, message_id)
    if not message:
        return
    metadata = dict(message.metadata_json or {})
    metadata.pop(PROCESSING_KEY, None)
    metadata[LAST_ERROR_KEY] = {
        "source": source,
        "message": str(exc),
        "at": current_utc_time().isoformat(),
    }
    metadata[LAST_RETRY_KEY] = current_utc_time().isoformat()
    message.metadata_json = metadata
    session.add(message)
    session.commit()


def _load_candidate_messages(
    session: Session,
    *,
    message_id: int | None = None,
) -> list[CRMMensaje]:
    fecha_ref = func.coalesce(CRMMensaje.fecha_mensaje, CRMMensaje.created_at)
    return list(
        session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.canal == CanalMensaje.WHATSAPP.value)
            .where(CRMMensaje.origen_externo_id.is_not(None))
            .where(CRMMensaje.oportunidad_id.is_not(None))
            .order_by(fecha_ref.asc(), CRMMensaje.id.asc())
        ).all()
    )


def _load_queue_heads(
    session: Session,
    *,
    message_id: int | None = None,
) -> list[CRMMensaje]:
    """Devuelve como maximo el primer mensaje pendiente de cada oportunidad."""
    heads: dict[int, CRMMensaje] = {}
    for message in _load_candidate_messages(session):
        oportunidad_id = int(message.oportunidad_id or 0)
        if not oportunidad_id or oportunidad_id in heads:
            continue
        if _skip_reason(
            message,
            stale_after_seconds=0,
            allow_delivery_backoff_bypass=False,
        ) == "already_delivered":
            continue
        heads[oportunidad_id] = message
    rows = list(heads.values())
    if message_id is not None:
        rows = [message for message in rows if message.id == message_id]
    return rows


async def process_pending_agent_messages(
    session: Session,
    *,
    limit: int = 10,
    message_id: int | None = None,
    source: str = "pending_retry",
    stale_after_seconds: int = 300,
    service: MetaWebhookService | None = None,
) -> dict[str, Any]:
    """
    Reprocesa mensajes entrantes persistidos cuyo turno o delivery quedo pendiente.

    El buffer real es `crm_mensajes`: si el webhook alcanzo a guardar el inbound,
    este proceso puede recuperar el turno sin depender del background task original.
    Si el resultado del agente ya existe, se reutiliza sin volver a llamar al LLM.
    """
    summary: dict[str, Any] = {
        "status": "ok",
        "mode": "automatic" if should_auto_process(session=session) else "manual",
        "processed": [],
        "skipped": [],
        "errors": [],
    }
    if summary["mode"] != "automatic":
        return summary

    resolved_service = service or MetaWebhookService(session)
    processed_count = 0

    visited_message_ids: set[int] = set()
    while processed_count < limit:
        messages = [
            message
            for message in _load_queue_heads(session, message_id=message_id)
            if int(message.id) not in visited_message_ids
        ]
        if not messages:
            break
        made_progress = False

        for message in messages:
            if processed_count >= limit:
                break
            visited_message_ids.add(int(message.id))
            reason = _skip_reason(
                message,
                stale_after_seconds=stale_after_seconds,
                allow_delivery_backoff_bypass=source == "manual_retry",
            )
            if reason is not None:
                summary["skipped"].append({"message_id": message.id, "reason": reason})
                continue

            try:
                result = await resolved_service.process_existing_inbound_message(
                    message,
                    trigger=source,
                    schedule_typing=False,
                )
                session.refresh(message)
                if (message.metadata_json or {}).get(PROCESSING_KEY):
                    _clear_processing_marker(session, message)
                if isinstance(result, dict) and result.get("retryable"):
                    summary["skipped"].append(
                        {
                            "message_id": message.id,
                            "reason": str(result.get("type") or "retryable"),
                        }
                    )
                    continue
                processed_count += 1
                made_progress = True
                summary["processed"].append(
                    {
                        "message_id": message.id,
                        "result_type": result.get("type") if isinstance(result, dict) else None,
                    }
                )
            except Exception as exc:
                logger.exception("Error reprocesando mensaje pendiente id=%s", message.id)
                session.rollback()
                _record_processing_error(session, int(message.id), exc, source=source)
                summary["errors"].append({"message_id": message.id, "error": str(exc)})
        if not made_progress:
            break

    return summary
