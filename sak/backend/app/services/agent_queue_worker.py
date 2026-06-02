"""Worker periodico para consumir la cola durable de mensajes del agente."""

from __future__ import annotations

import asyncio
import logging
import os

from sqlmodel import Session

from app.db import engine
from app.services.agent_pending_processor import process_pending_agent_messages

logger = logging.getLogger(__name__)
_worker_task: asyncio.Task[None] | None = None


def _enabled() -> bool:
    return os.getenv("AGENT_QUEUE_WORKER_ENABLED", "1").strip().lower() not in {"0", "false", "no"}


def _interval_seconds() -> float:
    try:
        return max(float(os.getenv("AGENT_QUEUE_WORKER_INTERVAL_SECONDS", "1")), 0.1)
    except ValueError:
        return 1.0


def _batch_size() -> int:
    try:
        return max(int(os.getenv("AGENT_QUEUE_WORKER_BATCH_SIZE", "10")), 1)
    except ValueError:
        return 10


async def _run_worker() -> None:
    while True:
        try:
            with Session(engine) as session:
                await process_pending_agent_messages(
                    session,
                    limit=_batch_size(),
                    source="queue_worker",
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Error consumiendo cola durable del agente")
        await asyncio.sleep(_interval_seconds())


def start_agent_queue_worker() -> None:
    global _worker_task
    if not _enabled() or (_worker_task is not None and not _worker_task.done()):
        return
    _worker_task = asyncio.create_task(_run_worker(), name="agent-queue-worker")


async def stop_agent_queue_worker() -> None:
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
