"""Runtime registry for isolated agente v3 queues."""

from __future__ import annotations

from dataclasses import dataclass

from agente.v3.inbox.queue import V3Inbox, default_inbox
from agente.v3.orchestrator.context_store import V3ContextStore, default_context_store
from agente.v3.orchestrator.service import V3Orchestrator, default_orchestrator
from agente.v3.outbox.queue import V3Outbox, default_outbox

QUEUE_DEFAULT = "default"
QUEUE_SMOKE = "smoke"
ALLOWED_V3_QUEUES = {QUEUE_DEFAULT, QUEUE_SMOKE}


@dataclass(slots=True)
class V3Runtime:
    queue_name: str
    inbox: V3Inbox
    context_store: V3ContextStore
    outbox: V3Outbox
    orchestrator: V3Orchestrator


_default_runtime = V3Runtime(
    queue_name=QUEUE_DEFAULT,
    inbox=default_inbox,
    context_store=default_context_store,
    outbox=default_outbox,
    orchestrator=default_orchestrator,
)
_runtimes: dict[str, V3Runtime] = {QUEUE_DEFAULT: _default_runtime}


def normalize_queue_name(queue: str | None) -> str:
    value = str(queue or "").strip().lower()
    if not value:
        return QUEUE_DEFAULT
    if value not in ALLOWED_V3_QUEUES:
        raise ValueError("queue invalida")
    return value


def get_v3_runtime(queue: str | None = None) -> V3Runtime:
    queue_name = normalize_queue_name(queue)
    runtime = _runtimes.get(queue_name)
    if runtime is not None:
        return runtime

    context_store = V3ContextStore()
    outbox = V3Outbox()
    orchestrator = V3Orchestrator(context_store=context_store, outbox=outbox)
    runtime = V3Runtime(
        queue_name=queue_name,
        inbox=V3Inbox(),
        context_store=context_store,
        outbox=outbox,
        orchestrator=orchestrator,
    )
    _runtimes[queue_name] = runtime
    return runtime
