"""
Dispatcher del proceso pedido_obra.

Implementa el contrato AgentProcess:
  - priority(ctx) → int | None
  - handle(ctx) → TurnResult
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.core.state import JsonConversationStateStore
from agente.v2.processes.pedido_obra.llm_client import PedidoObraLLMClient
from agente.v2.processes.pedido_obra.models import NodeResult, PedidoState
from agente.v2.processes.pedido_obra.nodes import carga as nodo_carga
from agente.v2.processes.pedido_obra.nodes import confirmacion as nodo_confirmacion
from agente.v2.processes.pedido_obra.nodes import inicial as nodo_inicial
from agente.v2.processes.pedido_obra.parser import parse_message

# Un pedido sin actividad por más de este tiempo se considera "stale"
_STALE_MINUTES = 60
_PEDIDO_OBRA_STATE_DIR = Path(__file__).resolve().parents[2] / "core" / "state" / "pedido_obra_conversations"

# Palabras/patrones que disparan este proceso en etapa inicial
_TRIGGER_WORDS = re.compile(
    r"\b(limpiar|limpia|cancelar|cancela|cancelado|mostrar|mostra|lista|listar|que\s+tenes?)\b|"
    r"\b(necesito|mandam[ée]|pedir?|quiero|faltan?|agreg[áa]|pone[me]|sac[áa])\b"
    r"|\b\d+(?:[.,]\d+)?\s*(bolsas?|bolson|barras?|m3|metros?|mts?|kg|litros?|unidades?|rollos?|latas?)\b",
    re.IGNORECASE,
)


class PedidoObraProcess:
    """Proceso para tomar pedidos de materiales de obra por mensajería."""

    name = "pedido_obra"

    def __init__(self, llm_client: PedidoObraLLMClient | None = None) -> None:
        self._llm = llm_client or PedidoObraLLMClient()

    # ------------------------------------------------------------------
    # Prioridad
    # ------------------------------------------------------------------

    def priority(self, ctx: TurnContext) -> int | None:
        """
        Devuelve la prioridad del proceso para este turno:
        - Si ya somos el proceso activo: siempre podemos manejar (base 100)
        - Si hay palabras clave de materiales: base 50
        - Si ninguno: None
        """
        if not ctx.is_project:
            return None

        if ctx.active_process == self.name:
            return 100

        mensaje = ctx.message.contenido
        if _TRIGGER_WORDS.search(mensaje):
            return 50

        return None

    # ------------------------------------------------------------------
    # Handle
    # ------------------------------------------------------------------

    async def handle(self, ctx: TurnContext) -> TurnResult:
        oportunidad_id = ctx.oportunidad_id
        mensaje = ctx.message.contenido

        state = PedidoState.from_dict(
            ctx.process_state,
            oportunidad_id=oportunidad_id,
        )

        # ---------------------------------------------------------------
        # Mundo C: detectar pedido previo "stale"
        # ---------------------------------------------------------------
        if state.tiene_pedido_activo() and _is_stale(state):
            return _ask_decision_pedido_previo(state, ctx)

        if state.esperando == "decision_pedido_previo":
            return _handle_decision_pedido_previo(state, mensaje, ctx)

        # ---------------------------------------------------------------
        # Despacho por etapa
        # ---------------------------------------------------------------
        result = await _dispatch(state, mensaje, self._llm)

        # redirect: el nodo confirmacion puede pedir que reejecute en carga
        if result._redirect == "carga":
            new_state = result.next_state
            result = await nodo_carga.run(new_state, mensaje, self._llm)

        return _to_turn_result(result, ctx)


# ---------------------------------------------------------------------------
# Dispatch por etapa
# ---------------------------------------------------------------------------

async def _dispatch(
    state: PedidoState,
    mensaje: str,
    llm: PedidoObraLLMClient,
) -> NodeResult:
    etapa = state.etapa

    if etapa in ("inicial", "finalizado"):
        return await nodo_inicial.run(state, mensaje, llm)

    if etapa == "carga":
        return await nodo_carga.run(state, mensaje, llm)

    if etapa == "confirmacion":
        return nodo_confirmacion.run(state, mensaje)

    # fallback seguro
    return await nodo_inicial.run(state, mensaje, llm)


# ---------------------------------------------------------------------------
# Mundo C — stale detection
# ---------------------------------------------------------------------------

def _is_stale(state: PedidoState) -> bool:
    try:
        last_update = datetime.fromisoformat(state.updated_at)
        if last_update.tzinfo is None:
            last_update = last_update.replace(tzinfo=UTC)
        return datetime.now(UTC) - last_update > timedelta(minutes=_STALE_MINUTES)
    except (ValueError, TypeError):
        return False


def _ask_decision_pedido_previo(state: PedidoState, ctx: TurnContext) -> TurnResult:
    new_state = PedidoState.from_dict(state.to_dict(), oportunidad_id=ctx.oportunidad_id)
    new_state.esperando = "decision_pedido_previo"
    new_state.touch()
    resumen = state.resumen_items()
    reply = (
        f"Tenés un pedido previo sin finalizar:\n{resumen}\n\n"
        "¿Querés *continuar* con ese pedido o *empezar* uno nuevo?"
    )
    return _build_turn_result(
        reply=reply,
        next_state=new_state,
        keep_active=True,
        ctx=ctx,
    )


def _handle_decision_pedido_previo(
    state: PedidoState,
    mensaje: str,
    ctx: TurnContext,
) -> TurnResult:
    parsed = parse_message(mensaje)
    texto = mensaje.lower().strip()

    continuar = any(w in texto for w in ("continu", "seguir", "si", "sí", "ese", "mismo"))
    nuevo = any(w in texto for w in ("nuevo", "empezar", "otro", "borrar", "no"))

    if continuar and not nuevo:
        new_state = PedidoState.from_dict(state.to_dict(), oportunidad_id=ctx.oportunidad_id)
        new_state.esperando = None
        new_state.touch()
        resumen = new_state.resumen_items()
        reply = f"De acuerdo, continuamos con el pedido anterior:\n{resumen}\n\nPodés agregar, quitar o confirmar."
        return _build_turn_result(reply=reply, next_state=new_state, keep_active=True, ctx=ctx)

    if nuevo:
        new_state = PedidoState.empty(ctx.oportunidad_id)
        reply = "Empezamos un pedido nuevo. Decime qué materiales necesitás."
        return _build_turn_result(reply=reply, next_state=new_state, keep_active=True, ctx=ctx)

    # Respuesta ambigua
    resumen = state.resumen_items()
    reply = (
        f"No entendí bien. El pedido anterior tiene:\n{resumen}\n\n"
        "Respondé *continuar* para retomarlo o *nuevo* para empezar uno nuevo."
    )
    return _build_turn_result(reply=reply, next_state=state, keep_active=True, ctx=ctx)


# ---------------------------------------------------------------------------
# Helpers de conversión TurnResult
# ---------------------------------------------------------------------------

def _to_turn_result(result: NodeResult, ctx: TurnContext) -> TurnResult:
    return _build_turn_result(
        reply=result.reply or "",
        next_state=result.next_state,
        keep_active=result.keep_active,
        ctx=ctx,
        pedido_listo=result.pedido_listo,
    )


def _build_turn_result(
    reply: str,
    next_state: PedidoState,
    keep_active: bool,
    ctx: TurnContext,
    pedido_listo: bool = False,
) -> TurnResult:
    payload: dict[str, Any] = {
        "type": "pedido_obra_reply",
        "reply_to_user": reply,
        "oportunidad_id": ctx.oportunidad_id,
        "pedido_listo": pedido_listo,
        "items": [it.to_dict() for it in next_state.items],
        "etapa": next_state.etapa,
        "esperando": next_state.esperando,
    }

    return TurnResult(
        payload=payload,
        keep_active=keep_active,
        process_state=next_state.to_dict(),
    )


def build_pedido_obra_dependencies(*, session=None):
    """Construye las dependencias del proceso pedido_obra."""
    if session is not None:
        from agente.v2.db.stores import DbConversationStateStore

        state_store = DbConversationStateStore(session)
    else:
        state_store = JsonConversationStateStore(root_dir=_PEDIDO_OBRA_STATE_DIR)

    return state_store, PedidoObraProcess()
