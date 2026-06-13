"""Endpoints experimentales del agente v3."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from agente.v3.runtime import process_pending_once
from agente.v3.runtime_registry import get_v3_runtime, normalize_queue_name
from app.db import get_session
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.v3.meta_channel import default_meta_channel, persist_received_channel_events

router = APIRouter(prefix="/agente/v3", tags=["agente-v3"])


def _resolve_queue(queue: str | None) -> str:
    try:
        return normalize_queue_name(queue)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="queue invalida: solo se permite 'smoke'") from exc


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
    queue: str | None = Query(default=None),
):
    queue_name = _resolve_queue(queue)
    runtime = get_v3_runtime(queue_name)
    payload = await request.json()
    return await default_meta_channel.receive(
        payload,
        inbox=runtime.inbox,
        queue_name=queue_name,
        after_enqueue=lambda messages: (
            background_tasks.add_task(process_pending_once, limit=len(messages), queue=queue_name),
            background_tasks.add_task(persist_received_channel_events, list(messages)),
        ),
    )


@router.get("/inbox/status")
async def inbox_status_v3(queue: str | None = Query(default=None)):
    runtime = get_v3_runtime(_resolve_queue(queue))
    snapshot = await runtime.inbox.snapshot()
    snapshot["queue"] = runtime.queue_name
    return snapshot


@router.post("/inbox/process")
async def process_inbox_v3(
    limit: int = Query(default=10, ge=1, le=100),
    queue: str | None = Query(default=None),
):
    runtime = get_v3_runtime(_resolve_queue(queue))
    result = await runtime.inbox.process_pending(limit=limit, orchestrator=runtime.orchestrator)
    result["queue"] = runtime.queue_name
    return result


@router.get("/outbox/status")
async def outbox_status_v3(queue: str | None = Query(default=None)):
    runtime = get_v3_runtime(_resolve_queue(queue))
    snapshot = await runtime.outbox.snapshot()
    snapshot["queue"] = runtime.queue_name
    return snapshot


@router.post("/outbox/process")
async def process_outbox_v3(
    limit: int = Query(default=10, ge=1, le=100),
    queue: str | None = Query(default=None),
):
    runtime = get_v3_runtime(_resolve_queue(queue))
    result = await runtime.outbox.process_pending(limit=limit)
    result["queue"] = runtime.queue_name
    return result


@router.get("/context/status")
async def context_status_v3(queue: str | None = Query(default=None)):
    runtime = get_v3_runtime(_resolve_queue(queue))
    snapshot = await runtime.context_store.snapshot()
    snapshot["queue"] = runtime.queue_name
    return snapshot


@router.post("/inbox/reset")
async def reset_inbox_v3(queue: str | None = Query(default=None)):
    runtime = get_v3_runtime(_resolve_queue(queue))
    await runtime.outbox.reset()
    await runtime.context_store.reset()
    result = await runtime.inbox.reset()
    result["queue"] = runtime.queue_name
    return result
