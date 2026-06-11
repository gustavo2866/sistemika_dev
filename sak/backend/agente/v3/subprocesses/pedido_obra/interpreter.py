"""Interpretacion minima de mensajes para pedidoObra v3."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal


PedidoObraOperationType = Literal["insert", "delete", "update", "show", "clear"]


@dataclass(slots=True)
class PedidoObraOperation:
    type: PedidoObraOperationType
    descripcion: str | None = None
    cantidad: float | None = None
    unidad: str | None = None
    target: str | None = None


@dataclass(slots=True)
class QuantityAnswer:
    cantidad: float
    unidad: str | None = None


def normalize_command(text: str | None) -> str:
    raw = unicodedata.normalize("NFKD", str(text or "").strip().lower())
    raw = "".join(char for char in raw if not unicodedata.combining(char))
    raw = re.sub(r"[^a-z0-9\s]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def parse_quantity_answer(text: str | None) -> QuantityAnswer | None:
    normalized = normalize_command(text)
    match = re.fullmatch(r"(?P<cantidad>\d+(?:[.,]\d+)?)(?:\s*(?P<unidad>[a-z0-9]+))?", normalized)
    if match:
        value = float(match.group("cantidad").replace(",", "."))
        if value <= 0:
            return None
        return QuantityAnswer(cantidad=value, unidad=_canonical_unit(match.group("unidad")))
    return None


def parse_quantity(text: str | None) -> float | None:
    answer = parse_quantity_answer(text)
    return answer.cantidad if answer is not None else None


def interpret_carga(text: str | None) -> list[PedidoObraOperation]:
    command = normalize_command(text)
    if not command:
        return []

    if command in {"ver", "mostrar", "resumen", "pedido"}:
        return [PedidoObraOperation(type="show")]

    if command in {"limpiar", "borrar todo", "vaciar"}:
        return [PedidoObraOperation(type="clear")]

    delete_match = re.match(r"^(?:borrar|eliminar|sacar|quitar)\s+(.+)$", command)
    if delete_match:
        return [PedidoObraOperation(type="delete", target=delete_match.group(1).strip())]

    update_match = re.match(r"^(?:cambiar|actualizar)\s+(.+?)\s+(?:a|por)\s+(.+)$", command)
    if update_match:
        parsed = _parse_item(update_match.group(2))
        return [
            PedidoObraOperation(
                type="update",
                target=update_match.group(1).strip(),
                descripcion=parsed.descripcion,
                cantidad=parsed.cantidad,
                unidad=parsed.unidad,
            )
        ]

    return [
        op
        for line in _material_lines(text)
        for op in [_parse_item(line)]
        if op.descripcion
    ]


def _material_lines(text: str | None) -> list[str]:
    raw = str(text or "").strip()
    if ":" in raw:
        raw = raw.split(":", 1)[1]
    lines = re.split(r"[\n;,]+|\s+y\s+", raw, flags=re.IGNORECASE)
    return [line.strip(" .-") for line in lines if line.strip(" .-")]


def _parse_item(text: str) -> PedidoObraOperation:
    normalized = normalize_command(text)
    match = re.match(r"^(?P<cantidad>\d+(?:[.,]\d+)?)\s+(?P<unidad>[a-z0-9]+)?\s*(?P<descripcion>.+)$", normalized)
    if match:
        return PedidoObraOperation(
            type="insert",
            descripcion=match.group("descripcion").strip(),
            cantidad=float(match.group("cantidad").replace(",", ".")),
            unidad=(match.group("unidad") or "").strip() or None,
        )
    return PedidoObraOperation(type="insert", descripcion=normalized)


def _canonical_unit(unit: str | None) -> str | None:
    normalized = normalize_command(unit)
    if not normalized:
        return None
    aliases = {
        "mt": "mts",
        "mts": "mts",
        "metro": "mts",
        "metros": "mts",
        "m": "mts",
        "kg": "kg",
        "kilo": "kg",
        "kilos": "kg",
        "bolsa": "bolsas",
        "bolsas": "bolsas",
        "barra": "barras",
        "barras": "barras",
    }
    return aliases.get(normalized, normalized)
