"""Respuestas de pedidoObra v3."""

from agente.v3.subprocesses.pedido_obra.state import PedidoObraItem, PedidoObraState


def carga_actualizada(state: PedidoObraState) -> str:
    return f"Pedido en carga:\n{state.resumen_items()}\n\nOpciones: 1:FIN 2:SALIR."


def obra_seleccionada(state: PedidoObraState) -> str:
    return "Obra seleccionada. Envia los materiales del pedido.\n\nOpciones: 1:FIN 2:SALIR."


def seleccionar_obra(state: PedidoObraState) -> str:
    options = "\n".join(f"{option.opcion}: {option.nombre}" for option in state.opciones_obra)
    return f"Tenes mas de una obra asociada. Indica la obra para este pedido:\n{options}"


def obra_no_encontrada() -> str:
    return "No encontre una obra asociada a tu telefono para cargar el pedido."


def carga_sin_cambios() -> str:
    return "No pude identificar materiales. Envia la lista o usa FIN / SALIR."


def pedir_confirmacion_salida(state: PedidoObraState) -> str:
    return (
        "Si salis se perderan los cambios del pedido en carga.\n"
        f"{state.resumen_items()}\n\n"
        "Opciones: VOLVER o CONFIRMAR."
    )


def salida_cancelada(state: PedidoObraState) -> str:
    return f"Volvemos a la carga del pedido:\n{state.resumen_items()}\n\nOpciones: 1:FIN 2:SALIR."


def pedido_descartado() -> str:
    return "Pedido descartado. Cuando necesites, podes iniciar otro pedido."


def pedido_vacio() -> str:
    return "No hay materiales cargados para validar. Envia materiales o usa SALIR."


def pedir_cantidad(item: PedidoObraItem) -> str:
    return f"Indica cantidad de {item.descripcion}."


def cierre_pedido(state: PedidoObraState) -> str:
    return f"Pedido validado:\n{state.resumen_items()}\n\nOpciones: 1:CONFIRMAR 2:VOLVER 3:SALIR."


def confirmado(state: PedidoObraState, pedido_id: int | None = None) -> str:
    pedido_line = f"Pedido #{pedido_id}\n" if pedido_id is not None else ""
    return (
        "*PEDIDO CONFIRMADO*\n"
        f"{pedido_line}"
        "____________________\n\n"
        "*Materiales*\n"
        f"{_resumen_items_confirmados(state)}"
    )


def error_confirmacion() -> str:
    return "No pude guardar el pedido confirmado. Intenta confirmar nuevamente en unos segundos."


def comando_invalido(etapa: str) -> str:
    if etapa == "confirmar_salida":
        return "Responde VOLVER para continuar la carga o CONFIRMAR para descartar el pedido."
    if etapa == "inicial":
        return "Responde con el numero de obra para este pedido."
    if etapa == "cierre":
        return "Responde 1:CONFIRMAR 2:VOLVER 3:SALIR."
    return "No entendi la respuesta. Continua con el dato solicitado o usa SALIR."


def _resumen_items_confirmados(state: PedidoObraState) -> str:
    if not state.items:
        return "- (sin materiales)"
    return "\n".join(f"- {item.resumen()}" for item in state.items)
