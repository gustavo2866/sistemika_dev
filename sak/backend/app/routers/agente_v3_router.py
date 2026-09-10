"""Endpoints experimentales del agente v3."""

from __future__ import annotations

import os
import re
import time
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session, select

from agente.v3.runtime import process_pending_once
from agente.v3.runtime_registry import get_v3_runtime, normalize_queue_name
from app.db import get_session
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.persistence import ChannelEvent
from app.modules.channels.v3.meta_channel import default_meta_channel, persist_received_channel_events

router = APIRouter(prefix="/agente/v3", tags=["agente-v3"])

_CHAT_QUEUE = "smoke"
_CHAT_FROM_PHONE = os.environ.get("CHAT_TEST_FROM_PHONE", "5491156384310")
_CHAT_FROM_NAME = os.environ.get("CHAT_TEST_FROM_NAME", "Encargado Test")
_CHAT_TO_PHONE = os.environ.get("CHAT_TEST_TO_PHONE", "5493816259343")
_CHAT_META_PHONE_NUMBER_ID = os.environ.get("CHAT_TEST_META_PHONE_NUMBER_ID", "1046006975257973")
_CHAT_META_WABA_ID = os.environ.get("CHAT_TEST_META_WABA_ID", "1516474752918083")
_CHAT_SETTLE_SECONDS = float(os.environ.get("CHAT_TEST_SETTLE_SECONDS", "0.8"))


def _resolve_queue(queue: str | None) -> str:
    try:
        return normalize_queue_name(queue)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="queue invalida: solo se permite 'smoke'") from exc


def _normalize_phone(value: str | None) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def _build_chat_meta_payload(
    texto: str,
    meta_message_id: str,
    *,
    from_phone: str,
    from_name: str,
) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": _CHAT_META_WABA_ID,
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "metadata": {
                                "display_phone_number": _CHAT_TO_PHONE,
                                "phone_number_id": _CHAT_META_PHONE_NUMBER_ID,
                                "delivery_mode": "simulated",
                            },
                            "contacts": [
                                {
                                    "wa_id": from_phone,
                                    "profile": {"name": from_name},
                                }
                            ],
                            "messages": [
                                {
                                    "from": from_phone,
                                    "id": meta_message_id,
                                    "timestamp": str(int(time.time())),
                                    "type": "text",
                                    "text": {"body": texto},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }


def _extract_outbound_text(normalized: dict | None, raw: dict | None) -> str | None:
    request = (normalized or {}).get("request")
    if isinstance(request, dict):
        text = request.get("text")
        if isinstance(text, dict) and text.get("body"):
            return str(text["body"])
        interactive = request.get("interactive")
        if isinstance(interactive, dict):
            return _format_interactive_text(interactive)
    text = (raw or {}).get("text")
    if isinstance(text, dict) and text.get("body"):
        return str(text["body"])
    return None


def _format_interactive_text(interactive: dict) -> str | None:
    lines: list[str] = []
    header = interactive.get("header")
    if isinstance(header, dict) and header.get("text"):
        lines.append(str(header["text"]))
    body = interactive.get("body")
    if isinstance(body, dict) and body.get("text"):
        lines.append(str(body["text"]))
    action = interactive.get("action")
    if isinstance(action, dict):
        rows: list[dict] = []
        for section in action.get("sections") or []:
            if isinstance(section, dict):
                rows.extend([row for row in section.get("rows") or [] if isinstance(row, dict)])
        for index, row in enumerate(rows, start=1):
            label = row.get("title") or row.get("id")
            if label:
                description = row.get("description")
                lines.append(f"{index}: {label} ({description})" if description else f"{index}: {label}")
        for index, button in enumerate(action.get("buttons") or [], start=1):
            if not isinstance(button, dict):
                continue
            reply = button.get("reply") if isinstance(button.get("reply"), dict) else {}
            label = reply.get("title") or reply.get("id")
            if label:
                lines.append(f"{index}: {label}")
    footer = interactive.get("footer")
    if isinstance(footer, dict) and footer.get("text"):
        lines.append(str(footer["text"]))
    return "\n".join(lines) if lines else None


def _outbound_from_channel_event(row: ChannelEvent) -> dict:
    normalized = row.normalized_payload or {}
    return {
        "id": row.id,
        "status": row.status,
        "text": _extract_outbound_text(normalized, row.raw_payload or {}) or "(sin texto)",
        "external_message_id": row.external_message_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _matches_source_external_message(row: ChannelEvent, meta_message_id: str) -> bool:
    agent_v3 = ((row.normalized_payload or {}).get("agent_v3") or {})
    return (
        isinstance(agent_v3, dict)
        and agent_v3.get("source_external_message_id") == meta_message_id
        and str(agent_v3.get("queue") or "").strip().lower() == _CHAT_QUEUE
    )


def _expected_outbound_count_from_inbox_status(status: dict, meta_message_id: str) -> int | None:
    last_processed = status.get("last_processed") if isinstance(status, dict) else None
    if not isinstance(last_processed, dict):
        return None
    if last_processed.get("external_message_id") != meta_message_id:
        return None

    orchestrator = last_processed.get("orchestrator")
    metadata = orchestrator.get("metadata") if isinstance(orchestrator, dict) else None
    if isinstance(metadata, dict):
        outbound_ids = metadata.get("outbound_message_ids")
        if isinstance(outbound_ids, list) and outbound_ids:
            return len(outbound_ids)

    outbox = last_processed.get("outbox")
    if isinstance(outbox, dict) and outbox.get("message_id"):
        return 1
    return None


def _orchestrator_metadata_from_inbox_status(status: dict, meta_message_id: str) -> dict:
    last_processed = status.get("last_processed") if isinstance(status, dict) else None
    if not isinstance(last_processed, dict):
        return {}
    if last_processed.get("external_message_id") != meta_message_id:
        return {}
    orchestrator = last_processed.get("orchestrator")
    metadata = orchestrator.get("metadata") if isinstance(orchestrator, dict) else None
    return metadata if isinstance(metadata, dict) else {}


def _merge_outbounds(current: list[dict], incoming: list[dict]) -> list[dict]:
    merged = list(current)
    observed = {_outbound_dedupe_key(item) for item in merged}
    for item in incoming:
        key = _outbound_dedupe_key(item)
        if key in observed:
            continue
        merged.append(item)
        observed.add(key)
    return sorted(merged, key=lambda item: str(item.get("created_at") or ""))


def _outbound_dedupe_key(item: dict) -> str:
    external_message_id = item.get("external_message_id")
    if external_message_id:
        return f"external:{external_message_id}"
    return f"content:{item.get('status') or ''}:{item.get('text') or ''}"


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


@router.post("/chat/send")
async def send_agent_chat_message(
    background_tasks: BackgroundTasks,
    payload: dict = Body(...),
):
    texto = str(payload.get("texto") or "").strip() if isinstance(payload, dict) else ""
    if not texto:
        raise HTTPException(status_code=400, detail="texto requerido")
    from_phone = _normalize_phone(payload.get("from_phone") if isinstance(payload, dict) else None)
    if not from_phone:
        from_phone = _CHAT_FROM_PHONE
    from_name = str(payload.get("from_name") or "").strip() if isinstance(payload, dict) else ""
    if not from_name:
        from_name = _CHAT_FROM_NAME

    meta_message_id = f"wamid.chat-test.{uuid4().hex}"
    queue_name = _resolve_queue(_CHAT_QUEUE)
    runtime = get_v3_runtime(queue_name)
    webhook_payload = _build_chat_meta_payload(
        texto,
        meta_message_id,
        from_phone=from_phone,
        from_name=from_name,
    )
    response = await default_meta_channel.receive(
        webhook_payload,
        inbox=runtime.inbox,
        queue_name=queue_name,
        after_enqueue=lambda messages: (
            background_tasks.add_task(process_pending_once, limit=len(messages), queue=queue_name),
            background_tasks.add_task(persist_received_channel_events, list(messages)),
        ),
    )
    return {
        "meta_message_id": meta_message_id,
        "from_phone": from_phone,
        "from_name": from_name,
        "queue": queue_name,
        "webhook": response,
    }


@router.get("/chat/result/{meta_message_id}")
async def agent_chat_result(
    meta_message_id: str,
    from_phone: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    resolved_from_phone = _normalize_phone(from_phone) or _CHAT_FROM_PHONE
    rows = session.exec(
        select(ChannelEvent)
        .where(ChannelEvent.deleted_at.is_(None))
        .where(ChannelEvent.provider == "meta")
        .where(ChannelEvent.channel_type == "whatsapp")
        .where(ChannelEvent.direction == "outbound")
        .where(ChannelEvent.to_address == resolved_from_phone)
        .order_by(ChannelEvent.created_at.desc(), ChannelEvent.id.desc())
        .limit(100)
    ).all()
    matched_rows = [row for row in rows if _matches_source_external_message(row, meta_message_id)]
    matched_rows.sort(key=lambda row: (row.created_at, row.id or 0))
    runtime = get_v3_runtime(_CHAT_QUEUE)
    inbox_status = await runtime.inbox.snapshot()
    expected_count = _expected_outbound_count_from_inbox_status(inbox_status, meta_message_id)
    metadata = _orchestrator_metadata_from_inbox_status(inbox_status, meta_message_id)
    outbounds = [_outbound_from_channel_event(row) for row in matched_rows]
    outbox_status = await runtime.outbox.snapshot()
    sent = outbox_status.get("sent") if isinstance(outbox_status, dict) else []
    fallback = [
        {
            "id": item.get("message_id"),
            "status": item.get("status"),
            "text": item.get("text") or "(sin texto)",
            "external_message_id": item.get("external_message_id"),
            "created_at": item.get("sent_at"),
        }
        for item in sent
        if isinstance(item, dict)
        and item.get("source_external_message_id") == meta_message_id
        and item.get("to_address") == resolved_from_phone
    ]
    outbounds = _merge_outbounds(outbounds, fallback)
    if not outbounds:
        return {"ready": False, "outbounds": [], "metadata": metadata}
    if expected_count and len(outbounds) < expected_count:
        return {"ready": False, "outbounds": outbounds, "expected_count": expected_count, "metadata": metadata}
    if expected_count and len(outbounds) >= expected_count:
        return {"ready": True, "outbounds": outbounds, "expected_count": expected_count, "metadata": metadata}

    latest_created_at = max((str(item.get("created_at") or "") for item in outbounds), default="")
    if latest_created_at:
        try:
            latest = datetime.fromisoformat(latest_created_at.replace("Z", "+00:00"))
            if latest.tzinfo is None:
                latest = latest.replace(tzinfo=UTC)
            if (datetime.now(UTC) - latest.astimezone(UTC)).total_seconds() < _CHAT_SETTLE_SECONDS:
                return {"ready": False, "outbounds": outbounds, "metadata": metadata}
        except ValueError:
            return {"ready": False, "outbounds": outbounds, "metadata": metadata}
    return {"ready": True, "outbounds": outbounds, "metadata": metadata}


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
