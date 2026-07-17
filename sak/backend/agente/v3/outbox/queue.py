"""Outbox en memoria del agente v3."""

from __future__ import annotations

import asyncio
from collections import deque
from datetime import UTC, datetime
import logging
import time
from typing import Any

from agente.v3.contracts import V3OutboundMessage, utc_now

logger = logging.getLogger(__name__)


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

        from app.modules.channels.v3.meta_channel import default_meta_channel

        error: str | None = None
        try:
            if message.payload_type == "interactive" and message.interactive:
                try:
                    await default_meta_channel.send_interactive(message)
                except Exception as exc:
                    logger.warning(
                        "v3_outbox_interactive_fallback source_external_message_id=%s error=%s",
                        message.source_external_message_id,
                        exc,
                    )
                    await default_meta_channel.send_text(message)
                    message.payload_type = "text"
                    message.interactive = None
                    message.raw_response = {
                        **dict(message.raw_response or {}),
                        "interactive_error": str(exc),
                    }
            else:
                await default_meta_channel.send_text(message)
            message.status = "sent"
        except Exception as exc:
            error = str(exc)
            message.status = "failed"
            message.raw_response = {"error": error}
        t_send = time.perf_counter()
        message.sent_at = datetime.now(UTC)

        async with self._lock:
            self._sent.append(message)

        queued_ms = 0.0
        if message.enqueued_at is not None:
            queued_ms = max((started_at - message.enqueued_at).total_seconds() * 1000, 0.0)

        timings_ms = {
            "queued": round(queued_ms, 3),
            "channel_send": round((t_send - t0) * 1000, 3),
            "total": round((t_send - t0) * 1000, 3),
        }
        logger.info(
            "v3_outbox_timing message_id=%s source_external_message_id=%s status=%s "
            "queued_ms=%s channel_send_ms=%s total_ms=%s",
            message.id,
            message.source_external_message_id,
            message.status,
            timings_ms["queued"],
            timings_ms["channel_send"],
            timings_ms["total"],
        )
        return {
            "message_id": message.id,
            "source_message_id": message.source_message_id,
            "source_external_message_id": message.source_external_message_id,
            "queue": message.queue_name,
            "to_address": message.to_address,
            "text": message.text,
            "payload_type": message.payload_type,
            "status": message.status,
            "external_message_id": message.external_message_id,
            "error": error,
            "started_at": started_at.isoformat(),
            "sent_at": message.sent_at.isoformat() if message.sent_at else None,
            "timings_ms": timings_ms,
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
        sent_items = [
            {
                "message_id": message.id,
                "source_message_id": message.source_message_id,
                "source_external_message_id": message.source_external_message_id,
                "queue": message.queue_name,
                "to_address": message.to_address,
                "text": message.text,
                "payload_type": message.payload_type,
                "interactive": message.interactive,
                "status": message.status,
                "external_message_id": message.external_message_id,
                "raw_response": message.raw_response,
                "sent_at": message.sent_at.isoformat() if message.sent_at else None,
            }
            for message in sent
        ]
        return {
            "status": "ok",
            "pending_count": len(pending),
            "sent_count": len(sent),
            "pending": [
                {
                    "message_id": message.id,
                    "source_message_id": message.source_message_id,
                    "source_external_message_id": message.source_external_message_id,
                    "queue": message.queue_name,
                    "to_address": message.to_address,
                    "text": message.text,
                    "payload_type": message.payload_type,
                    "interactive": message.interactive,
                    "status": message.status,
                    "external_message_id": message.external_message_id,
                    "raw_response": message.raw_response,
                    "enqueued_at": message.enqueued_at.isoformat() if message.enqueued_at else None,
                }
                for message in pending
            ],
            "sent": sent_items,
            "last_sent": sent_items[-1] if sent_items else None,
        }

    async def reset(self) -> None:
        async with self._lock:
            self._queue.clear()
            self._sent.clear()


default_outbox = V3Outbox()
