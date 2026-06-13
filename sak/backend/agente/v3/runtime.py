"""Runtime minimo para ejecutar las colas v3."""

from __future__ import annotations

import logging
import time

from agente.v3.runtime_registry import get_v3_runtime

logger = logging.getLogger(__name__)


async def process_pending_once(*, limit: int = 10, queue: str | None = None) -> dict:
    """Procesa inbox y luego outbox una vez."""

    t0 = time.perf_counter()
    runtime = get_v3_runtime(queue)
    t_runtime = time.perf_counter()
    inbox_result = await runtime.inbox.process_pending(limit=limit, orchestrator=runtime.orchestrator)
    t_inbox = time.perf_counter()
    outbox_result = await runtime.outbox.process_pending(limit=limit)
    t_outbox = time.perf_counter()
    timings_ms = {
        "runtime": round((t_runtime - t0) * 1000, 3),
        "inbox": round((t_inbox - t_runtime) * 1000, 3),
        "outbox": round((t_outbox - t_inbox) * 1000, 3),
        "total": round((t_outbox - t0) * 1000, 3),
    }
    logger.info(
        "v3_runtime_timing queue=%s limit=%s inbox_processed=%s outbox_sent=%s "
        "runtime_ms=%s inbox_ms=%s outbox_ms=%s total_ms=%s",
        runtime.queue_name,
        limit,
        inbox_result.get("processed_count"),
        outbox_result.get("sent_count"),
        timings_ms["runtime"],
        timings_ms["inbox"],
        timings_ms["outbox"],
        timings_ms["total"],
    )
    await _store_runtime_timings(runtime, inbox_result, outbox_result, timings_ms)
    return {
        "status": "ok",
        "queue": runtime.queue_name,
        "inbox": inbox_result,
        "outbox": outbox_result,
        "timings_ms": timings_ms,
    }


async def _store_runtime_timings(runtime, inbox_result: dict, outbox_result: dict, timings_ms: dict) -> None:
    processed = inbox_result.get("processed")
    if not isinstance(processed, list) or not processed:
        return

    item = processed[-1]
    if not isinstance(item, dict):
        return

    conversation_id = item.get("conversation_id")
    if not conversation_id:
        return

    context = await runtime.context_store.load_or_create(str(conversation_id))
    current = dict(context.debug_timings or {})
    current["runtime"] = timings_ms
    current["inbox"] = item.get("timings_ms") or {}
    current["outbox"] = {
        "sent_count": outbox_result.get("sent_count"),
        "last_sent": (outbox_result.get("sent") or [None])[-1] if outbox_result.get("sent") else None,
    }
    current["last_processed_at"] = item.get("finished_at")
    context.debug_timings = current
    await runtime.context_store.save(context)
