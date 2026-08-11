"""Calendario operativo para parte_diario."""

from __future__ import annotations

from datetime import date, timedelta


def es_feriado(value: date) -> bool:
    return value.weekday() == 6


def es_dia_laborable(value: date) -> bool:
    return not es_feriado(value)


def fecha_es_feriado(value: str | date | None) -> bool:
    if isinstance(value, date):
        return es_feriado(value)
    try:
        return es_feriado(date.fromisoformat(str(value or "").strip()))
    except ValueError:
        return False


def dia_operativo_anterior(today: date) -> date:
    cursor = today - timedelta(days=1)
    while not es_dia_laborable(cursor):
        cursor -= timedelta(days=1)
    return cursor
