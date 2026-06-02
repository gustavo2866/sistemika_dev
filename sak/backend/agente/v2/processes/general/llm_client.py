"""Cliente LLM estructurado para clasificar turnos generales."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError

from agente.v2.processes.general.models import GENERAL_INTENTS, GeneralDecision


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

GENERAL_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "general_turn_intent",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "type": {
                    "type": "string",
                    "enum": sorted(GENERAL_INTENTS),
                },
            },
            "required": ["type"],
        },
    },
}


class GeneralLLMClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = None

    async def interpret_turn(self, mensaje: str) -> GeneralDecision:
        prompt = (PROMPTS_DIR / "interpretar_intencion.txt").read_text(encoding="utf-8").strip()
        raw = await self._call(prompt, mensaje)
        return self._parse(raw)

    async def _call(self, system_prompt: str, mensaje: str) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
                response_format=GENERAL_RESPONSE_FORMAT,
                max_tokens=100,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": mensaje},
                ],
            )
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY invalida") from exc
        except APIStatusError as exc:
            raise ValueError(f"OpenAI error HTTP {exc.status_code}") from exc

        message = completion.choices[0].message
        if getattr(message, "refusal", None):
            raise ValueError("LLM rechazo la clasificacion")
        content = (message.content or "").strip()
        if not content:
            raise ValueError("LLM no devolvio contenido")
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError("LLM no devolvio JSON valido") from exc
        if not isinstance(parsed, dict):
            raise ValueError("LLM debe devolver un objeto JSON")
        return parsed

    @staticmethod
    def _parse(raw: dict[str, Any]) -> GeneralDecision:
        intent = str(raw.get("type") or "").strip()
        if intent not in GENERAL_INTENTS:
            raise ValueError("LLM devolvio una intencion general invalida")
        return GeneralDecision(type=intent)  # type: ignore[arg-type]
