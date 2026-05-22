"""Proceso pedido_obra.

Arquitectura:
1. El LLM interpreta el turno y devuelve operaciones estructuradas.
2. El executor local aplica operaciones, valida cierre y renderiza respuesta.
3. El orquestador persiste el estado conversacional.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
import re
import time
import unicodedata

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.core.state import JsonConversationStateStore
from agente.v2.processes.pedido_obra.executor import execute_plan
from agente.v2.processes.pedido_obra.llm_client import PedidoObraLLMClient
from agente.v2.processes.pedido_obra.models import ExecutionResult, PedidoOperation, PedidoState, TurnPlan


_STALE_MINUTES = 60
_PEDIDO_OBRA_STATE_DIR = Path(__file__).resolve().parents[2] / "core" / "state" / "pedido_obra_conversations"


class PedidoObraProcess:
    name = "pedido_obra"

    def __init__(self, llm_client: PedidoObraLLMClient | None = None) -> None:
        self._llm = llm_client or PedidoObraLLMClient()

    def priority(self, ctx: TurnContext) -> int | None:
        if not ctx.is_project:
            return None
        if ctx.active_process == self.name:
            return 100
        return 50

    async def handle(self, ctx: TurnContext) -> TurnResult:
        started = time.perf_counter()
        state = PedidoState.from_dict(ctx.process_state, oportunidad_id=ctx.oportunidad_id)

        if state.tiene_pedido_activo() and _is_stale(state) and state.esperando != "decision_pedido_previo":
            state.esperando = "decision_pedido_previo"
            state.touch()

        fast_plan = _missing_quantity_fast_plan(ctx.message.contenido, state)
        fast_path = "missing_quantity_number" if fast_plan is not None else None
        if fast_plan is None:
            command_fast_plan = _command_fast_plan(ctx.message.contenido, state)
            if command_fast_plan is not None:
                fast_plan, fast_path = command_fast_plan

        if fast_plan is not None:
            executor_started = time.perf_counter()
            result = execute_plan(state, fast_plan)
            executor_ms = round((time.perf_counter() - executor_started) * 1000)
            total_ms = round((time.perf_counter() - started) * 1000)
            return _to_turn_result(
                result,
                ctx,
                plan=fast_plan,
                executor_ms=executor_ms,
                process_ms=total_ms,
                extra_metadata={"fast_path": fast_path},
            )

        try:
            plan = await self._llm.interpret_turn(ctx.message.contenido, state)
        except Exception as exc:
            result = ExecutionResult(
                status="llm_error",
                next_state=state,
                reply=f"No pude procesar el pedido ahora: {exc}",
                keep_active=state.tiene_pedido_activo(),
                used_llm=True,
            )
            return _to_turn_result(result, ctx)

        executor_started = time.perf_counter()
        result = execute_plan(state, plan)
        executor_ms = round((time.perf_counter() - executor_started) * 1000)
        total_ms = round((time.perf_counter() - started) * 1000)
        return _to_turn_result(result, ctx, plan=plan, executor_ms=executor_ms, process_ms=total_ms)


def _is_stale(state: PedidoState) -> bool:
    try:
        last_update = datetime.fromisoformat(state.updated_at)
        if last_update.tzinfo is None:
            last_update = last_update.replace(tzinfo=UTC)
        return datetime.now(UTC) - last_update > timedelta(minutes=_STALE_MINUTES)
    except (TypeError, ValueError):
        return False


def _missing_quantity_fast_plan(text: str | None, state: PedidoState) -> TurnPlan | None:
    if state.esperando != "cantidad_faltante":
        return None
    if state.item_cantidad_idx is None or not (0 <= state.item_cantidad_idx < len(state.items)):
        return None
    quantity = _parse_single_quantity_response(text)
    if quantity is None:
        return None
    return TurnPlan(
        operations=[PedidoOperation(type="answer_missing_quantity", cantidad=quantity)],
        raw_response={"fast_path": "missing_quantity_number", "cantidad": quantity},
        llm_ms=0,
    )


_FINISH_COMMANDS = {
    "listo",
    "cerrar",
    "terminamos",
    "terminar",
    "finalizar",
    "finalizo",
    "termine",
    "ya esta",
    "nada mas",
    "eso es todo",
    "listo gracias",
}
_CONFIRM_COMMANDS = {"confirmar", "confirmo", "si", "ok", "dale"}
_PRE_CONFIRMATION_COMMANDS = {"confirmar", "confirmo"}


def _command_fast_plan(text: str | None, state: PedidoState) -> tuple[TurnPlan, str] | None:
    if state.etapa == "finalizado" or state.esperando in {"cantidad_faltante", "decision_pedido_previo"}:
        return None

    command = _normalize_command_text(text)
    if not command:
        return None

    if state.esperando == "confirmacion_cierre" and command in _CONFIRM_COMMANDS:
        fast_path = "command_confirm_order"
        return (
            TurnPlan(
                operations=[PedidoOperation(type="confirm_order")],
                raw_response={"fast_path": fast_path, "command": command},
                llm_ms=0,
            ),
            fast_path,
        )

    if command in _FINISH_COMMANDS or command in _PRE_CONFIRMATION_COMMANDS:
        fast_path = "command_finish_order"
        return (
            TurnPlan(
                operations=[PedidoOperation(type="finish_order")],
                raw_response={"fast_path": fast_path, "command": command},
                llm_ms=0,
            ),
            fast_path,
        )

    return None


def _normalize_command_text(text: str | None) -> str:
    if not text:
        return ""
    value = unicodedata.normalize("NFKD", text.strip().lower())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9\s]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _parse_single_quantity_response(text: str | None) -> float | None:
    value = _normalize_quantity_text(text)
    if not value:
        return None

    if re.fullmatch(r"\d+(?:[.,]\d+)?", value):
        quantity = float(value.replace(",", "."))
        return quantity if quantity > 0 else None

    if not re.fullmatch(r"[a-z ]+", value):
        return None

    quantity = _parse_spanish_integer_words(value.split())
    if quantity is None or quantity <= 0:
        return None
    return float(quantity)


def _normalize_quantity_text(text: str | None) -> str:
    if not text:
        return ""
    value = unicodedata.normalize("NFKD", text.strip().lower())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9,.\s]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


_WORD_UNITS = {
    "un": 1,
    "uno": 1,
    "una": 1,
    "dos": 2,
    "tres": 3,
    "cuatro": 4,
    "cinco": 5,
    "seis": 6,
    "siete": 7,
    "ocho": 8,
    "nueve": 9,
}
_WORD_0_TO_29 = {
    "cero": 0,
    **_WORD_UNITS,
    "diez": 10,
    "once": 11,
    "doce": 12,
    "trece": 13,
    "catorce": 14,
    "quince": 15,
    "dieciseis": 16,
    "diecisiete": 17,
    "dieciocho": 18,
    "diecinueve": 19,
    "veinte": 20,
    "veintiuno": 21,
    "veintiuna": 21,
    "veintidos": 22,
    "veintitres": 23,
    "veinticuatro": 24,
    "veinticinco": 25,
    "veintiseis": 26,
    "veintisiete": 27,
    "veintiocho": 28,
    "veintinueve": 29,
}
_WORD_TENS = {
    "treinta": 30,
    "cuarenta": 40,
    "cincuenta": 50,
    "sesenta": 60,
    "setenta": 70,
    "ochenta": 80,
    "noventa": 90,
}


def _parse_spanish_integer_words(tokens: list[str]) -> int | None:
    if len(tokens) == 1:
        token = tokens[0]
        if token in _WORD_0_TO_29:
            return _WORD_0_TO_29[token]
        if token in _WORD_TENS:
            return _WORD_TENS[token]
        if token == "cien":
            return 100
        return None

    if len(tokens) == 3 and tokens[1] == "y":
        tens = _WORD_TENS.get(tokens[0])
        unit = _WORD_UNITS.get(tokens[2])
        if tens is not None and unit is not None:
            return tens + unit

    return None


def _to_turn_result(
    result: ExecutionResult,
    ctx: TurnContext,
    *,
    plan: TurnPlan | None = None,
    executor_ms: int | None = None,
    process_ms: int | None = None,
    extra_metadata: dict[str, Any] | None = None,
) -> TurnResult:
    metadata = {
        "status": result.status,
        "operations": result.applied_operations,
    }
    if plan is not None:
        metadata["llm_operations"] = [operation.type for operation in plan.operations]
        metadata["llm_raw"] = plan.raw_response
        metadata["llm_ms"] = plan.llm_ms
    if executor_ms is not None:
        metadata["executor_ms"] = executor_ms
    if process_ms is not None:
        metadata["process_ms"] = process_ms
    if extra_metadata:
        metadata.update(extra_metadata)

    return _build_turn_result(
        reply=result.reply,
        next_state=result.next_state,
        keep_active=result.keep_active,
        ctx=ctx,
        pedido_listo=result.pedido_listo,
        metadata=metadata,
    )


def _build_turn_result(
    reply: str,
    next_state: PedidoState,
    keep_active: bool,
    ctx: TurnContext,
    pedido_listo: bool = False,
    metadata: dict[str, Any] | None = None,
) -> TurnResult:
    payload: dict[str, Any] = {
        "type": "pedido_obra_reply",
        "reply_to_user": reply,
        "oportunidad_id": ctx.oportunidad_id,
        "pedido_listo": pedido_listo,
        "items": [item.to_dict() for item in next_state.items],
        "etapa": next_state.etapa,
        "esperando": next_state.esperando,
    }
    if metadata:
        payload["pedido_obra"] = metadata

    return TurnResult(
        payload=payload,
        keep_active=keep_active,
        process_state=next_state.to_dict(),
    )


def build_pedido_obra_dependencies(*, session=None):
    """Construye dependencias del proceso pedido_obra."""
    if session is not None:
        from agente.v2.db.stores import DbConversationStateStore

        state_store = DbConversationStateStore(session)
    else:
        state_store = JsonConversationStateStore(root_dir=_PEDIDO_OBRA_STATE_DIR)

    return state_store, PedidoObraProcess()
