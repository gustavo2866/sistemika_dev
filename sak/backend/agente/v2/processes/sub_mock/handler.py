"""Subproceso mock para diagnosticar clasificacion LLM."""

from __future__ import annotations

import time

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.processes.general.llm_client import GeneralLLMClient


class SubMockProcess:
    name = "sub_mock"

    def __init__(self, llm_client: GeneralLLMClient | None = None) -> None:
        self._llm = llm_client or GeneralLLMClient()

    def priority(self, ctx: TurnContext) -> int | None:
        return 10_000

    async def handle(self, ctx: TurnContext) -> TurnResult:
        started = time.perf_counter()
        try:
            llm_started = time.perf_counter()
            decision = await self._llm.interpret_turn(ctx.message.contenido)
            llm_ms = round((time.perf_counter() - llm_started) * 1000)
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started) * 1000)
            return TurnResult(
                payload={
                    "type": "sub_mock_reply",
                    "reply_to_user": (
                        "SUB MOCK\n"
                        f"Mensaje recibido: {ctx.message.contenido}\n"
                        f"Error LLM: {exc}\n"
                        f"Tiempo total proceso: {elapsed_ms} ms"
                    ),
                    "sub_mock": {
                        "status": "llm_error",
                        "llm_ms": elapsed_ms,
                        "process_ms": elapsed_ms,
                        "error": str(exc),
                    },
                },
                keep_active=False,
            )

        elapsed_ms = round((time.perf_counter() - started) * 1000)
        intent = decision.type
        return TurnResult(
            payload={
                "type": "sub_mock_reply",
                "reply_to_user": (
                    "SUB MOCK\n"
                    f"Mensaje recibido: {ctx.message.contenido}\n"
                    f"Intencion detectada por LLM: {intent}\n"
                    f"Tiempo LLM: {llm_ms} ms\n"
                    f"Tiempo total proceso: {elapsed_ms} ms"
                ),
                "sub_mock": {
                    "status": "ok",
                    "intent": intent,
                    "llm_ms": llm_ms,
                    "process_ms": elapsed_ms,
                },
            },
            keep_active=False,
        )
