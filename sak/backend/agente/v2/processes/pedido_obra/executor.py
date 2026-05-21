"""Executor deterministico de operaciones para pedido_obra."""

from __future__ import annotations

import re
import unicodedata

from agente.v2.processes.pedido_obra import renderer
from agente.v2.processes.pedido_obra.models import (
    ExecutionResult,
    OperationItem,
    PedidoItem,
    PedidoOperation,
    PedidoState,
    TurnPlan,
)


TERMINAL_OPS = {"confirm_order", "cancel_order"}
KNOWN_OPS = {
    "add_items",
    "update_item",
    "remove_item",
    "clear_order",
    "show_order",
    "finish_order",
    "confirm_order",
    "cancel_order",
    "continue_previous",
    "start_new_order",
    "answer_missing_quantity",
    "offtopic",
}


def execute_plan(state: PedidoState, plan: TurnPlan) -> ExecutionResult:
    current = state.copy()
    applied: list[str] = []
    status = "noop"
    reply_override = plan.reply

    if not plan.operations:
        return ExecutionResult(
            status="clarification",
            next_state=current,
            reply=renderer.aclaracion(reply_override, current),
            applied_operations=applied,
        )

    for op in plan.operations:
        op_type = _canonical_type(op.type)
        if op_type not in KNOWN_OPS:
            continue
        applied.append(op_type)

        if op_type == "offtopic":
            return ExecutionResult(
                status="offtopic",
                next_state=current,
                reply=renderer.offtopic(op.reply or reply_override, current),
                applied_operations=applied,
            )

        if op_type == "continue_previous":
            current.esperando = None
            current.etapa = "carga"
            current.touch()
            status = "continued"
            continue

        if op_type == "start_new_order":
            current = PedidoState.empty(current.oportunidad_id)
            current.etapa = "carga"
            current.touch()
            status = "started"
            continue

        if op_type == "add_items":
            _add_items(current, op.items)
            status = "updated"
            continue

        if op_type == "update_item":
            error = _update_item(current, op)
            if error:
                return _blocked(current, error, applied)
            status = "updated"
            continue

        if op_type == "remove_item":
            error = _remove_item(current, op)
            if error:
                return _blocked(current, error, applied)
            status = "updated"
            continue

        if op_type == "clear_order":
            current = PedidoState.empty(current.oportunidad_id)
            current.etapa = "carga"
            current.touch()
            status = "cleared"
            continue

        if op_type == "show_order":
            status = "shown"
            continue

        if op_type == "answer_missing_quantity":
            error = _answer_missing_quantity(current, op)
            if error:
                return _blocked(current, error, applied)
            status = "answered_missing_quantity"
            continue

        if op_type == "finish_order":
            status = "finish_requested"
            break

        if op_type == "confirm_order":
            status = "confirm_requested"
            break

        if op_type == "cancel_order":
            current = PedidoState.empty(current.oportunidad_id)
            current.etapa = "finalizado"
            current.touch()
            return ExecutionResult(
                status="cancelled",
                next_state=current,
                reply=renderer.pedido_cancelado(),
                keep_active=False,
                applied_operations=applied,
            )

    return _finalize_result(current, status, applied)


def _finalize_result(state: PedidoState, status: str, applied: list[str]) -> ExecutionResult:
    if status in {"finish_requested", "confirm_requested", "answered_missing_quantity"}:
        if not state.items:
            state.etapa = "carga"
            state.esperando = None
            state.touch()
            return ExecutionResult(status="empty_order", next_state=state, reply=renderer.pedido_vacio(), applied_operations=applied)

        missing = _first_missing_quantity(state)
        if missing is not None:
            idx, item = missing
            state.etapa = "confirmacion"
            state.esperando = "cantidad_faltante"
            state.item_cantidad_idx = idx
            state.touch()
            return ExecutionResult(
                status="missing_quantity",
                next_state=state,
                reply=renderer.pedir_cantidad(item),
                applied_operations=applied,
            )

        if status == "confirm_requested":
            state.etapa = "finalizado"
            state.esperando = None
            state.item_cantidad_idx = None
            state.touch()
            return ExecutionResult(
                status="confirmed",
                next_state=state,
                reply=renderer.pedido_confirmado(state),
                keep_active=False,
                pedido_listo=True,
                applied_operations=applied,
            )

        state.etapa = "confirmacion"
        state.esperando = "confirmacion_cierre"
        state.item_cantidad_idx = None
        state.touch()
        return ExecutionResult(
            status="ready_for_confirmation",
            next_state=state,
            reply=renderer.confirmar_pedido(state),
            applied_operations=applied,
        )

    if status == "shown":
        return ExecutionResult(
            status=status,
            next_state=state,
            reply=renderer.pedido_previo(state) if state.esperando == "decision_pedido_previo" else renderer.pedido_actual(state),
            applied_operations=applied,
        )

    if status == "continued":
        return ExecutionResult(status=status, next_state=state, reply=renderer.continuar_previo(state), applied_operations=applied)

    if status == "started":
        return ExecutionResult(status=status, next_state=state, reply=renderer.empezar_nuevo(state), applied_operations=applied)

    if status == "cleared":
        return ExecutionResult(status=status, next_state=state, reply=renderer.pedido_limpiado(), applied_operations=applied)

    if status == "updated":
        state.etapa = "carga"
        state.esperando = None
        state.item_cantidad_idx = None
        state.touch()
        return ExecutionResult(status=status, next_state=state, reply=renderer.actualizado(state), applied_operations=applied)

    return ExecutionResult(
        status="clarification",
        next_state=state,
        reply=renderer.aclaracion(None, state),
        applied_operations=applied,
    )


def _add_items(state: PedidoState, items: list[OperationItem]) -> None:
    state.etapa = "carga"
    state.esperando = None
    state.item_cantidad_idx = None
    for item in items:
        incoming = _normalize_incoming_item(item)
        existing = _find_merge_target(state, incoming)
        if existing is None:
            state.items.append(
                PedidoItem(
                    descripcion=incoming.descripcion,
                    cantidad=incoming.cantidad,
                    unidad=incoming.unidad,
                )
            )
            continue

        _normalize_existing_item(existing)
        if existing.cantidad is None:
            existing.cantidad = incoming.cantidad
        elif incoming.cantidad is not None:
            existing.cantidad += incoming.cantidad
        if not existing.unidad and incoming.unidad:
            existing.unidad = incoming.unidad
    state.touch()


_LEADING_UNIT_ALIASES = {
    "bolsa": "bolsas",
    "bolsas": "bolsas",
    "lata": "latas",
    "latas": "latas",
    "barra": "barras",
    "barras": "barras",
    "litro": "litros",
    "litros": "litros",
    "lts": "litros",
    "lt": "litros",
    "metro": "mts",
    "metros": "mts",
    "mts": "mts",
    "mt": "mts",
    "m2": "m2",
    "m3": "m3",
    "kg": "kg",
    "kilo": "kg",
    "kilos": "kg",
}


def _normalize_incoming_item(item: OperationItem) -> OperationItem:
    unit = _canonical_unit(item.unidad)
    description = item.descripcion.strip()
    inferred_unit, stripped_description = _split_leading_unit(description)
    if not unit and inferred_unit:
        unit = inferred_unit
        description = stripped_description
    return OperationItem(descripcion=description, cantidad=item.cantidad, unidad=unit or item.unidad)


def _normalize_existing_item(item: PedidoItem) -> None:
    if item.unidad:
        item.unidad = _canonical_unit(item.unidad) or item.unidad
        return
    inferred_unit, stripped_description = _split_leading_unit(item.descripcion)
    if inferred_unit:
        item.unidad = inferred_unit
        item.descripcion = stripped_description


def _find_merge_target(state: PedidoState, incoming: OperationItem) -> PedidoItem | None:
    matches: list[PedidoItem] = []
    for existing in state.items:
        if _can_merge(existing, incoming):
            matches.append(existing)
    if len(matches) == 1:
        return matches[0]
    return None


def _can_merge(existing: PedidoItem, incoming: OperationItem) -> bool:
    existing_unit, existing_key = _item_match_parts(existing.descripcion, existing.unidad)
    incoming_unit, incoming_key = _item_match_parts(incoming.descripcion, incoming.unidad)
    if not existing_key or not incoming_key:
        return False
    if existing_unit and incoming_unit and existing_unit != incoming_unit:
        return False
    if existing_key == incoming_key:
        return True
    shorter, longer = sorted([existing_key, incoming_key], key=len)
    return len(shorter) >= 4 and shorter in longer


def _item_match_parts(description: str | None, unit: str | None) -> tuple[str | None, str]:
    canonical_unit = _canonical_unit(unit)
    material = (description or "").strip()
    inferred_unit, stripped_description = _split_leading_unit(material)
    if not canonical_unit and inferred_unit:
        canonical_unit = inferred_unit
        material = stripped_description
    return canonical_unit, _normalize_material(material)


def _split_leading_unit(description: str) -> tuple[str | None, str]:
    match = re.match(
        r"^\s*([A-Za-z0-9]+)\s+(?:de\s+)?(.+?)\s*$",
        description,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, description.strip()
    unit = _canonical_unit(match.group(1))
    if not unit:
        return None, description.strip()
    return unit, match.group(2).strip()


def _canonical_unit(unit: str | None) -> str | None:
    normalized = _normalize(unit)
    if not normalized:
        return None
    first = normalized.split()[0]
    return _LEADING_UNIT_ALIASES.get(first, first)


def _normalize_material(description: str | None) -> str:
    value = _normalize(description)
    tokens = [token for token in value.split() if token not in set(_LEADING_UNIT_ALIASES)]
    return " ".join(tokens)


def _update_item(state: PedidoState, op: PedidoOperation) -> str | None:
    item = _resolve_item(state, op)
    if item is None:
        return "No encontre el material a modificar. Decime cual queres cambiar."

    changed = False
    if op.nueva_descripcion:
        item.descripcion = op.nueva_descripcion
        changed = True
    if op.cantidad is not None:
        item.cantidad = op.cantidad
        changed = True
    if op.unidad:
        item.unidad = op.unidad
        changed = True
    if not changed:
        return f"Que cambio queres hacer sobre {item.descripcion}?"

    state.etapa = "carga"
    state.esperando = None
    state.item_cantidad_idx = None
    state.touch()
    return None


def _remove_item(state: PedidoState, op: PedidoOperation) -> str | None:
    idx = _resolve_item_index(state, op)
    if idx is None:
        return "No encontre el material a quitar. Decime cual queres sacar."
    state.items.pop(idx)
    state.etapa = "carga"
    state.esperando = None
    state.item_cantidad_idx = None
    state.touch()
    return None


def _answer_missing_quantity(state: PedidoState, op: PedidoOperation) -> str | None:
    idx = state.item_cantidad_idx
    if op.target_item_id:
        idx = _find_index_by_id(state, op.target_item_id)
    if idx is None or not (0 <= idx < len(state.items)):
        return "No tengo un material pendiente de cantidad."
    if op.cantidad is None:
        return f"Que cantidad de {state.items[idx].descripcion} necesitas?"

    state.items[idx].cantidad = op.cantidad
    if op.unidad:
        state.items[idx].unidad = op.unidad
    state.esperando = None
    state.item_cantidad_idx = None
    state.touch()
    return None


def _blocked(state: PedidoState, reply: str, applied: list[str]) -> ExecutionResult:
    return ExecutionResult(
        status="blocked",
        next_state=state,
        reply=reply,
        applied_operations=applied,
    )


def _first_missing_quantity(state: PedidoState) -> tuple[int, PedidoItem] | None:
    for idx, item in enumerate(state.items):
        if item.cantidad is None:
            return idx, item
    return None


def _resolve_item(state: PedidoState, op: PedidoOperation) -> PedidoItem | None:
    idx = _resolve_item_index(state, op)
    return state.items[idx] if idx is not None else None


def _resolve_item_index(state: PedidoState, op: PedidoOperation) -> int | None:
    if op.target_item_id:
        return _find_index_by_id(state, op.target_item_id)
    if not op.target_descripcion:
        return None

    target = _normalize(op.target_descripcion)
    matches = [idx for idx, item in enumerate(state.items) if _normalize(item.descripcion) == target]
    if len(matches) == 1:
        return matches[0]
    contains = [idx for idx, item in enumerate(state.items) if target and target in _normalize(item.descripcion)]
    if len(contains) == 1:
        return contains[0]
    return None


def _find_index_by_id(state: PedidoState, item_id: str) -> int | None:
    for idx, item in enumerate(state.items):
        if item.item_id == item_id:
            return idx
    return None


def _normalize(text: str | None) -> str:
    if not text:
        return ""
    value = unicodedata.normalize("NFKD", text.lower())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"\b(?:el|la|los|las|un|una|unos|unas|de|del|pedido|item|items|materiales?)\b", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _canonical_type(value: str) -> str:
    aliases = {
        "add_item": "add_items",
        "remove_items": "remove_item",
        "delete_item": "remove_item",
        "update_items": "update_item",
        "modify_item": "update_item",
        "change_item": "update_item",
        "clear_items": "clear_order",
        "show_items": "show_order",
        "close_order": "finish_order",
        "finish": "finish_order",
        "confirm": "confirm_order",
        "cancel": "cancel_order",
        "off_topic": "offtopic",
    }
    normalized = str(value or "").strip().lower()
    return aliases.get(normalized, normalized)
