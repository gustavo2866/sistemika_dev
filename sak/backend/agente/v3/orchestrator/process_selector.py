"""Selector de subproceso inicial para agente v3."""

from __future__ import annotations

import json
import logging
import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Any

from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.llm import OpenAIChatClient
from agente.v3.subprocesses.general_fastpath import is_pure_greeting

logger = logging.getLogger(__name__)


PROCESS_GENERAL = "general"
PROCESS_PEDIDO_OBRA = "pedidoObra"
PROCESS_PARTE_DIARIO = "parteDiario"

PROCESS_NAMES = {PROCESS_GENERAL, PROCESS_PEDIDO_OBRA, PROCESS_PARTE_DIARIO}

PROCESS_CATALOG: dict[str, str] = {
    PROCESS_GENERAL: "Saludos, dudas generales, mensajes ambiguos o navegacion conversacional.",
    PROCESS_PEDIDO_OBRA: "Pedidos, modificaciones o consultas de materiales para obra.",
    PROCESS_PARTE_DIARIO: "Asistencia, ausencias, horas, novedades o estado del personal de obra.",
}

@dataclass(slots=True)
class V3ProcessSelection:
    process_name: str
    mode: str
    confidence: float
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "process_name": self.process_name,
            "mode": self.mode,
            "confidence": self.confidence,
            "reason": self.reason,
        }


class V3ProcessSelector:
    """Resuelve el subproceso inicial sin ejecutar logica de negocio."""

    def __init__(self, *, api_key: str | None = None, model: str | None = None) -> None:
        self._chat = OpenAIChatClient(api_key=api_key, model=model)

    async def resolve(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
    ) -> V3ProcessSelection:
        started = time.perf_counter()
        fast_path = self._fast_path(message)
        if fast_path is not None:
            logger.info(
                "v3_selector_timing conversation_id=%s external_message_id=%s mode=%s process=%s total_ms=%s",
                message.conversation_id,
                message.external_message_id,
                fast_path.mode,
                fast_path.process_name,
                round((time.perf_counter() - started) * 1000, 3),
            )
            return fast_path

        if self._chat.is_configured:
            try:
                selection = await self._resolve_with_llm(message, context)
                logger.info(
                    "v3_selector_timing conversation_id=%s external_message_id=%s mode=%s process=%s total_ms=%s",
                    message.conversation_id,
                    message.external_message_id,
                    selection.mode,
                    selection.process_name,
                    round((time.perf_counter() - started) * 1000, 3),
                )
                return selection
            except Exception as exc:
                selection = V3ProcessSelection(
                    process_name=PROCESS_GENERAL,
                    mode="llm_fallback",
                    confidence=0.0,
                    reason=f"No se pudo clasificar con LLM: {exc}",
                )
                logger.info(
                    "v3_selector_timing conversation_id=%s external_message_id=%s mode=%s process=%s total_ms=%s",
                    message.conversation_id,
                    message.external_message_id,
                    selection.mode,
                    selection.process_name,
                    round((time.perf_counter() - started) * 1000, 3),
                )
                return selection

        selection = V3ProcessSelection(
            process_name=PROCESS_GENERAL,
            mode="fallback",
            confidence=0.0,
            reason="Sin fast_path y sin OPENAI_API_KEY configurada.",
        )
        logger.info(
            "v3_selector_timing conversation_id=%s external_message_id=%s mode=%s process=%s total_ms=%s",
            message.conversation_id,
            message.external_message_id,
            selection.mode,
            selection.process_name,
            round((time.perf_counter() - started) * 1000, 3),
        )
        return selection

    @staticmethod
    def _fast_path(message: V3InboundMessage) -> V3ProcessSelection | None:
        raw_text = str(message.text or "").strip().lower()
        if raw_text.startswith(("parte_fecha:", "parte_accion:")) or _looks_like_date_list_reply(raw_text):
            return V3ProcessSelection(
                PROCESS_PARTE_DIARIO,
                "fast_path",
                1.0,
                "Respuesta interactiva de parte diario.",
            )

        text = _normalize(message.text)
        if not text:
            return V3ProcessSelection(PROCESS_GENERAL, "fast_path", 1.0, "Mensaje sin texto.")

        if "parte diario" in text or "partes diarios" in text or "asistencia" in text:
            return V3ProcessSelection(PROCESS_PARTE_DIARIO, "fast_path", 0.9, "Referencia clara a parte diario.")

        if "pedido" in text and ("material" in text or "obra" in text):
            return V3ProcessSelection(PROCESS_PEDIDO_OBRA, "fast_path", 0.9, "Referencia clara a pedido de obra.")

        if is_pure_greeting(message.text):
            return V3ProcessSelection(PROCESS_GENERAL, "fast_path", 0.95, "Saludo claro.")

        return None

    async def _resolve_with_llm(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
    ) -> V3ProcessSelection:
        system_prompt = (
            "Clasifica el mensaje inicial en un unico subproceso. "
            "No resuelvas la solicitud ni ejecutes comandos. "
            "Si el mensaje combina un saludo con un pedido de materiales, insumos, artefactos o equipos para obra, "
            "clasificalo como pedidoObra, no como general. "
            "Ejemplos: 'hola necesito 20 bolsas de cemento' => pedidoObra; "
            "'hola necesito 2 juegos de ducha' => pedidoObra. "
            "Procesos disponibles:\n"
            + "\n".join(f"- {name}: {description}" for name, description in PROCESS_CATALOG.items())
        )
        payload = {
            "conversation_id": context.conversation_id,
            "message_text": message.text or "",
        }
        started = time.perf_counter()

        raw = await self._chat.complete_json(
            system_prompt=system_prompt,
            user_content=json.dumps(payload, ensure_ascii=True),
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "v3_process_selection",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "process_name": {"type": "string", "enum": sorted(PROCESS_NAMES)},
                            "confidence": {"type": "number"},
                            "reason": {"type": "string"},
                        },
                        "required": ["process_name", "confidence", "reason"],
                    },
                },
            },
            max_tokens=120,
        )
        process_name = str(raw.get("process_name") or "")
        if process_name not in PROCESS_NAMES:
            raise ValueError("LLM devolvio un subproceso invalido")
        llm_ms = round((time.perf_counter() - started) * 1000, 3)
        logger.info(
            "v3_selector_llm_timing conversation_id=%s external_message_id=%s model=%s process=%s llm_ms=%s",
            message.conversation_id,
            message.external_message_id,
            self._chat.model,
            process_name,
            llm_ms,
        )
        return V3ProcessSelection(
            process_name=process_name,
            mode="llm",
            confidence=float(raw.get("confidence") or 0),
            reason=str(raw.get("reason") or ""),
        )


def _normalize(value: str | None) -> str:
    raw = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    raw = "".join(char for char in raw if not unicodedata.combining(char))
    raw = re.sub(r"[^a-z0-9\s]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _looks_like_date_list_reply(value: str) -> bool:
    return bool(re.match(r"^\d{1,2}/\d{1,2}/\d{4}(?:\s|$)", value.strip()))


default_process_selector = V3ProcessSelector()
