"""Direct Meta webhook endpoint for the channels module."""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from app.db import engine, get_session
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.providers.meta.webhook import raw_meta_to_channel_payloads
from app.schemas.channel_webhook import ChannelWebhookResponse
from app.services.agent_queue_state import DEFAULT_QUEUE_NAME, normalize_queue_name
from app.services.agent_queue_worker import enqueue_agent_message
from app.services.agent_pending_processor import process_pending_agent_messages
from app.services.meta_webhook_service import MetaWebhookService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channel-webhooks/meta", tags=["channel-webhooks"])


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
) -> list[dict[str, Any]]:
    t0 = time.perf_counter()
    normalized_payloads = raw_meta_to_channel_payloads(session, payload)
    t_normalized = time.perf_counter()
    service = MetaWebhookService(session)
    t_service = time.perf_counter()
    results: list[dict[str, Any]] = []
    for normalized_payload in normalized_payloads:
        t_item = time.perf_counter()
        result = await service.process_webhook(
            normalized_payload,
            enqueue_only=enqueue_only,
            queue_name=queue_name,
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


@router.post("/", response_model=ChannelWebhookResponse)
async def receive_meta_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    queue: str = Query(default=DEFAULT_QUEUE_NAME),
    session: Session = Depends(get_session),
):
    payload = await request.json()
    try:
        queue_name = normalize_queue_name(queue)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if _has_inbound_messages(payload):
        try:
            results = await process_raw_meta_webhook_payload(
                session,
                payload,
                enqueue_only=True,
                queue_name=queue_name,
            )
        except Exception:
            session.rollback()
            logger.exception("Error procesando webhook directo de Meta")
            return ChannelWebhookResponse(status="ok", message="Recibido con error")
        for result in results:
            message_id = result.get("mensaje_id")
            if message_id is not None:
                enqueue_agent_message(int(message_id))
        return ChannelWebhookResponse(status="ok", message="Encolado")

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
