"""Worker asincronico para materializar eventos de canal en CRM."""

from __future__ import annotations

import asyncio
import logging
import os

from sqlmodel import Session

from app.db import engine
from app.modules.channels.persistence import ChannelEvent
from app.services.agent_queue_state import DEFAULT_QUEUE_NAME, normalize_queue_name
from app.services.agent_queue_worker import enqueue_agent_message
from app.services.meta_webhook_service import MetaWebhookService

logger = logging.getLogger(__name__)

_queue: asyncio.Queue[int] | None = None
_worker_task: asyncio.Task[None] | None = None


def _enabled() -> bool:
    return os.getenv("CHANNEL_EVENT_QUEUE_WORKER_ENABLED", "1").strip().lower() not in {"0", "false", "no"}


def _get_queue() -> asyncio.Queue[int]:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    return _queue


def enqueue_channel_event(event_id: int) -> None:
    """Encola un channel_event ya persistido para materializacion CRM."""
    _get_queue().put_nowait(int(event_id))


async def process_channel_event_by_id(
    session: Session,
    event_id: int,
    *,
    queue_name: str = DEFAULT_QUEUE_NAME,
) -> dict:
    event = session.get(ChannelEvent, int(event_id))
    if event is None or event.deleted_at is not None:
        return {"status": "skipped", "reason": "missing_channel_event", "channel_event_id": event_id}
    if event.provider != "meta" or event.channel_type != "whatsapp":
        return {"status": "skipped", "reason": "unsupported_channel_event", "channel_event_id": event_id}
    if event.direction != "inbound":
        return {"status": "skipped", "reason": "not_inbound", "channel_event_id": event_id}

    payload = dict(event.normalized_payload or {})
    if not payload:
        return {"status": "skipped", "reason": "missing_normalized_payload", "channel_event_id": event_id}

    service = MetaWebhookService(session)
    result = await service.process_webhook(
        payload,
        enqueue_only=True,
        queue_name=normalize_queue_name(queue_name),
        enqueue_message_callback=enqueue_agent_message,
        record_channel_event=False,
    )
    return {"status": "processed", "channel_event_id": event_id, "result": result}


async def _run_worker() -> None:
    queue = _get_queue()
    queue_name = normalize_queue_name(os.getenv("AGENT_QUEUE_NAME", DEFAULT_QUEUE_NAME))
    while True:
        event_id = await queue.get()
        try:
            with Session(engine) as session:
                await process_channel_event_by_id(session, event_id, queue_name=queue_name)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Error consumiendo evento de canal channel_event_id=%s", event_id)
        finally:
            queue.task_done()


def start_channel_event_queue_worker() -> None:
    global _worker_task
    if not _enabled() or (_worker_task is not None and not _worker_task.done()):
        return
    _get_queue()
    _worker_task = asyncio.create_task(_run_worker(), name="channel-event-queue-worker")
    logger.info("Worker de eventos de canal iniciado")


async def stop_channel_event_queue_worker() -> None:
    global _worker_task
    task = _worker_task
    _worker_task = None
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
