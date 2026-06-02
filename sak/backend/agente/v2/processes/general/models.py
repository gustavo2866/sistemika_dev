"""Modelos del proceso general."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


GeneralIntent = Literal[
    "start_pedido_obra",
    "start_parte_diario",
    "mostrar_nomina",
    "mostrar_parte_hoy",
    "saludo",
    "offtopic",
]

GENERAL_INTENTS: set[str] = {
    "start_pedido_obra",
    "start_parte_diario",
    "mostrar_nomina",
    "mostrar_parte_hoy",
    "saludo",
    "offtopic",
}


@dataclass(slots=True)
class GeneralDecision:
    type: GeneralIntent
