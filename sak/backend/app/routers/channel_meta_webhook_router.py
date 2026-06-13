"""Direct Meta webhook endpoint for the channels module."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from agente.v3.runtime import process_pending_once as process_pending_once_v3
from agente.v3.runtime_registry import get_v3_runtime
from agente.v3.runtime_registry import normalize_queue_name as normalize_v3_queue_name
from app.db import engine, get_session
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.providers.meta.webhook import raw_meta_to_channel_payloads
from app.modules.channels.types import ChannelEventData
from app.modules.channels.v3.meta_channel import default_meta_channel, persist_received_channel_events
from app.schemas.channel_webhook import ChannelWebhookResponse
from app.schemas.channel_webhook import ChannelWebhookPayload
from app.services.agent_queue_state import DEFAULT_QUEUE_NAME, normalize_queue_name as normalize_v2_queue_name
from app.services.channel_event_queue_worker import enqueue_channel_event
from app.services.agent_pending_processor import process_pending_agent_messages
from app.services.meta_webhook_service import MetaWebhookService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channel-webhooks/meta", tags=["channel-webhooks"])


def _record_inbound_channel_event(
    session: Session,
    normalized_payload: dict[str, Any],
) -> int:
    channel_payload = ChannelWebhookPayload(**normalized_payload)
    msg = channel_payload.mensaje
    row = channel_event_store.record(
        session,
        ChannelEventData(
            provider="meta",
            channel_type="whatsapp",
            account_ref=str(msg.celular.id),
            direction="inbound",
            from_address=msg.from_phone,
            to_address=msg.to_phone,
            external_message_id=msg.meta_message_id,
            status=msg.status,
            occurred_at=MetaWebhookService._normalize_timestamp_to_utc(msg.meta_timestamp),
            raw_payload=normalized_payload,
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
    *,
    enqueue_only: bool = False,
    queue_name: str = DEFAULT_QUEUE_NAME,
    enqueue_message_callback: Callable[[int], None] | None = None,
) -> list[dict[str, Any]]:
    t0 = time.perf_counter()
    normalized_payloads = raw_meta_to_channel_payloads(session, payload)
    t_normalized = time.perf_counter()
    service = MetaWebhookService(session)
    t_service = time.perf_counter()
    results: list[dict[str, Any]] = []
    for normalized_payload in normalized_payloads:
        t_item = time.perf_counter()
        if enqueue_only:
            channel_event_id = _record_inbound_channel_event(session, normalized_payload)
            enqueue_channel_event(channel_event_id)
            result = {
                "status": "ok",
                "message": "Evento de canal encolado",
                "channel_event_id": channel_event_id,
            }
        else:
            result = await service.process_webhook(
                normalized_payload,
                enqueue_only=enqueue_only,
                queue_name=queue_name,
                enqueue_message_callback=enqueue_message_callback,
            )
        results.append(result)
        logger.info(
            "Channel webhook item timing event_type=%s process_webhook=%sms",
            normalized_payload.get("event_type"),
            round((time.perf_counter() - t_item) * 1000),
        )
    logger.info(
        "Channel webhook raw timing normalized_count=%s normalize=%sms service_init=%sms total=%sms",
        len(normalized_payloads),
        round((t_normalized - t0) * 1000),
        round((t_service - t_normalized) * 1000),
        round((time.perf_counter() - t0) * 1000),
    )
    return results


async def _process_raw_meta_background(payload: dict[str, Any], *, queue_name: str = DEFAULT_QUEUE_NAME) -> None:
    with Session(engine) as session:
        try:
            await process_raw_meta_webhook_payload(session, payload, queue_name=queue_name)
        except Exception:
            session.rollback()
            logger.exception("Error procesando webhook directo de Meta")


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

    try:
        queue_name = normalize_v2_queue_name(queue or DEFAULT_QUEUE_NAME)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    background_tasks.add_task(_process_raw_meta_background, payload, queue_name=queue_name)
    return ChannelWebhookResponse(status="ok", message="Recibido")


def _require_internal_token(session: Session, token: str | None) -> None:
    expected_token = meta_account_resolver.resolve_internal_token(session)
    if not expected_token or token != expected_token:
        raise HTTPException(status_code=403, detail="Token interno invalido")


@router.post("/process-pending")
async def process_pending_meta_messages(
    limit: int = Query(default=10, ge=1, le=50),
    message_id: int | None = Query(default=None),
    x_channel_token: str | None = Header(default=None, alias="X-Channel-Token"),
    session: Session = Depends(get_session),
):
    _require_internal_token(session, x_channel_token)
    return await process_pending_agent_messages(
        session,
        limit=limit,
        message_id=message_id,
        source="manual_retry" if message_id is not None else "pending_retry",
    )
