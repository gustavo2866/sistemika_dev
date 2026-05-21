"""Procesador de mensajes entrantes que quedaron pendientes del agente."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

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


def _skip_reason(message: CRMMensaje, *, stale_after_seconds: int) -> str | None:
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

    if isinstance(agent_meta.get("result"), dict):
        return "already_processed"
    if agent_meta.get("delivery_processed_at"):
        return "already_delivered"

    processing = metadata.get(PROCESSING_KEY)
    if isinstance(processing, dict):
        started_at = _parse_iso_datetime(processing.get("started_at"))
        if started_at and current_utc_time() - started_at < timedelta(seconds=stale_after_seconds):
            return "in_progress"

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
    limit: int,
    message_id: int | None = None,
) -> list[CRMMensaje]:
    if message_id is not None:
        message = session.get(CRMMensaje, message_id)
        return [message] if message is not None else []

    fecha_ref = func.coalesce(CRMMensaje.fecha_mensaje, CRMMensaje.created_at)
    rows = list(
        session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.canal == CanalMensaje.WHATSAPP.value)
            .where(CRMMensaje.origen_externo_id.is_not(None))
            .where(CRMMensaje.oportunidad_id.is_not(None))
            .order_by(fecha_ref.desc(), CRMMensaje.id.desc())
            .limit(max(limit * 20, 100))
        ).all()
    )
    return list(reversed(rows))


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
    Reprocesa mensajes entrantes persistidos que no llegaron a ejecutar el agente.

    El buffer real es `crm_mensajes`: si el webhook alcanzo a guardar el inbound,
    este proceso puede recuperar el turno sin depender del background task original.
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

    for message in _load_candidate_messages(session, limit=limit, message_id=message_id):
        if message_id is None and processed_count >= limit:
            break

        reason = _skip_reason(message, stale_after_seconds=stale_after_seconds)
        if reason is not None:
            summary["skipped"].append({"message_id": message.id, "reason": reason})
            continue

        try:
            _set_processing_marker(session, message, source=source)
            result = await resolved_service.process_existing_inbound_message(
                message,
                trigger=source,
                schedule_typing=False,
            )
            session.refresh(message)
            _clear_processing_marker(session, message)
            processed_count += 1
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

    return summary
