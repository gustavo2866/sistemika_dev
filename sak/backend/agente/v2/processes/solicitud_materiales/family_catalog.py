from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agente.v2.shared.text_normalization import normalize_text, normalize_text_without_accents, tokenize_text
from agente.v2.processes.solicitud_materiales.models import FamilyAttributeDefinition, FamilyDefinition


DEFAULT_FAMILIES_PATH = Path(__file__).resolve().parent / "knowledge" / "familias_materiales.json"
_NON_DISTINCTIVE_TOKENS = {
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "un",
    "una",
    "unos",
    "unas",
    "para",
    "por",
    "con",
    "sin",
}


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    items: list[str] = []
    seen: set[str] = set()
    for raw_item in value:
        item = str(raw_item).strip()
        if not item:
            continue
        key = normalize_text_without_accents(item)
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items


def _infer_attribute_type(attribute_name: str, requested_type: str | None, options: list[str]) -> str | None:
    if options:
        return "enum"
    if requested_type in {"numero", "enum", "string"}:
        return requested_type

    normalized_name = normalize_text(attribute_name)
    if normalized_name.endswith(("_mm", "_m", "_kg", "_l")):
        return "numero"
    return "string"


def _infer_required(attribute_name: str, attribute_type: str | None, default_value: Any, explicit_required: Any) -> bool:
    if explicit_required is not None:
        return bool(explicit_required)
    normalized_name = normalize_text(attribute_name)
    return default_value is None and (attribute_type in {"numero", "enum"} or normalized_name == "unidad")


def _distinctive_tokens(value: Any) -> set[str]:
    tokens = tokenize_text(value)
    return {
        token
        for token in tokens
        if token not in _NON_DISTINCTIVE_TOKENS and not token.isdigit()
    }


def load_familias_payload(path: Path | None = None) -> dict[str, Any]:
    familias_path = path or DEFAULT_FAMILIES_PATH
    if not familias_path.exists():
        return {"version": None, "origen": None, "familias": []}

    try:
        payload = json.loads(familias_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError("El catalogo de familias v2 no es un JSON valido") from exc

    if not isinstance(payload, dict):
        raise ValueError("El catalogo de familias v2 no es valido")

    familias = payload.get("familias")
    if not isinstance(familias, list):
        payload["familias"] = []

    return payload


def _normalize_family_status(value: Any) -> str:
    normalized = normalize_text(str(value or "confirmada"))
    if normalized in {"sugerida", "confirmada"}:
        return normalized
    return "confirmada"


def _normalize_attribute_for_api(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    nombre = str(value.get("nombre") or "").strip()
    if not nombre:
        return None

    descripcion = str(value.get("descripcion") or "").strip()
    valores_posibles = _normalize_string_list(value.get("valores_posibles"))
    requested_type = normalize_text(value.get("tipo_dato")) or None
    attribute_type = _infer_attribute_type(nombre, requested_type, valores_posibles)
    obligatorio = _infer_required(
        nombre,
        attribute_type,
        value.get("default"),
        value.get("obligatorio"),
    )

    if obligatorio and attribute_type is None:
        raise ValueError(f"El atributo '{nombre}' obligatorio debe definir tipo_dato")
    if obligatorio and attribute_type == "enum" and not valores_posibles:
        raise ValueError(f"El atributo '{nombre}' obligatorio de tipo enum debe definir valores_posibles")

    api_attribute_type: str | None
    if attribute_type in {"numero", "enum"}:
        api_attribute_type = attribute_type
    else:
        api_attribute_type = None

    return {
        "nombre": nombre,
        "descripcion": descripcion,
        "default": value.get("default"),
        "obligatorio": obligatorio,
        "tipo_dato": api_attribute_type,
        "valores_posibles": valores_posibles,
    }


def normalize_familia(value: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("La familia debe ser un objeto JSON")

    codigo = str(value.get("codigo") or "").strip()
    nombre = str(value.get("nombre") or "").strip()
    if not codigo:
        raise ValueError("La familia debe tener codigo")
    if not nombre:
        raise ValueError("La familia debe tener nombre")

    atributos = [
        normalized
        for normalized in (_normalize_attribute_for_api(item) for item in value.get("atributos") or [])
        if normalized is not None
    ]

    return {
        "codigo": codigo,
        "nombre": nombre,
        "estado": _normalize_family_status(value.get("estado")),
        "descripcion": str(value.get("descripcion") or "").strip(),
        "tags": _normalize_string_list(value.get("tags")),
        "atributos": atributos,
    }


def _find_family_index(payload: dict[str, Any], family_key: str) -> int | None:
    normalized_target = normalize_text_without_accents(family_key)
    if not normalized_target:
        return None

    for index, family in enumerate(payload.get("familias") or []):
        if not isinstance(family, dict):
            continue
        codigo = normalize_text_without_accents(str(family.get("codigo") or ""))
        nombre = normalize_text_without_accents(str(family.get("nombre") or ""))
        if normalized_target in {codigo, nombre}:
            return index
    return None


def get_familia_material(family_key: str, path: Path | None = None) -> dict[str, Any] | None:
    payload = load_familias_payload(path)
    index = _find_family_index(payload, family_key)
    if index is None:
        return None

    family = payload["familias"][index]
    if not isinstance(family, dict):
        return None
    return normalize_familia(family)


def save_familia_material(
    family_key: str,
    family_payload: dict[str, Any],
    path: Path | None = None,
) -> tuple[dict[str, Any], bool]:
    familias_path = path or DEFAULT_FAMILIES_PATH
    payload = load_familias_payload(familias_path)
    family = normalize_familia(family_payload)

    existing_index = _find_family_index(payload, family_key)
    if existing_index is None:
        existing_index = _find_family_index(payload, family["codigo"])
    if existing_index is None:
        existing_index = _find_family_index(payload, family["nombre"])

    created = existing_index is None
    familias = payload.setdefault("familias", [])
    if created:
        familias.append(family)
    else:
        familias[existing_index] = family

    familias_path.parent.mkdir(parents=True, exist_ok=True)
    familias_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return family, created


class FamilyCatalog:
    """Carga y expone las definiciones de familias para el flujo v2."""

    def __init__(self, families_path: Path | None = None) -> None:
        self._families_path = families_path or DEFAULT_FAMILIES_PATH
        self._families = self._load_families()
        self._family_index = self._build_family_index(self._families)
        self._family_alias_index = self._build_family_alias_index(self._families)

    def _load_payload(self) -> dict[str, Any]:
        if not self._families_path.exists():
            return {"familias": []}
        try:
            payload = json.loads(self._families_path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise ValueError("El catalogo de familias v2 no es un JSON valido") from exc
        if not isinstance(payload, dict):
            raise ValueError("El catalogo de familias v2 no es valido")
        return payload

    def _load_families(self) -> list[FamilyDefinition]:
        payload = self._load_payload()
        families: list[FamilyDefinition] = []
        for raw_family in payload.get("familias") or []:
            if not isinstance(raw_family, dict):
                continue

            attributes: list[FamilyAttributeDefinition] = []
            for raw_attribute in raw_family.get("atributos") or []:
                if not isinstance(raw_attribute, dict):
                    continue
                attribute_name = str(raw_attribute.get("nombre") or "").strip()
                if not attribute_name:
                    continue

                options = _normalize_string_list(raw_attribute.get("valores_posibles"))
                requested_type = normalize_text(raw_attribute.get("tipo_dato")) or None
                attribute_type = _infer_attribute_type(attribute_name, requested_type, options)
                required = _infer_required(
                    attribute_name,
                    attribute_type,
                    raw_attribute.get("default"),
                    raw_attribute.get("obligatorio"),
                )

                attributes.append(
                    FamilyAttributeDefinition(
                        nombre=attribute_name,
                        descripcion=str(raw_attribute.get("descripcion") or "").strip(),
                        default=raw_attribute.get("default"),
                        obligatorio=required,
                        tipo_dato=attribute_type,  # type: ignore[arg-type]
                        valores_posibles=options,
                    )
                )

            families.append(
                FamilyDefinition(
                    codigo=str(raw_family.get("codigo") or "").strip(),
                    nombre=str(raw_family.get("nombre") or "").strip(),
                    estado=str(raw_family.get("estado") or "confirmada").strip() or "confirmada",
                    descripcion=str(raw_family.get("descripcion") or "").strip(),
                    tags=_normalize_string_list(raw_family.get("tags")),
                    atributos=attributes,
                )
            )
        return families

    @staticmethod
    def _build_family_index(families: list[FamilyDefinition]) -> dict[str, FamilyDefinition]:
        index: dict[str, FamilyDefinition] = {}
        for family in families:
            for raw_key in (family.codigo, family.nombre):
                key = normalize_text_without_accents(raw_key)
                if key:
                    index[key] = family
        return index

    @staticmethod
    def _build_family_alias_index(families: list[FamilyDefinition]) -> dict[str, FamilyDefinition]:
        aliases_by_key: dict[str, list[FamilyDefinition]] = {}
        for family in families:
            for raw_tag in family.tags:
                key = normalize_text_without_accents(raw_tag)
                if not key:
                    continue
                aliases_by_key.setdefault(key, []).append(family)

        alias_index: dict[str, FamilyDefinition] = {}
        for key, matches in aliases_by_key.items():
            unique_matches = {match.codigo: match for match in matches}
            if len(unique_matches) == 1:
                alias_index[key] = next(iter(unique_matches.values()))
        return alias_index

    def get_family(self, family_key: str | None) -> FamilyDefinition | None:
        key = normalize_text_without_accents(family_key)
        if not key:
            return None
        return self._family_index.get(key) or self._family_alias_index.get(key)

    def list_prompt_families(self) -> list[dict[str, Any]]:
        return [family.prompt_dict() for family in self._families if family.estado in {"", "confirmada", "sugerida"}]

    def infer_family_from_description(self, description: str | None) -> FamilyDefinition | None:
        normalized_description = normalize_text_without_accents(description)
        description_tokens = _distinctive_tokens(description)
        if not description_tokens:
            return None

        best_family: FamilyDefinition | None = None
        best_score = 0
        is_tie = False
        for family in self._families:
            family_tokens = _distinctive_tokens(family.codigo) | _distinctive_tokens(family.nombre)
            phrase_score = 0
            for raw_key in (family.codigo, family.nombre, *family.tags):
                normalized_key = normalize_text_without_accents(raw_key)
                if not normalized_key:
                    continue
                if normalized_key in normalized_description:
                    phrase_score += 1
            for tag in family.tags:
                family_tokens |= _distinctive_tokens(tag)

            score = len(description_tokens & family_tokens) + phrase_score
            if score > best_score:
                best_family = family
                best_score = score
                is_tie = False
            elif score and score == best_score:
                is_tie = True

        if best_score == 0 or is_tie:
            return None
        return best_family
