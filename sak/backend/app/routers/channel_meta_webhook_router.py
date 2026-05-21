"""Direct Meta webhook endpoint for the channels module."""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from app.db import engine, get_session
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.providers.meta.webhook import raw_meta_to_metaw_payloads
from app.schemas.meta_webhook import WebhookResponse
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


async def process_raw_meta_webhook_payload(session: Session, payload: dict[str, Any]) -> None:
    t0 = time.perf_counter()
    normalized_payloads = raw_meta_to_metaw_payloads(session, payload)
    t_normalized = time.perf_counter()
    service = MetaWebhookService(session)
    t_service = time.perf_counter()
    for normalized_payload in normalized_payloads:
        t_item = time.perf_counter()
        await service.process_webhook(normalized_payload)
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


async def _process_raw_meta_background(payload: dict[str, Any]) -> None:
    with Session(engine) as session:
        try:
            await process_raw_meta_webhook_payload(session, payload)
        except Exception:
            session.rollback()
            logger.exception("Error procesando webhook directo de Meta")
        try:
            await process_pending_agent_messages(session, limit=5)
        except Exception:
            session.rollback()
            logger.exception("Error reprocesando mensajes pendientes de agente")


@router.post("/", response_model=WebhookResponse)
async def receive_meta_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    payload = await request.json()
    background_tasks.add_task(_process_raw_meta_background, payload)
    return WebhookResponse(status="ok", message="Recibido")


def _require_internal_token(session: Session, token: str | None) -> None:
    expected_token = os.getenv("CHANNELS_INTERNAL_TOKEN")
    if not expected_token:
        expected_token = meta_account_resolver.resolve_webhook_verify_token(session)
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
