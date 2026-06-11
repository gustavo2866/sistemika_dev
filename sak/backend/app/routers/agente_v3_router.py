"""Endpoints experimentales del agente v3."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from agente.v3.inbox import default_inbox
from agente.v3.orchestrator import default_context_store
from agente.v3.outbox import default_outbox
from agente.v3.runtime import process_pending_once
from app.db import get_session
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.v3.meta_channel import default_meta_channel, persist_received_channel_events

router = APIRouter(prefix="/agente/v3", tags=["agente-v3"])


@router.get("/channel/meta", response_class=PlainTextResponse)
async def verify_meta_webhook_v3(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
    session: Session = Depends(get_session),
):
    expected_token = meta_account_resolver.resolve_webhook_verify_token(session)
    if hub_mode == "subscribe" and expected_token and hub_verify_token == expected_token:
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Token de verificacion invalido")


@router.post("/channel/meta")
async def receive_meta_webhook_v3(
    request: Request,
    background_tasks: BackgroundTasks,
):
    payload = await request.json()
    return await default_meta_channel.receive(
        payload,
        after_enqueue=lambda messages: (
            background_tasks.add_task(process_pending_once, limit=len(messages)),
            background_tasks.add_task(persist_received_channel_events, list(messages)),
        ),
    )


@router.get("/inbox/status")
async def inbox_status_v3():
    return await default_inbox.snapshot()


@router.post("/inbox/process")
async def process_inbox_v3(limit: int = Query(default=10, ge=1, le=100)):
    return await default_inbox.process_pending(limit=limit)


@router.get("/outbox/status")
async def outbox_status_v3():
    return await default_outbox.snapshot()


@router.post("/outbox/process")
async def process_outbox_v3(limit: int = Query(default=10, ge=1, le=100)):
    return await default_outbox.process_pending(limit=limit)


@router.get("/context/status")
async def context_status_v3():
    return await default_context_store.snapshot()


@router.post("/inbox/reset")
async def reset_inbox_v3():
    await default_outbox.reset()
    await default_context_store.reset()
    return await default_inbox.reset()
