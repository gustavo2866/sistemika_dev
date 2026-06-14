"""Direct Meta webhook endpoint for the channels module."""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from agente.v3.runtime import process_pending_once as process_pending_once_v3
from agente.v3.runtime_registry import get_v3_runtime
from agente.v3.runtime_registry import normalize_queue_name as normalize_v3_queue_name
from app.db import get_session
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.providers.meta.webhook import raw_meta_to_channel_payloads
from app.modules.channels.types import ChannelEventData
from app.modules.channels.v3.meta_channel import default_meta_channel, persist_received_channel_events
from app.schemas.channel_webhook import ChannelWebhookResponse
from app.schemas.channel_webhook import ChannelWebhookPayload
from app.services.agent_queue_state import DEFAULT_QUEUE_NAME

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channel-webhooks/meta", tags=["channel-webhooks"])


def _normalize_timestamp_to_utc(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        raw = str(value or "").strip()
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = datetime.fromtimestamp(int(raw), UTC)
            except (TypeError, ValueError, OSError):
                return datetime.now(UTC)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _record_channel_event(
    session: Session,
    normalized_payload: dict[str, Any],
) -> int:
    channel_payload = ChannelWebhookPayload(**normalized_payload)
    msg = channel_payload.mensaje
    direction = "inbound" if msg.direccion == "in" else "outbound"
    row = channel_event_store.record(
        session,
        ChannelEventData(
            provider="meta",
            channel_type="whatsapp",
            account_ref=str(msg.celular.id),
            direction=direction,
            from_address=msg.from_phone,
            to_address=msg.to_phone,
            external_message_id=msg.meta_message_id,
            external_event_id=str(msg.id),
            status=msg.status,
            occurred_at=_normalize_timestamp_to_utc(msg.meta_timestamp),
            raw_payload=normalized_payload.get("raw_meta_payload") or normalized_payload,
            normalized_payload=normalized_payload,
        ),
    )
    session.commit()
    if row.id is None:
        raise RuntimeError("No se pudo persistir channel_event")
    return int(row.id)


@router.get("/", response_class=PlainTextResponse)
async def verify_meta_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
    session: Session = Depends(get_session),
):
    expected_token = meta_account_resolver.resolve_webhook_verify_token(session)
    if hub_mode == "subscribe" and expected_token and hub_verify_token == expected_token:
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Token de verificacion invalido")


async def process_raw_meta_webhook_payload(
    session: Session,
    payload: dict[str, Any],
) -> list[dict[str, Any]]:
    t0 = time.perf_counter()
    normalized_payloads = raw_meta_to_channel_payloads(session, payload)
    t_normalized = time.perf_counter()
    results: list[dict[str, Any]] = []
    for normalized_payload in normalized_payloads:
        t_item = time.perf_counter()
        channel_event_id = _record_channel_event(session, normalized_payload)
        result = {
            "status": "ok",
            "message": "Evento de canal registrado",
            "event_type": normalized_payload.get("event_type"),
            "channel_event_id": channel_event_id,
        }
        results.append(result)
        logger.info(
            "Channel webhook item timing event_type=%s record_event=%sms",
            normalized_payload.get("event_type"),
            round((time.perf_counter() - t_item) * 1000),
        )
    logger.info(
        "Channel webhook raw timing normalized_count=%s normalize=%sms total=%sms",
        len(normalized_payloads),
        round((t_normalized - t0) * 1000),
        round((time.perf_counter() - t0) * 1000),
    )
    return results


def _has_inbound_messages(payload: dict[str, Any]) -> bool:
    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            if value.get("messages"):
                return True
    return False


def _resolve_v3_public_queue(queue: str | None) -> str:
    value = str(queue or "").strip().lower()
    if value in {"", DEFAULT_QUEUE_NAME}:
        value = None
    try:
        return normalize_v3_queue_name(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="queue invalida: solo se permite 'smoke'") from exc


@router.post("/", response_model=ChannelWebhookResponse)
async def receive_meta_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    queue: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    t0 = time.perf_counter()
    payload = await request.json()
    t_json = time.perf_counter()

    if _has_inbound_messages(payload):
        queue_name = _resolve_v3_public_queue(queue)
        runtime = get_v3_runtime(queue_name)
        try:
            result = await default_meta_channel.receive(
                payload,
                inbox=runtime.inbox,
                queue_name=queue_name,
                after_enqueue=lambda messages: (
                    background_tasks.add_task(process_pending_once_v3, limit=len(messages), queue=queue_name),
                    background_tasks.add_task(persist_received_channel_events, list(messages)),
                ),
            )
            t_receive = time.perf_counter()
            logger.info(
                "v3_public_webhook_timing queue=%s received_count=%s json_ms=%s receive_enqueue_ms=%s total_ms=%s",
                queue_name,
                result.get("received_count"),
                round((t_json - t0) * 1000, 3),
                round((t_receive - t_json) * 1000, 3),
                round((t_receive - t0) * 1000, 3),
            )
        except Exception:
            session.rollback()
            logger.exception("Error derivando webhook directo de Meta a agente v3")
            return ChannelWebhookResponse(status="ok", message="Recibido con error")
        return ChannelWebhookResponse(status="ok", message="Encolado v3")

    if queue:
        _resolve_v3_public_queue(queue)
    try:
        await process_raw_meta_webhook_payload(session, payload)
    except Exception:
        session.rollback()
        logger.exception("Error registrando webhook directo de Meta")
    return ChannelWebhookResponse(status="ok", message="Recibido")
