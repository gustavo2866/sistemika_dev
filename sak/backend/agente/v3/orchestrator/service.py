"""Orquestador minimo del agente v3."""

from __future__ import annotations

from agente.v3.contracts import V3InboundMessage, V3OrchestratorResult, V3OutboundMessage
from agente.v3.orchestrator.context_store import V3ContextStore, default_context_store
from agente.v3.orchestrator.process_selector import (
    PROCESS_GENERAL,
    V3ProcessSelection,
    V3ProcessSelector,
    default_process_selector,
)
from agente.v3.outbox.queue import default_outbox
from agente.v3.outbox.queue import V3Outbox
from agente.v3.subprocesses.registry import V3SubprocessRegistry, default_subprocess_registry


class V3Orchestrator:
    """Carga contexto, deriva a subproceso y encola respuesta en outbox."""

    def __init__(
        self,
        *,
        context_store: V3ContextStore = default_context_store,
        outbox=default_outbox,
        subprocess_registry: V3SubprocessRegistry = default_subprocess_registry,
        process_selector: V3ProcessSelector = default_process_selector,
    ) -> None:
        self._context_store = context_store
        self._outbox: V3Outbox = outbox
        self._subprocess_registry = subprocess_registry
        self._process_selector = process_selector

    async def process_message(self, message: V3InboundMessage) -> tuple[V3OrchestratorResult, str]:
        context = await self._context_store.load_or_create(message.conversation_id)
        selection = await self._resolve_process(message, context)
        process = self._subprocess_registry.get(selection.process_name)
        if process is None:
            selection = V3ProcessSelection(
                process_name=PROCESS_GENERAL,
                mode="fallback",
                confidence=0.0,
                reason=f"Subproceso no registrado: {selection.process_name}",
            )
            process = self._subprocess_registry.get(PROCESS_GENERAL)
        if process is None:
            raise RuntimeError("No hay subproceso general registrado")

        process_result = await process.handle(message, context)
        updated_context = await self._context_store.save(process_result.context)

        outbound_id = ""
        if process_result.reply_text:
            outbound = V3OutboundMessage.recorded_meta_reply(source=message, text=process_result.reply_text)
            outbound_id = await self._outbox.enqueue(outbound)
            updated_context.last_outbound_message_id = outbound_id
            await self._context_store.save(updated_context)

        return (
            V3OrchestratorResult(
                status=process_result.status,
                reply_text=process_result.reply_text or "",
                metadata={
                    **process_result.metadata,
                    "agent_version": "v3",
                    "message_id": message.id,
                    "external_message_id": message.external_message_id,
                    "conversation_id": message.conversation_id,
                    "active_process": updated_context.active_process,
                    "selected_process": selection.process_name,
                    "process_selection": selection.to_dict(),
                },
            ),
            outbound_id,
        )

    async def _resolve_process(
        self,
        message: V3InboundMessage,
        context,
    ) -> V3ProcessSelection:
        if context.active_process:
            return V3ProcessSelection(
                process_name=context.active_process,
                mode="active_context",
                confidence=1.0,
                reason="La conversacion ya tenia subproceso activo.",
            )
        return await self._process_selector.resolve(message, context)


default_orchestrator = V3Orchestrator()
