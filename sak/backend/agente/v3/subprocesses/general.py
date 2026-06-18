"""Subproceso general v3."""

from __future__ import annotations

import logging

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult
from agente.v3.subprocesses.general_agent import (
    GENERAL_MENU_TEXT,
    GeneralAgentClient,
    GeneralAgentOutput,
    fallback_general_response,
)
from agente.v3.subprocesses.general_fastpath import is_pure_greeting, normalize_general_command

logger = logging.getLogger(__name__)

PROCESS_GENERAL = "general"
TARGET_PROCESSES = {"pedidoObra", "parteDiario"}


class GeneralSubprocess:
    name = PROCESS_GENERAL

    def __init__(self, agent_client: GeneralAgentClient | None = None) -> None:
        self._agent_client = agent_client or GeneralAgentClient()

    async def handle(self, message: V3InboundMessage, context: V3ConversationContext) -> V3ProcessResult:
        command = _normalize(message.text)
        if command == "cancelar":
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            updated.last_inbound_message_id = message.id
            return V3ProcessResult(
                context=updated,
                reply_text="Conversacion cancelada. Hola, cuando quieras podemos iniciar nuevamente.",
                metadata={
                    "process_name": self.name,
                    "status": "cancelled",
                    "closed_conversation": True,
                    "command": "cancelar",
                },
            )

        menu_selection = _menu_selection(command)
        if menu_selection is not None:
            target_process, handoff_text = menu_selection
            updated = context.copy()
            updated.active_process = target_process
            updated.process_state = {}
            updated.last_inbound_message_id = message.id
            return V3ProcessResult(
                context=updated,
                reply_text="",
                metadata={
                    "process_name": self.name,
                    "status": "handoff",
                    "agent_source": "menu",
                    "response_type": "handoff",
                    "target_process": target_process,
                    "handoff_text": handoff_text,
                    "reason": "general_menu_selection",
                },
            )

        if is_pure_greeting(message.text):
            updated = context.copy()
            updated.active_process = self.name
            updated.process_state = {
                "last_text": message.text,
                "last_external_message_id": message.external_message_id,
                "agent_source": "fast_path",
            }
            updated.last_inbound_message_id = message.id
            return V3ProcessResult(
                context=updated,
                reply_text=GENERAL_MENU_TEXT,
                metadata={
                    "process_name": self.name,
                    "status": "general_reply",
                    "agent_source": "fast_path",
                    "response_type": "general_reply",
                    "target_process": None,
                    "reason": "pure_greeting",
                },
            )

        try:
            output = await self._agent_client.respond(
                message_text=message.text or "",
                conversation_id=context.conversation_id,
                active_process=context.active_process,
            )
            source = "agent_sdk"
        except Exception as exc:
            logger.warning(
                "GeneralSubprocess v3 usa fallback local conversation_id=%s external_message_id=%s error=%s",
                message.conversation_id,
                message.external_message_id,
                exc,
            )
            output = fallback_general_response()
            source = "fallback"

        updated = context.copy()
        updated.last_inbound_message_id = message.id
        target_process = _valid_target_process(output)
        if output.type == "handoff" and target_process is not None:
            updated.active_process = target_process
            updated.process_state = {}
            status = "handoff"
        else:
            updated.active_process = self.name
            updated.process_state = {
                "last_text": message.text,
                "last_external_message_id": message.external_message_id,
                "agent_source": source,
            }
            status = "general_reply"

        return V3ProcessResult(
            context=updated,
            reply_text=output.respuesta,
            metadata={
                "process_name": self.name,
                "status": status,
                "agent_source": source,
                "response_type": output.type,
                "target_process": target_process,
                "reason": output.reason,
            },
        )


def _valid_target_process(output: GeneralAgentOutput) -> str | None:
    if output.target_process in TARGET_PROCESSES:
        return output.target_process
    return None


def _normalize(value: str | None) -> str:
    return normalize_general_command(value)


def _menu_selection(command: str) -> tuple[str, str] | None:
    if command == "1":
        return "pedidoObra", "pedido obra"
    if command == "2":
        return "parteDiario", "parte diario"
    return None
