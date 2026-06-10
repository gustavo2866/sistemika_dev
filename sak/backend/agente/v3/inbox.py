"""Inbox en memoria del agente v3."""

from __future__ import annotations

import asyncio
from collections import deque
from datetime import UTC, datetime
import time
from typing import Any

from agente.v3.models import (
    V3InboundMessage,
    V3ProcessedMessage,
    utc_now,
)
from agente.v3.orquesador import V3Orquesador, default_orquesador


class V3Inbox:
    """Cola FIFO en memoria para probar el flujo v3 paso a paso."""

    def __init__(self) -> None:
        self._queue: deque[V3InboundMessage] = deque()
        self._processed: list[V3ProcessedMessage] = []
        self._lock = asyncio.Lock()

    async def enqueue_many(self, messages: list[V3InboundMessage]) -> list[str]:
        async with self._lock:
            for message in messages:
                message.enqueued_at = utc_now()
                self._queue.append(message)
            return [message.id for message in messages]

    async def process_next(
        self,
        *,
        orquesador: V3Orquesador = default_orquesador,
    ) -> V3ProcessedMessage | None:
        async with self._lock:
            if not self._queue:
                return None
            message = self._queue.popleft()

        started_at = datetime.now(UTC)
        t0 = time.perf_counter()
        result, outbound_message_id = await orquesador.process_message(message)
        t_orquesador = time.perf_counter()
        finished_at = datetime.now(UTC)
        queued_ms = 0.0
        if message.enqueued_at is not None:
            queued_ms = max((started_at - message.enqueued_at).total_seconds() * 1000, 0.0)

        processed = V3ProcessedMessage(
            inbound=message,
            orchestrator_result=result,
            outbound_message_id=outbound_message_id,
            started_at=started_at,
            finished_at=finished_at,
            timings_ms={
                "queued": round(queued_ms, 3),
                "orquesador": round((t_orquesador - t0) * 1000, 3),
                "total": round((t_orquesador - t0) * 1000, 3),
            },
        )
        async with self._lock:
            self._processed.append(processed)
        return processed

    async def process_pending(self, *, limit: int = 10) -> dict[str, Any]:
        processed: list[V3ProcessedMessage] = []
        for _ in range(limit):
            item = await self.process_next()
            if item is None:
                break
            processed.append(item)
        return {
            "status": "ok",
            "processed_count": len(processed),
            "processed": [item.as_dict() for item in processed],
            "pending_count": await self.pending_count(),
        }

    async def pending_count(self) -> int:
        async with self._lock:
            return len(self._queue)

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            pending = list(self._queue)
            processed = list(self._processed)
        return {
            "status": "ok",
            "pending_count": len(pending),
            "processed_count": len(processed),
            "pending": [
                {
                    "message_id": message.id,
                    "conversation_id": message.conversation_id,
                    "external_message_id": message.external_message_id,
                    "from_address": message.from_address,
                    "to_address": message.to_address,
                    "text": message.text,
                    "message_type": message.message_type,
                    "received_at": message.received_at.isoformat(),
                    "enqueued_at": message.enqueued_at.isoformat() if message.enqueued_at else None,
                }
                for message in pending
            ],
            "last_processed": processed[-1].as_dict() if processed else None,
        }

    async def reset(self) -> dict[str, Any]:
        async with self._lock:
            self._queue.clear()
            self._processed.clear()
        return {"status": "ok"}


default_inbox = V3Inbox()
