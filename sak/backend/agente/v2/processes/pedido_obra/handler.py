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
import time

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.core.state import JsonConversationStateStore
from agente.v2.processes.pedido_obra.executor import execute_plan
from agente.v2.processes.pedido_obra.llm_client import PedidoObraLLMClient
from agente.v2.processes.pedido_obra.models import ExecutionResult, PedidoState, TurnPlan


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


def _to_turn_result(
    result: ExecutionResult,
    ctx: TurnContext,
    *,
    plan: TurnPlan | None = None,
    executor_ms: int | None = None,
    process_ms: int | None = None,
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
