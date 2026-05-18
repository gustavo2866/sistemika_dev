"""Nodo de carga: acumula items y ejecuta órdenes sobre el pedido."""

from __future__ import annotations

import re
import unicodedata
import uuid
from typing import TYPE_CHECKING

from agente.v2.processes.pedido_obra.models import NodeResult, PedidoItem, PedidoState
from agente.v2.processes.pedido_obra.parser import ParsedItem, ParseResult, parse_message

if TYPE_CHECKING:
    from agente.v2.processes.pedido_obra.llm_client import PedidoObraLLMClient


async def run(
    state: PedidoState,
    mensaje: str,
    llm: "PedidoObraLLMClient",
) -> NodeResult:
    """
    Etapa de carga:
    - Agrega materiales y ejecuta órdenes de quitar/cambiar/mostrar/limpiar.
    - No bloquea por cantidades faltantes; eso se valida al cerrar.
    """
    if state.esperando == "cantidad_faltante":
        return _handle_cantidad_faltante(state, mensaje)

    if state.esperando == "confirmacion_comando":
        return _handle_comando_pendiente(state, mensaje)

    parsed = parse_message(mensaje)
    if parsed.confidence == "high":
        return _handle_high(state, parsed)

    try:
        llm_resp = await llm.evaluar_carga(mensaje, state)
    except Exception:
        return NodeResult(
            reply="No entendí bien. Decime materiales para agregar, o escribí *listo* para cerrar.",
            next_state=state,
            keep_active=True,
            used_llm=True,
        )

    operations = getattr(llm_resp, "operations", None) or []
    if operations:
        return _handle_operations(state, operations, fallback_reply=getattr(llm_resp, "reply", None))

    if llm_resp.intent == "item" and llm_resp.items:
        return _agregar_items(state, llm_resp.items, used_llm=True)

    if llm_resp.intent.startswith("comando_"):
        return _handle_comando(
            state,
            llm_resp.intent,
            target=llm_resp.target_descripcion,
            nueva_descripcion=llm_resp.nueva_descripcion,
            cantidad=llm_resp.cantidad,
            unidad=llm_resp.unidad,
            items=llm_resp.items,
            used_llm=True,
        )

    if llm_resp.intent == "cierre":
        return _ir_a_confirmacion(state)

    resumen = state.resumen_items()
    base_reply = llm_resp.reply or "Eso queda fuera del pedido."
    return NodeResult(
        reply=f"{base_reply}\n\nPedido actual:\n{resumen}\n\nPodés agregar, cambiar, quitar o decir *listo*.",
        next_state=state,
        keep_active=True,
        used_llm=True,
    )


def _handle_operations(state: PedidoState, operations: list, *, fallback_reply: str | None = None) -> NodeResult:
    current = state
    last_result: NodeResult | None = None
    applied = 0

    for op in operations:
        op_type = _operation_type(op)
        if not op_type:
            continue

        if op_type in {"add_item", "add_items", "item"}:
            items = _operation_items(op)
            if not items:
                continue
            last_result = _agregar_items(current, items, used_llm=True)
            applied += len(items)

        elif op_type in {"remove_item", "delete_item", "comando_quitar"}:
            last_result = _quitar_item(current, _operation_value(op, "target_descripcion") or _operation_value(op, "target"))
            applied += 1

        elif op_type in {"update_item", "modify_item", "change_item", "comando_modificar"}:
            last_result = _modificar_item(
                current,
                target=_operation_value(op, "target_descripcion") or _operation_value(op, "target"),
                nueva_descripcion=_operation_value(op, "nueva_descripcion") or _operation_value(op, "new_description"),
                cantidad=_operation_float(op, "cantidad"),
                unidad=_operation_value(op, "unidad"),
            )
            applied += 1

        elif op_type in {"clear_order", "clear_items", "comando_limpiar"}:
            last_result = _limpiar_pedido(current)
            applied += 1

        elif op_type in {"show_order", "show_items", "comando_mostrar"}:
            last_result = _mostrar_pedido(current)

        elif op_type in {"finish_order", "close_order", "cierre"}:
            return _ir_a_confirmacion(current)

        elif op_type in {"offtopic", "off_topic"}:
            reply = _operation_value(op, "reply") or fallback_reply or "Eso queda fuera del pedido."
            return NodeResult(
                reply=f"{reply}\n\nPedido actual:\n{current.resumen_items()}\n\nPodÃ©s agregar, cambiar, quitar o decir *listo*.",
                next_state=current,
                keep_active=True,
                used_llm=True,
            )

        else:
            continue

        if last_result is None:
            continue
        failed_change = (
            op_type in {
                "remove_item",
                "delete_item",
                "comando_quitar",
                "update_item",
                "modify_item",
                "change_item",
                "comando_modificar",
            }
            and last_result.next_state is current
        )
        if failed_change:
            return last_result
        current = last_result.next_state
        last_result.used_llm = True
        if not last_result.keep_active or current.esperando == "confirmacion_comando":
            return last_result

    if last_result is None:
        return NodeResult(
            reply=f"{fallback_reply or 'No entendÃ­ bien.'}\n\nPedido actual:\n{current.resumen_items()}",
            next_state=current,
            keep_active=True,
            used_llm=True,
        )

    if len(operations) == 1:
        return last_result

    return NodeResult(
        reply=(
            f"Listo, apliquÃ© {applied} cambios.\n"
            f"Pedido actual:\n{current.resumen_items()}\n\n"
            "PodÃ©s seguir agregando o escribir *listo* para cerrar."
        ),
        next_state=current,
        keep_active=True,
        used_llm=True,
    )


# ---------------------------------------------------------------------------
# High confidence
# ---------------------------------------------------------------------------

def _handle_high(state: PedidoState, parsed: ParseResult) -> NodeResult:
    if parsed.intent == "item" and parsed.items:
        return _agregar_items(state, parsed.items)

    if parsed.intent in ("cierre", "confirmar"):
        return _ir_a_confirmacion(state)

    if parsed.intent == "cancelar":
        return _cancelar_pedido(state)

    if parsed.intent == "cantidad":
        return NodeResult(
            reply="Decime también el material para esa cantidad, por ejemplo: 4 bolsas cemento.",
            next_state=state,
            keep_active=True,
        )

    if parsed.intent == "comando_mostrar":
        return _mostrar_pedido(state)

    if parsed.intent == "comando_limpiar":
        return _limpiar_pedido(state)

    if parsed.intent == "comando_quitar":
        if parsed.target_descripcion:
            return _quitar_item(state, parsed.target_descripcion)
        return _pedir_target_comando(state, "quitar", "¿Qué material querés quitar?")

    if parsed.intent == "comando_modificar":
        if parsed.items:
            return _aplicar_modificacion_directa(state, parsed.items[0])
        if parsed.target_descripcion and parsed.nueva_descripcion:
            return _modificar_item(
                state,
                target=parsed.target_descripcion,
                nueva_descripcion=parsed.nueva_descripcion,
            )
        if parsed.target_descripcion:
            return _pedir_target_comando(
                state,
                "modificar",
                f"¿Qué cambio querés hacer sobre {parsed.target_descripcion}?",
                target=parsed.target_descripcion,
            )
        return _pedir_target_comando(state, "modificar", "¿Qué material querés cambiar?")

    return NodeResult(
        reply=f"No entendí. Podés agregar, cambiar, quitar o decir *listo*.\n\nPedido actual:\n{state.resumen_items()}",
        next_state=state,
        keep_active=True,
    )


# ---------------------------------------------------------------------------
# Cantidades faltantes en finalización
# ---------------------------------------------------------------------------

def _handle_cantidad_faltante(state: PedidoState, mensaje: str) -> NodeResult:
    idx = state.item_cantidad_idx or 0
    item = state.items[idx] if idx < len(state.items) else None
    parsed = _parse_cantidad_respuesta(mensaje)

    if parsed is None:
        desc = item.descripcion if item else "ese material"
        return NodeResult(
            reply=f"No entendí la cantidad. ¿Qué cantidad de {desc} necesitás?",
            next_state=state,
            keep_active=True,
        )

    cantidad, unidad = parsed
    return _asignar_cantidad(state, cantidad, unidad)


def _asignar_cantidad(state: PedidoState, cantidad: float, unidad: str | None = None) -> NodeResult:
    new_state = _copy_state(state)
    idx = new_state.item_cantidad_idx
    if idx is None or idx >= len(new_state.items):
        return NodeResult(
            reply="No tengo un material pendiente de cantidad. Podés seguir cargando o decir *listo*.",
            next_state=state,
            keep_active=True,
        )

    new_state.items[idx].cantidad = cantidad
    if unidad:
        new_state.items[idx].unidad = unidad
    new_state.esperando = None
    new_state.item_cantidad_idx = None
    new_state.touch()

    faltante = _primer_item_sin_cantidad(new_state)
    if faltante is not None:
        next_idx, next_item = faltante
        new_state.etapa = "confirmacion"
        new_state.esperando = "cantidad_faltante"
        new_state.item_cantidad_idx = next_idx
        new_state.touch()
        return NodeResult(
            reply=f"Anotado. ¿Qué cantidad de {next_item.descripcion} necesitás?",
            next_state=new_state,
            keep_active=True,
        )

    return _ir_a_confirmacion(new_state)


def _parse_cantidad_respuesta(text: str) -> tuple[float, str | None] | None:
    parsed = parse_message(text)
    if parsed.intent == "cantidad" and parsed.cantidad_valor is not None:
        return parsed.cantidad_valor, parsed.unidad_valor
    if parsed.intent == "item" and parsed.items:
        item = parsed.items[0]
        if item.cantidad is not None:
            return item.cantidad, item.unidad
    m = re.search(r"\b(\d+(?:[.,]\d+)?)\b", text.strip())
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ".")), None
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

def _agregar_items(state: PedidoState, raw_items: list, *, used_llm: bool = False) -> NodeResult:
    new_state = _copy_state(state)
    new_state.etapa = "carga"
    new_state.esperando = None
    new_state.item_cantidad_idx = None
    nuevos: list[PedidoItem] = []
    for it in raw_items:
        nuevos.append(PedidoItem(
            item_id=str(uuid.uuid4())[:8],
            descripcion=it.descripcion,
            cantidad=it.cantidad,
            unidad=it.unidad,
        ))
    new_state.items.extend(nuevos)
    new_state.touch()

    resumen = new_state.resumen_items()
    reply = f"Agregado.\n{resumen}\n\nPodés seguir agregando o escribir *listo* para cerrar."
    return NodeResult(reply=reply, next_state=new_state, keep_active=True, used_llm=used_llm)


# ---------------------------------------------------------------------------
# Comandos
# ---------------------------------------------------------------------------

def _handle_comando(
    state: PedidoState,
    intent: str,
    *,
    target: str | None = None,
    nueva_descripcion: str | None = None,
    cantidad: float | None = None,
    unidad: str | None = None,
    items: list[ParsedItem] | None = None,
    used_llm: bool = False,
) -> NodeResult:
    if intent == "comando_mostrar":
        result = _mostrar_pedido(state)
        result.used_llm = used_llm
        return result

    if intent == "comando_limpiar":
        result = _limpiar_pedido(state)
        result.used_llm = used_llm
        return result

    if intent == "comando_quitar":
        if target:
            result = _quitar_item(state, target)
            result.used_llm = used_llm
            return result
        return _pedir_target_comando(state, "quitar", "¿Qué material querés quitar?")

    if intent == "comando_modificar":
        if items:
            result = _aplicar_modificacion_directa(state, items[0])
            result.used_llm = used_llm
            return result
        if target and (nueva_descripcion or cantidad is not None or unidad):
            result = _modificar_item(
                state,
                target=target,
                nueva_descripcion=nueva_descripcion,
                cantidad=cantidad,
                unidad=unidad,
            )
            result.used_llm = used_llm
            return result
        if target:
            return _pedir_target_comando(
                state,
                "modificar",
                f"¿Qué cambio querés hacer sobre {target}?",
                target=target,
            )
        return _pedir_target_comando(state, "modificar", "¿Qué material querés cambiar?")

    return NodeResult(
        reply="No pude ejecutar esa orden. Decime si querés agregar, quitar, cambiar o cerrar el pedido.",
        next_state=state,
        keep_active=True,
        used_llm=used_llm,
    )


def _handle_comando_pendiente(state: PedidoState, mensaje: str) -> NodeResult:
    parsed = parse_message(mensaje)
    if parsed.intent == "cancelar":
        new_state = _clear_waiting(state)
        return NodeResult(
            reply="De acuerdo, seguimos con el pedido actual.",
            next_state=new_state,
            keep_active=True,
        )

    comando = state.comando_pendiente or {}
    tipo = comando.get("tipo")
    target = comando.get("target") or parsed.target_descripcion or _clean_text(mensaje)

    if tipo == "quitar":
        return _quitar_item(_clear_waiting(state), target)

    if tipo == "modificar":
        if parsed.items:
            return _aplicar_modificacion_directa(_clear_waiting(state), parsed.items[0])
        if parsed.nueva_descripcion:
            return _modificar_item(_clear_waiting(state), target=target, nueva_descripcion=parsed.nueva_descripcion)
        return NodeResult(
            reply="No entendí el cambio. Ejemplo: los ladrillos deben ser huecos.",
            next_state=state,
            keep_active=True,
        )

    return NodeResult(
        reply="No entendí la orden pendiente. Podés seguir cargando o decir *listo*.",
        next_state=_clear_waiting(state),
        keep_active=True,
    )


def _mostrar_pedido(state: PedidoState) -> NodeResult:
    return NodeResult(
        reply=f"Pedido actual:\n{state.resumen_items()}",
        next_state=state,
        keep_active=True,
    )


def _limpiar_pedido(state: PedidoState) -> NodeResult:
    new_state = PedidoState.empty(state.oportunidad_id)
    new_state.etapa = "carga"
    new_state.touch()
    return NodeResult(
        reply="Borré los materiales del pedido. Podés cargarlo de nuevo.",
        next_state=new_state,
        keep_active=True,
    )


def _quitar_item(state: PedidoState, target: str | None) -> NodeResult:
    if not target:
        return _pedir_target_comando(state, "quitar", "¿Qué material querés quitar?")

    new_state = _copy_state(state)
    indices = _buscar_indices(new_state.items, target)
    if not indices:
        return NodeResult(
            reply=f"No encontré {target} en el pedido.\n\nPedido actual:\n{new_state.resumen_items()}",
            next_state=state,
            keep_active=True,
        )
    if len(indices) > 1:
        encontrados = "\n".join(f"  - {new_state.items[i].resumen()}" for i in indices)
        return NodeResult(
            reply=f"Encontré más de una opción para {target}:\n{encontrados}\n\nDecime cuál querés quitar con más detalle.",
            next_state=_set_esperando(state, "confirmacion_comando", {"tipo": "quitar"}),
            keep_active=True,
        )

    removed = new_state.items.pop(indices[0])
    new_state.esperando = None
    new_state.comando_pendiente = None
    new_state.item_cantidad_idx = None
    new_state.touch()
    resumen = new_state.resumen_items()
    return NodeResult(
        reply=f"Quité {removed.descripcion}.\n\nPedido actual:\n{resumen}",
        next_state=new_state,
        keep_active=True,
    )


def _aplicar_modificacion_directa(state: PedidoState, correccion: ParsedItem) -> NodeResult:
    return _modificar_item(
        state,
        target=correccion.descripcion,
        cantidad=correccion.cantidad,
        unidad=correccion.unidad,
    )


def _modificar_item(
    state: PedidoState,
    *,
    target: str | None,
    nueva_descripcion: str | None = None,
    cantidad: float | None = None,
    unidad: str | None = None,
) -> NodeResult:
    if not target:
        return _pedir_target_comando(state, "modificar", "¿Qué material querés cambiar?")

    new_state = _copy_state(state)
    indices = _buscar_indices(new_state.items, target)
    if not indices:
        return NodeResult(
            reply=f"No encontré {target} en el pedido.\n\nPedido actual:\n{new_state.resumen_items()}",
            next_state=state,
            keep_active=True,
        )
    if len(indices) > 1:
        encontrados = "\n".join(f"  - {new_state.items[i].resumen()}" for i in indices)
        return NodeResult(
            reply=f"Encontré más de una opción para {target}:\n{encontrados}\n\nDecime el cambio con más detalle.",
            next_state=_set_esperando(state, "confirmacion_comando", {"tipo": "modificar", "target": target}),
            keep_active=True,
        )

    item = new_state.items[indices[0]]
    before = item.resumen()
    changed = False
    if nueva_descripcion:
        item.descripcion = nueva_descripcion.strip()
        changed = True
    if cantidad is not None:
        item.cantidad = cantidad
        changed = True
    if unidad:
        item.unidad = unidad.strip()
        changed = True

    if not changed:
        return _pedir_target_comando(
            state,
            "modificar",
            f"¿Qué cambio querés hacer sobre {target}?",
            target=target,
        )

    new_state.esperando = None
    new_state.comando_pendiente = None
    new_state.touch()
    return NodeResult(
        reply=f"Actualicé {before} a {item.resumen()}.\n\nPedido actual:\n{new_state.resumen_items()}",
        next_state=new_state,
        keep_active=True,
    )


# ---------------------------------------------------------------------------
# Finalización
# ---------------------------------------------------------------------------

def _ir_a_confirmacion(state: PedidoState) -> NodeResult:
    if not state.items:
        return NodeResult(
            reply="No hay materiales cargados. Mandame lo que necesitás para armar el pedido.",
            next_state=PedidoState.empty(state.oportunidad_id),
            keep_active=True,
        )

    new_state = _copy_state(state)
    new_state.etapa = "confirmacion"
    new_state.esperando = None
    new_state.comando_pendiente = None
    new_state.item_cantidad_idx = None

    faltante = _primer_item_sin_cantidad(new_state)
    if faltante is not None:
        idx, item = faltante
        new_state.esperando = "cantidad_faltante"
        new_state.item_cantidad_idx = idx
        new_state.touch()
        return NodeResult(
            reply=f"Antes de cerrar, ¿qué cantidad de {item.descripcion} necesitás?",
            next_state=new_state,
            keep_active=True,
        )

    new_state.esperando = "confirmacion_cierre"
    new_state.touch()
    resumen = new_state.resumen_items()
    return NodeResult(
        reply=f"Pedido para confirmar:\n{resumen}\n\nRespondé *confirmar* para enviarlo o decime qué cambiar.",
        next_state=new_state,
        keep_active=True,
    )


def _cancelar_pedido(state: PedidoState) -> NodeResult:
    return NodeResult(
        reply="Pedido cancelado. Cuando quieras empezar uno nuevo, escribime.",
        next_state=PedidoState.empty(state.oportunidad_id),
        keep_active=False,
    )


# ---------------------------------------------------------------------------
# Utils
# ---------------------------------------------------------------------------

def _primer_item_sin_cantidad(state: PedidoState) -> tuple[int, PedidoItem] | None:
    for idx, item in enumerate(state.items):
        if item.cantidad is None:
            return idx, item
    return None


def _operation_value(op, key: str) -> str | None:
    if isinstance(op, dict):
        value = op.get(key)
    else:
        value = getattr(op, key, None)
    return str(value).strip() if value is not None and str(value).strip() else None


def _operation_float(op, key: str) -> float | None:
    if isinstance(op, dict):
        value = op.get(key)
    else:
        value = getattr(op, key, None)
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _operation_type(op) -> str:
    return (_operation_value(op, "type") or _operation_value(op, "intent") or "").lower()


def _operation_items(op) -> list:
    if isinstance(op, dict):
        items = op.get("items") or []
    else:
        items = getattr(op, "items", None) or []
    return list(items) if isinstance(items, list) else []


def _pedir_target_comando(
    state: PedidoState,
    tipo: str,
    reply: str,
    *,
    target: str | None = None,
) -> NodeResult:
    comando = {"tipo": tipo}
    if target:
        comando["target"] = target
    return NodeResult(
        reply=reply,
        next_state=_set_esperando(state, "confirmacion_comando", comando),
        keep_active=True,
    )


def _buscar_indices(items: list[PedidoItem], target: str) -> list[int]:
    target_norm = _normalize(target)
    if not target_norm:
        return []
    target_tokens = set(target_norm.split())
    target_singular = _singular_tokens(target_tokens)
    matches: list[int] = []
    for idx, item in enumerate(items):
        candidates = _item_match_texts(item)
        if any(_matches_target(target_norm, target_tokens, target_singular, candidate) for candidate in candidates):
            matches.append(idx)
    return matches


def _item_match_texts(item: PedidoItem) -> list[str]:
    cantidad = str(int(item.cantidad)) if isinstance(item.cantidad, float) and item.cantidad.is_integer() else str(item.cantidad or "")
    return [
        item.descripcion,
        f"{item.unidad or ''} {item.descripcion}",
        f"{cantidad} {item.unidad or ''} {item.descripcion}",
        item.resumen(),
    ]


def _matches_target(target_norm: str, target_tokens: set[str], target_singular: set[str], candidate: str) -> bool:
    candidate_norm = _normalize(candidate)
    if not candidate_norm:
        return False
    candidate_tokens = set(candidate_norm.split())
    candidate_singular = _singular_tokens(candidate_tokens)
    return (
        target_norm == candidate_norm
        or target_norm in candidate_norm
        or candidate_norm in target_norm
        or target_tokens.issubset(candidate_tokens)
        or target_singular.issubset(candidate_singular)
    )


def _singular_tokens(tokens: set[str]) -> set[str]:
    return {token[:-1] if token.endswith("s") and len(token) > 3 else token for token in tokens}


def _normalize(text: str | None) -> str:
    if not text:
        return ""
    value = unicodedata.normalize("NFKD", text.lower())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"\b(?:el|la|los|las|un|una|unos|unas|de|del|pedido|item|items|materiales?)\b", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _clean_text(text: str) -> str:
    value = re.sub(r"^\s*(?:los|las|unos|unas|el|la|un|una)\s+", "", text.strip(), flags=re.IGNORECASE)
    return value.strip(" .,:;").lower()


def _copy_state(state: PedidoState) -> PedidoState:
    return PedidoState.from_dict(state.to_dict(), oportunidad_id=state.oportunidad_id)


def _clear_waiting(state: PedidoState) -> PedidoState:
    new_state = _copy_state(state)
    new_state.esperando = None
    new_state.comando_pendiente = None
    new_state.item_cantidad_idx = None
    new_state.touch()
    return new_state


def _set_esperando(state: PedidoState, esperando: str, comando: dict | None = None) -> PedidoState:
    new_state = _copy_state(state)
    new_state.esperando = esperando  # type: ignore[assignment]
    new_state.comando_pendiente = comando
    new_state.touch()
    return new_state
