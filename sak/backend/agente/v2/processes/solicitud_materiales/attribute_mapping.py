from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

from agente.v2.shared.text_normalization import normalize_text, normalize_text_without_accents
from agente.v2.processes.solicitud_materiales.models import DirectAttributeMatch, FamilyAttributeDefinition


_COMMAND_PREFIXES = (
    "agrega",
    "agregar",
    "suma",
    "sumar",
    "elimina",
    "eliminar",
    "borra",
    "borrar",
    "cambia",
    "cambiar",
    "limpia",
    "limpiar",
    "confirma",
    "confirmar",
    "muestra",
    "mostrar",
)


class DirectAttributeMapper:
    """Mapea respuestas directas del usuario sobre atributos pendientes."""

    def try_map(self, attribute: FamilyAttributeDefinition | None, response_text: str | None) -> DirectAttributeMatch:
        if attribute is None:
            return DirectAttributeMatch(applied=False, reason="missing_attribute_definition")

        if attribute.tipo_dato == "numero":
            return self._map_numeric(attribute.nombre, response_text)
        if attribute.tipo_dato == "enum":
            return self._map_enum(attribute, response_text)
        if attribute.tipo_dato == "string":
            return self._map_string(attribute.nombre, response_text)
        return DirectAttributeMatch(applied=False, reason="unsupported_attribute_type")

    def _map_numeric(self, attribute_name: str, response_text: str | None) -> DirectAttributeMatch:
        raw_text = str(response_text or "")
        match = re.search(r"(-?\d+(?:[.,]\d+)?)", raw_text)
        if not match:
            return DirectAttributeMatch(applied=False, reason="missing_numeric_value")

        raw_value = match.group(1).replace(",", ".")
        number = float(raw_value)
        value: int | float = int(number) if number.is_integer() else number
        return DirectAttributeMatch(applied=True, attribute_name=attribute_name, value=value)

    def _map_enum(self, attribute: FamilyAttributeDefinition, response_text: str | None) -> DirectAttributeMatch:
        text = str(response_text or "").strip()
        if not text:
            return DirectAttributeMatch(applied=False, reason="empty_response")

        options = attribute.valores_posibles
        numeric_match = re.fullmatch(r"\s*(\d+)\s*", text)
        if numeric_match:
            option_index = int(numeric_match.group(1)) - 1
            if 0 <= option_index < len(options):
                return DirectAttributeMatch(
                    applied=True,
                    attribute_name=attribute.nombre,
                    value=options[option_index],
                )

        normalized_response = normalize_text_without_accents(text)
        indexed_options = [(option, normalize_text_without_accents(option)) for option in options]

        for option, normalized_option in indexed_options:
            if normalized_response == normalized_option:
                if self._has_ambiguous_neighbor(normalized_option, indexed_options):
                    return DirectAttributeMatch(applied=False, reason="enum_catalog_is_ambiguous")
                return DirectAttributeMatch(applied=True, attribute_name=attribute.nombre, value=option)

        contains_matches = [
            option
            for option, normalized_option in indexed_options
            if normalized_option and (normalized_option in normalized_response or normalized_response in normalized_option)
        ]
        if len(contains_matches) == 1:
            normalized_match = normalize_text_without_accents(contains_matches[0])
            if self._has_ambiguous_neighbor(normalized_match, indexed_options):
                return DirectAttributeMatch(applied=False, reason="enum_catalog_is_ambiguous")
            return DirectAttributeMatch(applied=True, attribute_name=attribute.nombre, value=contains_matches[0])

        fuzzy_matches = sorted(
            (
                SequenceMatcher(None, normalized_response, normalized_option).ratio(),
                option,
            )
            for option, normalized_option in indexed_options
        )
        best_ratio, best_option = fuzzy_matches[-1]
        second_ratio = fuzzy_matches[-2][0] if len(fuzzy_matches) > 1 else 0.0
        if best_ratio >= 0.84 and (best_ratio - second_ratio) >= 0.08:
            best_option_key = normalize_text_without_accents(best_option)
            if self._has_ambiguous_neighbor(best_option_key, indexed_options):
                return DirectAttributeMatch(applied=False, reason="enum_catalog_is_ambiguous")
            return DirectAttributeMatch(applied=True, attribute_name=attribute.nombre, value=best_option)

        return DirectAttributeMatch(applied=False, reason="enum_not_mapped")

    @staticmethod
    def _has_ambiguous_neighbor(target_key: str, indexed_options: list[tuple[str, str]]) -> bool:
        for _, candidate_key in indexed_options:
            if candidate_key == target_key:
                continue
            if SequenceMatcher(None, target_key, candidate_key).ratio() >= 0.85:
                return True
        return False

    def _map_string(self, attribute_name: str, response_text: str | None) -> DirectAttributeMatch:
        text = str(response_text or "").strip(" \t\n\r:,.!?;-")
        normalized = normalize_text(text)
        if not normalized:
            return DirectAttributeMatch(applied=False, reason="empty_string_response")
        if any(normalized == prefix or normalized.startswith(f"{prefix} ") for prefix in _COMMAND_PREFIXES):
            return DirectAttributeMatch(applied=False, reason="looks_like_independent_message")
        return DirectAttributeMatch(applied=True, attribute_name=attribute_name, value=text)
