"""Respuestas de pedidoObra v3."""

from datetime import datetime

from agente.v3.subprocesses.pedido_obra.state import PedidoObraItem, PedidoObraPedidoOption, PedidoObraState


LOAD_MENU = "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR."
READONLY_FOOTER = "El pedido no se puede modificar 3:SALIR"


def carga_actualizada(state: PedidoObraState) -> str:
    return f"Pedido en carga:\n{state.resumen_items()}\n\n{LOAD_MENU}"


def obra_seleccionada(state: PedidoObraState) -> str:
    return f"Obra seleccionada. Envia los materiales del pedido.\n\n{LOAD_MENU}"


def menu_pedidos(options: list[PedidoObraPedidoOption], *, prefix: str | None = None) -> str:
    lines: list[str] = []
    if prefix:
        lines.append(prefix)
        lines.append("")
    lines.append("Selecciona el pedido de obra:")
    if options:
        lines.extend(_format_pedido_option(option) for option in options)
    else:
        lines.append("(sin pedidos)")
    lines.append("Responde con el numero de un pedido, NUEVO o SALIR para volver al menu general.")
    return "\n".join(lines)


def _format_pedido_option(option: PedidoObraPedidoOption) -> str:
    date_label = _format_datetime_date(option.created_at)
    return f"{option.opcion}: Pedido #{option.pedido_id} {date_label} ({option.estado})"


def _format_datetime_date(value: str | None) -> str:
    if not value:
        return "sin fecha"
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return value[:10]
    return parsed.strftime("%d/%m/%Y")


def seleccionar_obra(state: PedidoObraState) -> str:
    options = "\n".join(f"{option.opcion}: {option.nombre}" for option in state.opciones_obra)
    return f"Tenes mas de una obra asociada. Indica la obra para este pedido:\n{options}"


def obra_no_encontrada() -> str:
    return "No encontre una obra asociada a tu telefono para cargar el pedido."


def carga_sin_cambios() -> str:
    return "No pude identificar materiales. Envia la lista o usa GUARDAR / CERRAR / SALIR."


def pedir_confirmacion_salida(state: PedidoObraState) -> str:
    return "Se perderan los cambios no guardados.\n\nOpciones: 1:OK 2:VOLVER."


def salida_cancelada(state: PedidoObraState) -> str:
    return f"Volvemos a la carga del pedido:\n{state.resumen_items()}\n\n{LOAD_MENU}"


def pedido_descartado() -> str:
    return "Pedido descartado. Cuando necesites, podes iniciar otro pedido."


def pedido_vacio() -> str:
    return "No hay materiales cargados. Envia materiales o usa SALIR."


def pedido_borrador_recuperado(state: PedidoObraState) -> str:
    return f"Pedido borrador recuperado:\n{state.resumen_items()}\n\n{LOAD_MENU}"


def consulta_pedido(pedido_id: int, estado: str, items: list[PedidoObraItem]) -> str:
    summary = _resumen_items(items)
    return f"Pedido #{pedido_id} ({estado}):\n{summary}"


def consulta_pedido_readonly(pedido_id: int, estado: str, items: list[PedidoObraItem]) -> str:
    return f"{consulta_pedido(pedido_id, estado, items)}\n\n{READONLY_FOOTER}"


def pedido_no_modificable() -> str:
    return READONLY_FOOTER


def pedir_cantidad(item: PedidoObraItem) -> str:
    return f"Indica cantidad de {item.descripcion}."


def cierre_pedido(state: PedidoObraState) -> str:
    title = "Pedido para guardar:" if state.accion_pendiente == "guardar" else "Pedido para cerrar:"
    return f"{title}\n{state.resumen_items()}\n\nOpciones: 1:OK 2:VOLVER."


def confirmado(state: PedidoObraState, pedido_id: int | None = None, *, cerrado: bool = True) -> str:
    pedido_line = f"Pedido #{pedido_id}\n" if pedido_id is not None else ""
    title = "*PEDIDO CERRADO*" if cerrado else "*PEDIDO GUARDADO*"
    return (
        f"{title}\n"
        f"{pedido_line}"
        "____________________\n\n"
        "*Materiales*\n"
        f"{_resumen_items_confirmados(state)}"
    )


def error_confirmacion() -> str:
    return "No pude guardar el pedido confirmado. Intenta confirmar nuevamente en unos segundos."


def comando_invalido(etapa: str) -> str:
    if etapa == "confirmar_salida":
        return "Responde 1:OK para salir o 2:VOLVER para continuar."
    if etapa == "inicial":
        return "Responde con el numero de obra para este pedido."
    if etapa == "cierre":
        return "Responde 1:OK o 2:VOLVER."
    return "No entendi la respuesta. Continua con el dato solicitado o usa SALIR."


def _resumen_items_confirmados(state: PedidoObraState) -> str:
    if not state.items:
        return "- (sin materiales)"
    return "\n".join(f"- {item.resumen()}" for item in state.items)


def _resumen_items(items: list[PedidoObraItem]) -> str:
    if not items:
        return "- (sin materiales)"
    return "\n".join(f"- {item.resumen()}" for item in items)
