"""Orquestador minimo del agente v3."""

from __future__ import annotations

from dataclasses import replace
import logging
import os
import time

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

logger = logging.getLogger(__name__)


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
        t0 = time.perf_counter()
        context = await self._context_store.load_or_create(message.conversation_id)
        t_context_load = time.perf_counter()
        selection = await self._resolve_process(message, context)
        t_selector = time.perf_counter()
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
        t_registry = time.perf_counter()

        process_result = await process.handle(message, context)
        final_process_name = selection.process_name
        handoff_metadata: dict[str, str] = {}
        handoff_target = _handoff_target(process_result.metadata)
        if handoff_target:
            target_process = self._subprocess_registry.get(handoff_target)
            if target_process is not None:
                logger.info(
                    "v3_orchestrator_handoff conversation_id=%s external_message_id=%s from_process=%s to_process=%s",
                    message.conversation_id,
                    message.external_message_id,
                    selection.process_name,
                    handoff_target,
                )
                handoff_metadata = {
                    "handoff_from_process": selection.process_name,
                    "handoff_to_process": handoff_target,
                }
                final_process_name = handoff_target
                target_message = _message_for_handoff(message, process_result.metadata)
                process_result = await target_process.handle(target_message, process_result.context)
        t_process = time.perf_counter()
        updated_context = await self._context_store.save(process_result.context)
        t_context_save = time.perf_counter()
        response_timings_ms = {
            "selector": round((t_selector - t_context_load) * 1000, 3),
            "subprocess": round((t_process - t_registry) * 1000, 3),
            "total": round((t_context_save - t0) * 1000, 3),
        }
        reply_text = _append_process_timing(
            process_result.reply_text,
            response_timings_ms,
            selected_process=final_process_name,
        )

        outbound_id = ""
        t_outbox_enqueue = t_context_save
        t_outbound_context_save = t_context_save
        if reply_text:
            outbound = V3OutboundMessage.recorded_meta_reply(source=message, text=reply_text)
            outbound_id = await self._outbox.enqueue(outbound)
            t_outbox_enqueue = time.perf_counter()
            updated_context.last_outbound_message_id = outbound_id
            await self._context_store.save(updated_context)
            t_outbound_context_save = time.perf_counter()

        timings_ms = {
            "context_load": round((t_context_load - t0) * 1000, 3),
            "selector": round((t_selector - t_context_load) * 1000, 3),
            "registry": round((t_registry - t_selector) * 1000, 3),
            "subprocess": round((t_process - t_registry) * 1000, 3),
            "context_save": round((t_context_save - t_process) * 1000, 3),
            "outbox_enqueue": round((t_outbox_enqueue - t_context_save) * 1000, 3),
            "outbound_context_save": round((t_outbound_context_save - t_outbox_enqueue) * 1000, 3),
            "total": round((t_outbound_context_save - t0) * 1000, 3),
        }
        logger.info(
            "v3_orchestrator_timing conversation_id=%s external_message_id=%s selected_process=%s "
            "selection_mode=%s context_load_ms=%s selector_ms=%s subprocess_ms=%s "
            "context_save_ms=%s outbox_enqueue_ms=%s total_ms=%s",
            message.conversation_id,
            message.external_message_id,
            final_process_name,
            selection.mode,
            timings_ms["context_load"],
            timings_ms["selector"],
            timings_ms["subprocess"],
            timings_ms["context_save"],
            timings_ms["outbox_enqueue"],
            timings_ms["total"],
        )
        updated_context.debug_timings = {
            **dict(updated_context.debug_timings or {}),
            "last_message": {
                "message_id": message.id,
                "external_message_id": message.external_message_id,
                "conversation_id": message.conversation_id,
                "text": message.text,
            },
            "orchestrator": timings_ms,
            "process_selection": selection.to_dict(),
            "final_process": final_process_name,
            **handoff_metadata,
        }
        updated_context = await self._context_store.save(updated_context)

        return (
            V3OrchestratorResult(
                status=process_result.status,
                reply_text=reply_text or "",
                metadata={
                    **process_result.metadata,
                    "agent_version": "v3",
                    "message_id": message.id,
                    "external_message_id": message.external_message_id,
                    "conversation_id": message.conversation_id,
                    "active_process": updated_context.active_process,
                    "selected_process": final_process_name,
                    "initial_selected_process": selection.process_name,
                    "process_selection": selection.to_dict(),
                    **handoff_metadata,
                    "orchestrator_timings_ms": timings_ms,
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


def _handoff_target(metadata: dict) -> str | None:
    if metadata.get("status") != "handoff":
        return None
    target = metadata.get("target_process")
    return target if isinstance(target, str) and target else None


def _message_for_handoff(message: V3InboundMessage, metadata: dict) -> V3InboundMessage:
    handoff_text = metadata.get("handoff_text")
    if not isinstance(handoff_text, str) or not handoff_text.strip():
        return message
    return replace(message, text=handoff_text)


def _append_process_timing(
    reply_text: str | None,
    timings_ms: dict[str, float],
    *,
    selected_process: str,
) -> str | None:
    if not reply_text:
        return reply_text
    if not _show_timing_in_reply():
        return reply_text
    return (
        f"{reply_text}\n\n"
        "*Timing proceso*\n"
        f"- proceso: {selected_process}\n"
        f"- selector: {_format_ms(timings_ms.get('selector'))}\n"
        f"- subproceso: {_format_ms(timings_ms.get('subprocess'))}\n"
        f"- total: {_format_ms(timings_ms.get('total'))}"
    )


def _format_ms(value: float | None) -> str:
    if value is None:
        return "n/d"
    if value >= 1000:
        return f"{value / 1000:.2f}s"
    return f"{round(value)}ms"


def _show_timing_in_reply() -> bool:
    return os.getenv("AGENTE_V3_SHOW_TIMING_IN_REPLY", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "si",
        "sí",
    }


default_orchestrator = V3Orchestrator()
