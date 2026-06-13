"""Runtime minimo para ejecutar las colas v3."""

from __future__ import annotations

from agente.v3.runtime_registry import get_v3_runtime


async def process_pending_once(*, limit: int = 10, queue: str | None = None) -> dict:
    """Procesa inbox y luego outbox una vez."""

    runtime = get_v3_runtime(queue)
    inbox_result = await runtime.inbox.process_pending(limit=limit, orchestrator=runtime.orchestrator)
    outbox_result = await runtime.outbox.process_pending(limit=limit)
    return {
        "status": "ok",
        "queue": runtime.queue_name,
        "inbox": inbox_result,
        "outbox": outbox_result,
    }
