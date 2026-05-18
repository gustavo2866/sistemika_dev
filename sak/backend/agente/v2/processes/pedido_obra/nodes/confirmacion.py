"""Nodo de confirmación: valida cierre y confirma el pedido."""

from __future__ import annotations

from agente.v2.processes.pedido_obra.models import NodeResult, PedidoState
from agente.v2.processes.pedido_obra.parser import parse_message


def run(state: PedidoState, mensaje: str) -> NodeResult:
    """
    Etapa final:
    - Si faltan cantidades, delega al nodo de carga para completar una por una.
    - Si el usuario confirma/cierra, finaliza.
    - Si agrega/cambia/quita, vuelve a carga con el mismo mensaje.
    """
    if state.esperando == "cantidad_faltante":
        return NodeResult(
            reply=None,
            next_state=state,
            keep_active=True,
            _redirect="carga",
        )

    parsed = parse_message(mensaje)
    texto = parsed.raw_text.lower().strip()

    if parsed.intent in ("confirmar", "cierre") and parsed.confidence == "high":
        return _confirmar(state)

    if parsed.intent == "cancelar" and parsed.confidence == "high":
        if texto == "no":
            return _volver_a_carga(state)
        return _cancelar(state)

    if "cancel" in texto:
        return _cancelar(state)

    if parsed.intent in (
        "item",
        "comando_quitar",
        "comando_limpiar",
        "comando_mostrar",
        "comando_modificar",
        "cantidad",
    ):
        new_state = _copy_state(state)
        new_state.etapa = "carga"
        new_state.esperando = None
        new_state.touch()
        return NodeResult(
            reply=None,
            next_state=new_state,
            keep_active=True,
            _redirect="carga",
        )

    resumen = state.resumen_items()
    return NodeResult(
        reply=(
            f"Pedido para confirmar:\n{resumen}\n\n"
            "Respondé *confirmar* para enviarlo, *cancelar* para descartarlo, o decime qué cambiar."
        ),
        next_state=state,
        keep_active=True,
    )


def _confirmar(state: PedidoState) -> NodeResult:
    faltantes = state.items_sin_cantidad()
    if faltantes:
        new_state = _copy_state(state)
        idx = next(i for i, it in enumerate(new_state.items) if it.item_id == faltantes[0].item_id)
        new_state.esperando = "cantidad_faltante"
        new_state.item_cantidad_idx = idx
        new_state.touch()
        return NodeResult(
            reply=f"Antes de confirmar, ¿qué cantidad de {faltantes[0].descripcion} necesitás?",
            next_state=new_state,
            keep_active=True,
        )

    new_state = _copy_state(state)
    new_state.etapa = "finalizado"
    new_state.esperando = None
    new_state.comando_pendiente = None
    new_state.item_cantidad_idx = None
    new_state.touch()
    resumen = new_state.resumen_items()
    return NodeResult(
        reply=f"Pedido confirmado:\n{resumen}\n\nLo vamos a gestionar.",
        next_state=new_state,
        keep_active=False,
        pedido_listo=True,
    )


def _cancelar(state: PedidoState) -> NodeResult:
    return NodeResult(
        reply="Pedido cancelado. Cuando necesites, escribime.",
        next_state=PedidoState.empty(state.oportunidad_id),
        keep_active=False,
    )


def _volver_a_carga(state: PedidoState) -> NodeResult:
    new_state = _copy_state(state)
    new_state.etapa = "carga"
    new_state.esperando = None
    new_state.comando_pendiente = None
    new_state.item_cantidad_idx = None
    new_state.touch()
    return NodeResult(
        reply=f"Seguimos editando.\n\nPedido actual:\n{new_state.resumen_items()}",
        next_state=new_state,
        keep_active=True,
    )


def _copy_state(state: PedidoState) -> PedidoState:
    return PedidoState.from_dict(state.to_dict(), oportunidad_id=state.oportunidad_id)
