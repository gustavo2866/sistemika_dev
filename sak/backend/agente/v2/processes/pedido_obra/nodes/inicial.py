"""Nodo inicial: identifica intención y abre la carga del pedido."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from agente.v2.processes.pedido_obra.models import NodeResult, PedidoItem, PedidoState
from agente.v2.processes.pedido_obra.parser import ParseResult, parse_message

if TYPE_CHECKING:
    from agente.v2.processes.pedido_obra.llm_client import PedidoObraLLMClient


async def run(
    state: PedidoState,
    mensaje: str,
    llm: "PedidoObraLLMClient",
) -> NodeResult:
    """
    Etapa inicial:
    - Si detecta materiales, crea el pedido y explica reglas mínimas.
    - Si detecta comandos/cierre sin pedido activo, responde corto y libera proceso.
    - Si no entiende, usa LLM para clasificar.
    """
    parsed = parse_message(mensaje)

    if parsed.confidence == "high":
        if parsed.intent == "item" and parsed.items:
            return _crear_pedido(state, parsed)

        if parsed.intent == "cierre":
            return NodeResult(
                reply="No hay un pedido activo. Para empezar, mandame los materiales que necesitás.",
                next_state=PedidoState.empty(state.oportunidad_id),
                keep_active=False,
            )

        if parsed.intent in (
            "confirmar",
            "cancelar",
            "cantidad",
            "comando_limpiar",
            "comando_mostrar",
            "comando_quitar",
            "comando_modificar",
        ):
            return NodeResult(
                reply="Por ahora no tenés ningún pedido activo. Mandame los materiales para empezar.",
                next_state=PedidoState.empty(state.oportunidad_id),
                keep_active=False,
            )

    try:
        llm_resp = await llm.clasificar_inicial(mensaje, state)
    except Exception:
        return NodeResult(
            reply="No pude entender el mensaje. Mandame los materiales que necesitás para la obra.",
            next_state=PedidoState.empty(state.oportunidad_id),
            keep_active=False,
            used_llm=True,
        )

    if llm_resp.categoria == "materiales" and llm_resp.items:
        return _crear_pedido_desde_llm(state, llm_resp.items)

    if llm_resp.categoria == "cierre":
        return NodeResult(
            reply=llm_resp.reply or "No hay un pedido activo. Mandame materiales para empezar uno.",
            next_state=PedidoState.empty(state.oportunidad_id),
            keep_active=False,
            used_llm=True,
        )

    if llm_resp.categoria == "comando":
        return NodeResult(
            reply="Todavía no hay un pedido activo. Primero mandame los materiales.",
            next_state=PedidoState.empty(state.oportunidad_id),
            keep_active=False,
            used_llm=True,
        )

    return NodeResult(
        reply=llm_resp.reply or "Soy el asistente de pedidos de obra. Mandame materiales con cantidad cuando puedas.",
        next_state=PedidoState.empty(state.oportunidad_id),
        keep_active=False,
        used_llm=True,
    )


def _crear_pedido(state: PedidoState, parsed: ParseResult) -> NodeResult:
    return _build_result(state, parsed.items)


def _crear_pedido_desde_llm(state: PedidoState, llm_items: list) -> NodeResult:
    return _build_result(state, llm_items, used_llm=True)


def _build_result(state: PedidoState, raw_items: list, *, used_llm: bool = False) -> NodeResult:
    new_state = PedidoState.empty(state.oportunidad_id)
    new_state.etapa = "carga"
    new_state.items = [
        PedidoItem(
            item_id=str(uuid.uuid4())[:8],
            descripcion=it.descripcion,
            cantidad=it.cantidad,
            unidad=it.unidad,
        )
        for it in raw_items
    ]
    new_state.touch()

    resumen = new_state.resumen_items()
    reply = (
        f"Anoté el pedido:\n{resumen}\n\n"
        "Podés agregar, cambiar o quitar materiales. Cuando termines, escribí *listo*."
    )
    return NodeResult(reply=reply, next_state=new_state, keep_active=True, used_llm=used_llm)
