"""Contrato y comportamiento base para subprocesos v3."""

from __future__ import annotations

import re
import unicodedata
from typing import Protocol
from zoneinfo import ZoneInfo

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult, utc_now


DISPLAY_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


class V3Subprocess(Protocol):
    name: str

    async def handle(self, message: V3InboundMessage, context: V3ConversationContext) -> V3ProcessResult:
        ...


class V3TimingSubprocess:
    """Subproceso minimo: responde tiempos y conserva contexto simple."""

    name: str

    async def handle(self, message: V3InboundMessage, context: V3ConversationContext) -> V3ProcessResult:
        updated = context.copy()
        if _normalize(message.text) == "cancelar":
            updated.active_process = None
            updated.process_state = {}
            updated.last_inbound_message_id = message.id
            sent_at = utc_now()
            return V3ProcessResult(
                context=updated,
                reply_text=(
                    "Conversacion cancelada. Hola, cuando quieras podemos iniciar nuevamente.\n"
                    f"recibido: {_time_label(message.received_at)}\n"
                    f"enviado: {_time_label(sent_at)}\n"
                    f"sub_proceso: {self.name}\n"
                    f"conversation_id: {message.conversation_id}\n"
                    f"mensaje_origen: {message.external_message_id}\n"
                    f"texto_origen: {message.text or ''}"
                ),
                status="ok",
                metadata={
                    "process_name": self.name,
                    "command": "cancelar",
                    "closed_conversation": True,
                    "received_at": message.received_at.isoformat(),
                    "sent_at": sent_at.isoformat(),
                },
            )

        updated.active_process = self.name
        updated.process_state = {
            "last_text": message.text,
            "last_external_message_id": message.external_message_id,
        }
        updated.last_inbound_message_id = message.id
        sent_at = utc_now()
        return V3ProcessResult(
            context=updated,
            reply_text=(
                f"recibido: {_time_label(message.received_at)}\n"
                f"enviado: {_time_label(sent_at)}\n"
                f"sub_proceso: {self.name}\n"
                f"conversation_id: {message.conversation_id}\n"
                f"mensaje_origen: {message.external_message_id}\n"
                f"texto_origen: {message.text or ''}"
            ),
            status="ok",
            metadata={
                "process_name": self.name,
                "received_at": message.received_at.isoformat(),
                "sent_at": sent_at.isoformat(),
            },
        )


def _time_label(value) -> str:
    return value.astimezone(DISPLAY_TZ).strftime("%H:%M:%S")


def _normalize(value: str | None) -> str:
    raw = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    raw = "".join(char for char in raw if not unicodedata.combining(char))
    raw = re.sub(r"[^a-z0-9\s]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()

