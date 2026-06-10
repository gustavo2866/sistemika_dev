"""Outbox en memoria del agente v3."""

from __future__ import annotations

import asyncio
from collections import deque
from datetime import UTC, datetime
import time
from typing import Any

from agente.v3.models import V3OutboundMessage, utc_now


class V3Outbox:
    """Cola FIFO de respuestas pendientes de envio."""

    def __init__(self) -> None:
        self._queue: deque[V3OutboundMessage] = deque()
        self._sent: list[V3OutboundMessage] = []
        self._lock = asyncio.Lock()

    async def enqueue(self, message: V3OutboundMessage) -> str:
        async with self._lock:
            message.enqueued_at = utc_now()
            message.status = "pending"
            self._queue.append(message)
            return message.id

    async def process_next(self) -> dict[str, Any] | None:
        async with self._lock:
            if not self._queue:
                return None
            message = self._queue.popleft()

        started_at = datetime.now(UTC)
        t0 = time.perf_counter()

        from agente.v3.channel import default_meta_channel

        await default_meta_channel.send_text(message)
        t_send = time.perf_counter()
        message.sent_at = datetime.now(UTC)
        message.status = "sent"

        async with self._lock:
            self._sent.append(message)

        queued_ms = 0.0
        if message.enqueued_at is not None:
            queued_ms = max((started_at - message.enqueued_at).total_seconds() * 1000, 0.0)

        return {
            "message_id": message.id,
            "source_message_id": message.source_message_id,
            "to_address": message.to_address,
            "text": message.text,
            "status": message.status,
            "external_message_id": message.external_message_id,
            "started_at": started_at.isoformat(),
            "sent_at": message.sent_at.isoformat() if message.sent_at else None,
            "timings_ms": {
                "queued": round(queued_ms, 3),
                "channel_send": round((t_send - t0) * 1000, 3),
                "total": round((t_send - t0) * 1000, 3),
            },
        }

    async def process_pending(self, *, limit: int = 10) -> dict[str, Any]:
        sent: list[dict[str, Any]] = []
        for _ in range(limit):
            item = await self.process_next()
            if item is None:
                break
            sent.append(item)
        return {
            "status": "ok",
            "sent_count": len(sent),
            "sent": sent,
            "pending_count": await self.pending_count(),
        }

    async def pending_count(self) -> int:
        async with self._lock:
            return len(self._queue)

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            pending = list(self._queue)
            sent = list(self._sent)
        return {
            "status": "ok",
            "pending_count": len(pending),
            "sent_count": len(sent),
            "pending": [
                {
                    "message_id": message.id,
                    "source_message_id": message.source_message_id,
                    "to_address": message.to_address,
                    "text": message.text,
                    "status": message.status,
                    "external_message_id": message.external_message_id,
                    "enqueued_at": message.enqueued_at.isoformat() if message.enqueued_at else None,
                }
                for message in pending
            ],
            "last_sent": {
                "message_id": sent[-1].id,
                "source_message_id": sent[-1].source_message_id,
                "to_address": sent[-1].to_address,
                "text": sent[-1].text,
                "status": sent[-1].status,
                "external_message_id": sent[-1].external_message_id,
                "sent_at": sent[-1].sent_at.isoformat() if sent[-1].sent_at else None,
            }
            if sent
            else None,
        }

    async def reset(self) -> None:
        async with self._lock:
            self._queue.clear()
            self._sent.clear()


default_outbox = V3Outbox()
