"""Calendario operativo para parte_diario."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import re
from zoneinfo import ZoneInfo

from agente.v3.subprocesses.parte_diario.utils.texto import _normalize_command

BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")


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


# region Referencias de fecha y rangos de consulta

# Obtiene la fecha actual en la zona horaria de Buenos Aires.
def hoy() -> date:
    return datetime.now(BUENOS_AIRES).date()


# Resuelve hoy, ayer o una fecha ISO; devuelve None si no puede interpretarla.
def parsear_fecha(value: str | None) -> date | None:
    normalized = _normalize_command(value)
    if normalized == "hoy":
        return hoy()
    if normalized == "ayer":
        return hoy() - timedelta(days=1)
    try:
        return date.fromisoformat(str(value or "").strip())
    except ValueError:
        return None


# Valida el rango de consulta; usa los ultimos treinta dias para los extremos omitidos.
def parsear_rango(desde: str | None, hasta: str | None) -> tuple[date, date, str | None]:
    default_end = hoy()
    default_start = default_end - timedelta(days=30)
    start, start_error = parsear_iso_fecha(desde) if desde else (default_start, None)
    end, end_error = parsear_iso_fecha(hasta) if hasta else (default_end, None)
    if start_error:
        return default_start, default_end, start_error
    if end_error:
        return default_start, default_end, end_error
    if start > end:
        return default_start, default_end, "El rango de fechas esta invertido."
    return start, end, None


# Interpreta una fecha ISO de consulta y devuelve un mensaje si es invalida.
def parsear_iso_fecha(value: str | None) -> tuple[date, str | None]:
    try:
        return date.fromisoformat(str(value or "").strip()), None
    except ValueError:
        return hoy(), "No pude interpretar la fecha de la consulta."


# Detecta referencias de fecha para impedir que el interprete cambie el dia sin indicacion.
def tiene_referencia_fecha(text: str | None) -> bool:
    command = _normalize_command(text)
    if not command:
        return False
    tokens = set(command.split())
    relative_terms = {
        "hoy",
        "ayer",
        "anteayer",
        "anteanoche",
        "manana",
        "pasado",
        "pasada",
        "anterior",
        "fecha",
        "dia",
    }
    weekdays = {"lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"}
    if tokens & relative_terms or tokens & weekdays:
        return True
    if re.search(r"\b\d{1,2}\s*(?:/|-)\s*\d{1,2}(?:\s*(?:/|-)\s*\d{2,4})?\b", command):
        return True
    if re.search(
        r"\b\d{1,2}\s+de\s+"
        r"(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b",
        command,
    ):
        return True
    return False

# endregion
