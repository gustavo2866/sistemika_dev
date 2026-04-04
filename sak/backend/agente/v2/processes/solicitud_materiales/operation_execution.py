from __future__ import annotations

from typing import Any

from agente.v2.shared.text_normalization import normalize_text_without_accents
from agente.v2.core.models import ItemOperation, MaterialItem, MaterialRequestState


class RequestOperationExecutor:
    """Aplica operaciones sugeridas por el LLM sobre la solicitud v2."""

    def apply(self, request_state: MaterialRequestState, operations: list[ItemOperation]) -> list[str]:
        warnings: list[str] = []
        for operation in operations:
            if operation.action == "clear_request":
                request_state.items = []
                request_state.estado_solicitud = "draft"
                request_state.activa = True
                continue

            if operation.action == "confirm_request":
                request_state.estado_solicitud = "confirmed"
                request_state.activa = False
                continue

            if operation.action == "show_request":
                continue

            if operation.action == "add":
                request_state.items.append(self._build_item(operation))
                continue

            target_index = self._find_target_index(request_state, operation)
            if target_index is None:
                warnings.append(f"No se pudo encontrar el item para la operacion '{operation.action}'.")
                continue

            if operation.action == "remove":
                request_state.items.pop(target_index)
                continue

            if operation.action == "update":
                updated_item = request_state.items[target_index]
                self._apply_update(updated_item, operation)
                continue

            warnings.append(f"Operacion no soportada: {operation.action}")

        return warnings

    @staticmethod
    def _build_item(operation: ItemOperation) -> MaterialItem:
        return MaterialItem(
            descripcion=operation.descripcion,
            cantidad=operation.cantidad,
            unidad=operation.unidad,
            familia=operation.familia,
            atributos=dict(operation.atributos),
        )

    def _find_target_index(self, request_state: MaterialRequestState, operation: ItemOperation) -> int | None:
        if operation.target_item_id:
            for index, item in enumerate(request_state.items):
                if item.item_id == operation.target_item_id:
                    return index

        by_family = self._match_unique_by_family(request_state, operation.familia)
        if by_family is not None:
            return by_family

        return self._match_unique_by_description(request_state, operation.descripcion)

    @staticmethod
    def _match_unique_by_family(request_state: MaterialRequestState, family_name: str | None) -> int | None:
        family_key = normalize_text_without_accents(family_name)
        if not family_key:
            return None

        matches = [
            index
            for index, item in enumerate(request_state.items)
            if normalize_text_without_accents(item.familia) == family_key
        ]
        return matches[0] if len(matches) == 1 else None

    @staticmethod
    def _match_unique_by_description(request_state: MaterialRequestState, description: str | None) -> int | None:
        normalized_description = normalize_text_without_accents(description)
        if not normalized_description:
            return None

        matches = [
            index
            for index, item in enumerate(request_state.items)
            if normalized_description in normalize_text_without_accents(item.descripcion)
            or normalize_text_without_accents(item.descripcion) in normalized_description
        ]
        return matches[0] if len(matches) == 1 else None

    @staticmethod
    def _apply_update(item: MaterialItem, operation: ItemOperation) -> None:
        if operation.descripcion is not None:
            item.descripcion = operation.descripcion
        if operation.cantidad is not None:
            item.cantidad = operation.cantidad
        if operation.unidad is not None:
            item.unidad = operation.unidad
        if operation.familia is not None:
            item.familia = operation.familia
        if operation.atributos:
            item.atributos = {
                **item.atributos,
                **operation.atributos,
            }
        item.consulta = None
        item.consulta_atributo = None
        item.consulta_intentos = 0
