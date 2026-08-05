"""Cliente comun para llamadas OpenAI Chat en agente v3."""

from __future__ import annotations

import json
import os
from typing import Any

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError


class OpenAIChatClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        client: AsyncOpenAI | None = None,
    ) -> None:
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = client

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def clone(self, *, model: str | None = None) -> "OpenAIChatClient":
        return OpenAIChatClient(
            api_key=self.api_key,
            model=model or self.model,
            client=self._client,
        )

    async def complete_json(
        self,
        *,
        system_prompt: str,
        response_format: dict[str, Any],
        user_content: str = "Interpreta el turno y responde solo JSON.",
        max_tokens: int = 1000,
    ) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
                response_format=response_format,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
            )
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY invalida") from exc
        except APIStatusError as exc:
            response_text = str(getattr(exc, "response", "") or "").strip()
            body = getattr(exc, "body", None)
            detail = body if body is not None else response_text
            raise ValueError(f"OpenAI error HTTP {exc.status_code}: {detail}") from exc

        message = completion.choices[0].message
        refusal = getattr(message, "refusal", None)
        if refusal:
            raise ValueError("LLM rechazo interpretar el turno")

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
