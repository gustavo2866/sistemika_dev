"""Normalizacion de texto y valores compartida por flows y dominio."""

from __future__ import annotations

import re
import unicodedata
from decimal import Decimal
from typing import Any


# Normaliza texto de usuario y repara codificaciones frecuentes antes de compararlo.
def normalize_text(value: str | None) -> str:
    text = _repair_common_mojibake(str(value or "")).lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# Corrige texto UTF-8 interpretado como Latin-1 cuando aparecen sus marcas habituales.
def _repair_common_mojibake(value: str) -> str:
    if "Ã" not in value and "Â" not in value:
        return value
    try:
        return value.encode("latin1").decode("utf-8")
    except UnicodeError:
        return value


# Normaliza mayusculas, acentos, signos y espacios para comparar comandos locales.
def _normalize_command(text: str | None) -> str:
    raw = unicodedata.normalize("NFKD", str(text or "").strip().lower())
    raw = "".join(char for char in raw if not unicodedata.combining(char))
    raw = re.sub(r"[^a-z0-9\s]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


# Agrega una aclaracion al motivo existente sin reemplazarlo.
def _append_description(current: str | None, incoming: str) -> str:
    return f"{current}. {incoming}" if current else incoming


# Convierte una referencia opcional en un identificador entero positivo.
def _parse_optional_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


# Formatea horas sin ceros decimales innecesarios.
def _format_decimal(value: Decimal) -> str:
    as_float = float(value)
    return f"{as_float:g}"
