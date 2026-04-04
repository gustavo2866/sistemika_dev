from __future__ import annotations

from typing import Any

from agente.v2.core.models import FamilyAttributeDefinition, MaterialItem, MaterialRequestState
from agente.v2.processes.solicitud_materiales.family_catalog import FamilyCatalog
from agente.v2.shared.text_normalization import normalize_text

_STRUCTURAL_ATTRIBUTE_DEFINITIONS: dict[str, FamilyAttributeDefinition] = {
    "cantidad": FamilyAttributeDefinition(
        nombre="cantidad",
        descripcion="Cantidad solicitada para el item",
        obligatorio=True,
        tipo_dato="numero",
    ),
    "unidad": FamilyAttributeDefinition(
        nombre="unidad",
        descripcion="Unidad de medida solicitada para el item",
        obligatorio=True,
        tipo_dato="string",
    ),
}


def _humanize_attribute_name(attribute_name: str) -> str:
    known_labels = {
        "tipo": "tipo",
        "peso_kg": "peso en kg",
        "diametro_mm": "diametro en mm",
        "largo_m": "largo en metros",
        "cantidad": "cantidad",
        "unidad": "unidad",
    }
    normalized_name = normalize_text(attribute_name).replace(" ", "_")
    if normalized_name in known_labels:
        return known_labels[normalized_name]
    return attribute_name.replace("_", " ").strip().lower()


def _normalize_quantity_value(value: Any) -> float | int | None:
    if value is None or value == "" or isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        numeric_value = float(value)
    else:
        text = str(value).strip().replace(",", ".")
        if not text:
            return None
        try:
            numeric_value = float(text)
        except (TypeError, ValueError):
            return None

    if numeric_value <= 0:
        return None
    return int(numeric_value) if numeric_value.is_integer() else numeric_value


class RequestValidator:
    """Calcula defaults, faltantes y consulta activa para una solicitud."""

    def __init__(self, family_catalog: FamilyCatalog) -> None:
        self._family_catalog = family_catalog

    def refresh(self, request_state: MaterialRequestState) -> MaterialRequestState:
        first_query_assigned = False
        has_pending = False

        for item in request_state.items:
            self._ensure_family(item)
            self._normalize_structural_fields(item)
            self._apply_family_defaults(item)
            self._compute_missing_attributes(item)

            if item.faltantes and not first_query_assigned:
                has_pending = True
                first_query_assigned = True
                item.consulta_atributo = item.faltantes[0]
                item.consulta = self._build_query(item)
            else:
                item.consulta = None
                item.consulta_atributo = None
                item.consulta_intentos = 0 if not item.faltantes else item.consulta_intentos

        if request_state.estado_solicitud == "confirmed" and has_pending:
            request_state.estado_solicitud = "needs_clarification"
            request_state.activa = True
        elif request_state.estado_solicitud != "confirmed":
            if has_pending:
                request_state.estado_solicitud = "needs_clarification"
                request_state.activa = True
            elif request_state.items:
                request_state.estado_solicitud = "ready"
                request_state.activa = True
            else:
                request_state.estado_solicitud = "draft"
                request_state.activa = True

        return request_state

    @staticmethod
    def _normalize_structural_fields(item: MaterialItem) -> None:
        item.cantidad = _normalize_quantity_value(item.cantidad)

    def _ensure_family(self, item: MaterialItem) -> None:
        if item.familia:
            return
        family = self._family_catalog.infer_family_from_description(item.descripcion)
        if family:
            item.familia = family.codigo

    def _apply_family_defaults(self, item: MaterialItem) -> None:
        family = self._family_catalog.get_family(item.familia)
        if not family:
            return

        for attribute in family.atributos:
            if normalize_text(attribute.nombre) == "unidad":
                if not item.unidad and attribute.default is not None:
                    item.unidad = str(attribute.default).strip()
                continue

            if attribute.nombre in item.atributos:
                continue
            if attribute.default is not None:
                item.atributos[attribute.nombre] = attribute.default

    def _compute_missing_attributes(self, item: MaterialItem) -> None:
        item.faltantes = []
        if item.cantidad is None:
            item.faltantes.append("cantidad")

        family = self._family_catalog.get_family(item.familia)
        if not family:
            return

        for attribute in family.atributos:
            if normalize_text(attribute.nombre) == "unidad":
                if attribute.obligatorio and not item.unidad:
                    item.faltantes.append(attribute.nombre)
                continue

            if attribute.nombre in item.atributos and item.atributos.get(attribute.nombre) not in {None, ""}:
                continue
            if attribute.obligatorio:
                item.faltantes.append(attribute.nombre)

    def _build_query(self, item: MaterialItem) -> str:
        if not item.faltantes:
            return ""

        attribute_name = item.faltantes[0]
        family = self._family_catalog.get_family(item.familia)
        product_name = item.descripcion or item.familia or "este item"
        label = _humanize_attribute_name(attribute_name)
        prompt = f"Que {label} necesitas para {product_name}?"

        if not family:
            return prompt

        attribute = family.find_attribute(attribute_name)
        if not attribute or attribute.tipo_dato != "enum" or not attribute.valores_posibles:
            return prompt

        indexed_options = ", ".join(
            f"{index}: {option}"
            for index, option in enumerate(attribute.valores_posibles, start=1)
        )
        return f"{prompt} {indexed_options}"

    def get_attribute_definition(self, item: MaterialItem, attribute_name: str | None) -> FamilyAttributeDefinition | None:
        normalized_name = normalize_text(attribute_name).replace(" ", "_")
        structural_attribute = _STRUCTURAL_ATTRIBUTE_DEFINITIONS.get(normalized_name)
        if structural_attribute is not None:
            return structural_attribute

        family = self._family_catalog.get_family(item.familia)
        if not family:
            return None
        return family.find_attribute(attribute_name)
