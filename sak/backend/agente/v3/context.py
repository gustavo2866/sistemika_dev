"""Contexto conversacional en memoria para agente v3."""

from __future__ import annotations

import asyncio

from agente.v3.models import V3ConversationContext, utc_now


class V3ContextStore:
    """Store simple de contextos por conversation_id."""

    def __init__(self) -> None:
        self._contexts: dict[str, V3ConversationContext] = {}
        self._lock = asyncio.Lock()

    async def load_or_create(self, conversation_id: str) -> V3ConversationContext:
        async with self._lock:
            current = self._contexts.get(conversation_id)
            if current is None:
                current = V3ConversationContext(conversation_id=conversation_id)
                self._contexts[conversation_id] = current
            return current.copy()

    async def save(self, context: V3ConversationContext) -> V3ConversationContext:
        context.updated_at = utc_now()
        async with self._lock:
            self._contexts[context.conversation_id] = context.copy()
            return context.copy()

    async def snapshot(self) -> dict:
        async with self._lock:
            contexts = [item.copy() for item in self._contexts.values()]
        return {
            "status": "ok",
            "count": len(contexts),
            "contexts": [
                {
                    "conversation_id": item.conversation_id,
                    "active_process": item.active_process,
                    "process_state": item.process_state,
                    "last_inbound_message_id": item.last_inbound_message_id,
                    "last_outbound_message_id": item.last_outbound_message_id,
                    "created_at": item.created_at.isoformat(),
                    "updated_at": item.updated_at.isoformat(),
                }
                for item in contexts
            ],
        }

    async def reset(self) -> None:
        async with self._lock:
            self._contexts.clear()


default_context_store = V3ContextStore()

