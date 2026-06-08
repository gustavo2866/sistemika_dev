"""Worker asincronico para consumir la cola en memoria del agente."""

from __future__ import annotations

import asyncio
import logging
import os

from sqlmodel import Session, select

from app.db import engine
from app.models import CRMMensaje
from app.models.enums import CanalMensaje, TipoMensaje
from app.services.agent_pending_processor import process_agent_message_by_id
from app.services.agent_queue_state import (
    STATUS_PENDING,
    STATUS_PROCESSING,
    message_queue_name,
    message_queue_status,
    worker_queue_name,
)

logger = logging.getLogger(__name__)

_queue: asyncio.Queue[int] | None = None
_worker_task: asyncio.Task[None] | None = None
_requeue_tasks: set[asyncio.Task[None]] = set()


def _enabled() -> bool:
    return os.getenv("AGENT_QUEUE_WORKER_ENABLED", "1").strip().lower() not in {"0", "false", "no"}


def _retry_delay_seconds() -> float:
    try:
        return max(float(os.getenv("AGENT_QUEUE_RETRY_DELAY_SECONDS", "5")), 0.5)
    except ValueError:
        return 5.0


def _get_queue() -> asyncio.Queue[int]:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    return _queue


def enqueue_agent_message(message_id: int) -> None:
    """Encola un mensaje persistido para procesamiento asincronico."""
    _get_queue().put_nowait(int(message_id))


def _load_bootstrap_message_ids(session: Session, *, queue_name: str) -> list[int]:
    rows = session.exec(
        select(CRMMensaje)
        .where(CRMMensaje.deleted_at.is_(None))
        .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
        .where(CRMMensaje.canal == CanalMensaje.WHATSAPP.value)
        .where(CRMMensaje.origen_externo_id.is_not(None))
        .where(CRMMensaje.oportunidad_id.is_not(None))
        .order_by(CRMMensaje.fecha_mensaje.asc(), CRMMensaje.id.asc())
    ).all()
    pending_statuses = {STATUS_PENDING, STATUS_PROCESSING}
    return [
        int(message.id)
        for message in rows
        if message_queue_name(message) == queue_name
        and message_queue_status(message) in pending_statuses
    ]


async def _bootstrap_queue(queue: asyncio.Queue[int], *, queue_name: str) -> None:
    with Session(engine) as session:
        message_ids = _load_bootstrap_message_ids(session, queue_name=queue_name)
    for message_id in message_ids:
        queue.put_nowait(message_id)
    if message_ids:
        logger.info(
            "Cola del agente reconstruida queue=%s mensajes=%s",
            queue_name,
            len(message_ids),
        )


def _schedule_requeue(message_id: int) -> None:
    async def _requeue_later() -> None:
        try:
            await asyncio.sleep(_retry_delay_seconds())
            enqueue_agent_message(message_id)
        finally:
            _requeue_tasks.discard(asyncio.current_task())

    task = asyncio.create_task(_requeue_later(), name=f"agent-queue-retry-{message_id}")
    _requeue_tasks.add(task)


async def _run_worker() -> None:
    queue_name = worker_queue_name()
    queue = _get_queue()
    await _bootstrap_queue(queue, queue_name=queue_name)

    while True:
        message_id = await queue.get()
        try:
            with Session(engine) as session:
                result = await process_agent_message_by_id(
                    session,
                    message_id,
                    source="queue_worker",
                    queue_name=queue_name,
                )
            if result.get("retryable"):
                _schedule_requeue(message_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Error consumiendo cola del agente message_id=%s", message_id)
        finally:
            queue.task_done()


def start_agent_queue_worker() -> None:
    global _worker_task
    if not _enabled() or (_worker_task is not None and not _worker_task.done()):
        return
    _get_queue()
    _worker_task = asyncio.create_task(_run_worker(), name="agent-queue-worker")
    logger.info("Worker de cola del agente iniciado queue=%s", worker_queue_name())


async def stop_agent_queue_worker() -> None:
    global _worker_task
    task = _worker_task
    _worker_task = None
    for requeue_task in list(_requeue_tasks):
        requeue_task.cancel()
    if _requeue_tasks:
        await asyncio.gather(*_requeue_tasks, return_exceptions=True)
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
