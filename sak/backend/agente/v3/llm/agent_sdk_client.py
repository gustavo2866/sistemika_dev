"""Wrapper reutilizable para OpenAI Agent SDK."""

from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel


class AgentSDKClient:
    """Ejecuta un Agent SDK con import lazy y salida estructurada."""

    def __init__(
        self,
        *,
        name: str,
        instructions: str,
        output_type: type[BaseModel],
        model: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.name = name
        self.instructions = instructions
        self.output_type = output_type
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self.api_key = (api_key or os.getenv("OPENAI_API_KEY") or "").strip() or None
        self._agent = None

    async def run(self, input: str) -> BaseModel:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY no configurada")

        Agent, Runner = _load_agents_sdk()
        if self._agent is None:
            self._agent = Agent(
                name=self.name,
                model=self.model,
                instructions=self.instructions,
                output_type=self.output_type,
            )

        result = await Runner.run(self._agent, input=input)
        return self._coerce_output(result.final_output)

    def _coerce_output(self, raw: Any) -> BaseModel:
        if isinstance(raw, self.output_type):
            return raw
        if isinstance(raw, dict):
            return self.output_type.model_validate(raw)
        if isinstance(raw, str):
            return self.output_type.model_validate_json(raw)
        return self.output_type.model_validate(raw)


def _load_agents_sdk():
    try:
        from agents import Agent, Runner
    except ImportError as exc:
        raise RuntimeError("openai-agents no esta instalado") from exc
    return Agent, Runner
