"""Render de respuestas cortas para pedido_obra."""

from __future__ import annotations

from agente.v2.processes.pedido_obra.models import PedidoItem, PedidoState


def pedido_actual(state: PedidoState, *, previo: bool = False) -> str:
    titulo = "Pedido previo sin finalizar" if previo else "Pedido actual"
    return f"{titulo}:\n{state.resumen_items()}"


def anotado(state: PedidoState) -> str:
    return f"Anotado:\n{state.resumen_items()}\n\nCuando termines, escribi LISTO."


def actualizado(state: PedidoState) -> str:
    return f"Pedido abierto actualizado:\n{state.resumen_items()}\n\nCuando termines, escribi LISTO."


def pedido_previo(state: PedidoState) -> str:
    return (
        f"Tenes un pedido previo sin finalizar:\n{state.resumen_items()}\n\n"
        "Responde continuar para retomarlo o nuevo para empezar otro."
    )


def continuar_previo(state: PedidoState) -> str:
    return f"De acuerdo, continuamos con el pedido anterior:\n{state.resumen_items()}"


def empezar_nuevo(state: PedidoState) -> str:
    if state.items:
        return anotado(state)
    return "Empezamos un pedido nuevo. Decime que materiales necesitas."


def pedido_vacio() -> str:
    return "No hay materiales cargados. Mandame lo que necesitas para armar el pedido."


def pedido_limpiado() -> str:
    return "Borre los materiales del pedido. Mandame el pedido nuevo."


def pedir_cantidad(item: PedidoItem, *, antes_de_confirmar: bool = True) -> str:
    return f"Que cantidad de {item.descripcion} necesitas?"


def confirmar_pedido(state: PedidoState) -> str:
    return f"Pedido para confirmar:\n{state.resumen_items()}\n\nPara enviarlo, responde CONFIRMAR."


def pedido_confirmado(state: PedidoState) -> str:
    return (
        "*PEDIDO CONFIRMADO*\n"
        "━━━━━━━━━━━━━━\n\n"
        "*Materiales*\n"
        f"{_resumen_items_bullets(state)}"
    )


def pedido_cancelado() -> str:
    return "Pedido cancelado. Cuando necesites, escribime."


def offtopic(reply: str | None, state: PedidoState) -> str:
    if state.items:
        base = reply or "Decime que materiales necesitas o escribi LISTO para cerrar el pedido."
        return (
            f"{base}\n\n"
            f"Pedido abierto:\n{state.resumen_items()}\n\n"
            "Podes agregar materiales, cambiar algo, limpiar el pedido o escribir LISTO para cerrarlo."
        )
    return reply or "Decime que materiales necesitas."


def aclaracion(reply: str | None, state: PedidoState) -> str:
    if reply:
        return reply
    if state.items:
        return f"No entendi bien. Pedido actual:\n{state.resumen_items()}"
    return "No entendi bien. Mandame los materiales que necesitas."


def _resumen_items_bullets(state: PedidoState) -> str:
    if not state.items:
        return "• (lista vacia)"
    return "\n".join(f"• {item.resumen()}" for item in state.items)
