"""Subproceso mock para diagnosticar clasificacion LLM."""

from __future__ import annotations

import time
from datetime import datetime, UTC

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.processes.general.llm_client import GeneralLLMClient


def _fmt_dt(value: str | None) -> str:
    """Formatea un ISO string o datetime a HH:MM:SS (fecha si difiere del día actual)."""
    if not value:
        return "—"
    try:
        dt = datetime.fromisoformat(value) if isinstance(value, str) else value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        if dt.date() == now.date():
            return dt.strftime("%H:%M:%S")
        return dt.strftime("%d/%m %H:%M:%S")
    except Exception:
        return str(value)


class SubMockProcess:
    name = "sub_mock"

    def __init__(self, llm_client: GeneralLLMClient | None = None) -> None:
        self._llm = llm_client or GeneralLLMClient()

    def priority(self, ctx: TurnContext) -> int | None:
        if not ctx.message.contenido.strip().lower().startswith("mock"):
            return None
        return 10_000

    async def handle(self, ctx: TurnContext) -> TurnResult:
        started = time.perf_counter()
        recibido_at = _fmt_dt(ctx.message.fecha)
        try:
            llm_started = time.perf_counter()
            decision = await self._llm.interpret_turn(ctx.message.contenido)
            llm_ms = round((time.perf_counter() - llm_started) * 1000)
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started) * 1000)
            delivery_at = _fmt_dt(datetime.now(UTC).isoformat())
            return TurnResult(
                payload={
                    "type": "sub_mock_reply",
                    "reply_to_user": (
                        "SUB MOCK\n"
                        f"Mensaje recibido: {ctx.message.contenido}\n"
                        f"Recepcion: {recibido_at}\n"
                        f"Delivery: {delivery_at}\n"
                        f"Error LLM: {exc}\n"
                        f"Tiempo total proceso: {elapsed_ms} ms"
                    ),
                    "sub_mock": {
                        "status": "llm_error",
                        "recibido_at": recibido_at,
                        "delivery_at": delivery_at,
                        "llm_ms": elapsed_ms,
                        "process_ms": elapsed_ms,
                        "error": str(exc),
                    },
                },
                keep_active=False,
            )

        elapsed_ms = round((time.perf_counter() - started) * 1000)
        delivery_at = _fmt_dt(datetime.now(UTC).isoformat())
        intent = decision.type
        return TurnResult(
            payload={
                "type": "sub_mock_reply",
                "reply_to_user": (
                    "SUB MOCK\n"
                    f"Mensaje recibido: {ctx.message.contenido}\n"
                    f"Recepcion: {recibido_at}\n"
                    f"Delivery: {delivery_at}\n"
                    f"Intencion detectada por LLM: {intent}\n"
                    f"Tiempo LLM: {llm_ms} ms\n"
                    f"Tiempo total proceso: {elapsed_ms} ms"
                ),
                "sub_mock": {
                    "status": "ok",
                    "recibido_at": recibido_at,
                    "delivery_at": delivery_at,
                    "intent": intent,
                    "llm_ms": llm_ms,
                    "process_ms": elapsed_ms,
                },
            },
            keep_active=False,
        )
