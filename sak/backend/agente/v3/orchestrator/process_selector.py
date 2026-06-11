"""Selector de subproceso inicial para agente v3."""

from __future__ import annotations

import json
import os
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError

from agente.v3.contracts import V3ConversationContext, V3InboundMessage


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
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = None

    async def resolve(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
    ) -> V3ProcessSelection:
        fast_path = self._fast_path(message)
        if fast_path is not None:
            return fast_path

        if self.api_key:
            try:
                return await self._resolve_with_llm(message, context)
            except Exception as exc:
                return V3ProcessSelection(
                    process_name=PROCESS_GENERAL,
                    mode="llm_fallback",
                    confidence=0.0,
                    reason=f"No se pudo clasificar con LLM: {exc}",
                )

        return V3ProcessSelection(
            process_name=PROCESS_GENERAL,
            mode="fallback",
            confidence=0.0,
            reason="Sin fast_path y sin OPENAI_API_KEY configurada.",
        )

    @staticmethod
    def _fast_path(message: V3InboundMessage) -> V3ProcessSelection | None:
        text = _normalize(message.text)
        if not text:
            return V3ProcessSelection(PROCESS_GENERAL, "fast_path", 1.0, "Mensaje sin texto.")

        if re.fullmatch(r"(hola|buen dia|buenas|buenas tardes|buenas noches)(\s+.*)?", text):
            return V3ProcessSelection(PROCESS_GENERAL, "fast_path", 0.95, "Saludo claro.")

        if "parte diario" in text or "asistencia" in text:
            return V3ProcessSelection(PROCESS_PARTE_DIARIO, "fast_path", 0.9, "Referencia clara a parte diario.")

        if "pedido" in text and ("material" in text or "obra" in text):
            return V3ProcessSelection(PROCESS_PEDIDO_OBRA, "fast_path", 0.9, "Referencia clara a pedido de obra.")

        return None

    async def _resolve_with_llm(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
    ) -> V3ProcessSelection:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        system_prompt = (
            "Clasifica el mensaje inicial en un unico subproceso. "
            "No resuelvas la solicitud ni ejecutes comandos. "
            "Procesos disponibles:\n"
            + "\n".join(f"- {name}: {description}" for name, description in PROCESS_CATALOG.items())
        )
        payload = {
            "conversation_id": context.conversation_id,
            "message_text": message.text or "",
        }

        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
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
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=True)},
                ],
            )
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY invalida") from exc
        except APIStatusError as exc:
            raise ValueError(f"OpenAI error HTTP {exc.status_code}") from exc

        content = (completion.choices[0].message.content or "").strip()
        if not content:
            raise ValueError("LLM no devolvio contenido")
        raw = json.loads(content)
        process_name = str(raw.get("process_name") or "")
        if process_name not in PROCESS_NAMES:
            raise ValueError("LLM devolvio un subproceso invalido")
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


default_process_selector = V3ProcessSelector()

