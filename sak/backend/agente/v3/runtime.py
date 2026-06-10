"""Runtime minimo para ejecutar las colas v3."""

from __future__ import annotations

from agente.v3.inbox import default_inbox
from agente.v3.outbox import default_outbox


async def process_pending_once(*, limit: int = 10) -> dict:
    """Procesa inbox y luego outbox una vez."""

    inbox_result = await default_inbox.process_pending(limit=limit)
    outbox_result = await default_outbox.process_pending(limit=limit)
    return {
        "status": "ok",
        "inbox": inbox_result,
        "outbox": outbox_result,
    }

