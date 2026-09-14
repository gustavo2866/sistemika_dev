"""Jornada ordinaria compartida por partes diarios, agente y tarjas."""

from datetime import date
from decimal import Decimal


# Calcula las horas ordinarias de la fecha del parte, nunca de la fecha actual.
def get_jornada_esperada(fecha: date | str) -> Decimal:
    fecha_parte = date.fromisoformat(fecha) if isinstance(fecha, str) else fecha
    if fecha_parte.weekday() == 6:
        return Decimal("0")
    if fecha_parte.weekday() == 5:
        return Decimal("6")
    return Decimal("9")
