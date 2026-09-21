"""Interpretacion local de respaldo e identidades de LISTADO; no accede a datos."""

from __future__ import annotations

import re
from dataclasses import dataclass

from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, NominaItem
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation, TurnPlan
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text, _normalize_command

_PRE_RESOLVED_NOMINA_RE = re.compile(
    r"^\s*\[idnomina=(\d+)\]\s*([^:\n]+?)\s*:\s*(.*?)\s*$",
    flags=re.IGNORECASE,
)


# region Identidades normalizadas de LISTADO

# Conserva el ID, nombre y texto de una seleccion normalizada de LISTADO.
@dataclass(frozen=True, slots=True)
class _PreResolvedNominaEntry:
    idnomina: int
    nombre: str
    text: str


# Mantiene las identidades elegidas en LISTADO y descarta IDs no respaldados por su normalizacion.
def _apply_pre_resolved_nomina(plan: TurnPlan, message_text: str) -> str | None:
    entries = _pre_resolved_nomina_entries(message_text)
    operations = [
        operation
        for operation in plan.operations
        if operation.type in {"agregar_novedad", "modificar_novedad", "eliminar_novedad"}
    ]
    if not operations:
        return
    if not entries:
        # En texto libre el LLM identifica a la persona por nombre, pero no es una
        # fuente confiable de IDs. El dominio resolvera esos nombres contra la
        # nomina vigente. LISTADO es el unico camino que inserta IDs verificados.
        for operation in operations:
            operation.idnomina = None
        return

    remaining_entries = list(entries)
    for operation in operations:
        selected = _match_pre_resolved_entry(operation, remaining_entries)
        if selected is None:
            selected = next((entry for entry in remaining_entries if entry.idnomina == operation.idnomina), None)
        if selected is None and len(operations) == len(entries) and remaining_entries:
            selected = remaining_entries[0]
        if selected is None:
            return "No pude vincular una novedad con los empleados elegidos en LISTADO. Indica numero y motivo nuevamente."
        operation.idnomina = selected.idnomina
        operation.nombre = selected.nombre
        remaining_entries.remove(selected)


# Vincula por nombre una operacion con una unica entrada normalizada de LISTADO.
def _match_pre_resolved_entry(
    operation: ParteDiarioOperation,
    entries: list[_PreResolvedNominaEntry],
) -> _PreResolvedNominaEntry | None:
    operation_name = normalize_text(operation.nombre)
    if not operation_name:
        return None
    matches = [
        entry
        for entry in entries
        if operation_name == normalize_text(entry.nombre)
        or operation_name in normalize_text(entry.nombre)
        or normalize_text(entry.nombre) in operation_name
    ]
    return matches[0] if len(matches) == 1 else None


# Aisla el texto de la persona elegida en LISTADO para resolver su destino.
def _message_text_for_operation(operation: ParteDiarioOperation, message_text: str) -> str:
    entries = _pre_resolved_nomina_entries(message_text)
    if not entries:
        return message_text
    if operation.idnomina is not None:
        selected = next((entry for entry in entries if entry.idnomina == operation.idnomina), None)
        if selected is not None:
            return selected.text
    selected = _match_pre_resolved_entry(operation, entries)
    return selected.text if selected is not None else message_text


# Lee las lineas con idnomina insertadas por la normalizacion de LISTADO.
def _pre_resolved_nomina_entries(message_text: str) -> list[_PreResolvedNominaEntry]:
    entries: list[_PreResolvedNominaEntry] = []
    for line in str(message_text or "").splitlines():
        match = _PRE_RESOLVED_NOMINA_RE.match(line)
        if not match:
            continue
        name = match.group(2).strip()
        detail = match.group(3).strip()
        entries.append(
            _PreResolvedNominaEntry(
                idnomina=int(match.group(1)),
                nombre=name,
                text=f"{name} {detail}".strip(),
            )
        )
    return entries

# endregion


# region Interpretacion de respaldo y consultas locales

# Corrige la transcripcion Falcon por falto solo cuando no existe ese nombre en la nomina.
def _normalize_attendance_transcription(
    text: str | None,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> str:
    normalized = _normalize_command(text)
    if "falcon" not in normalized.split():
        return str(text or "")

    active_tokens = {
        token
        for item in [*nominas_proyecto, *nominas_completas]
        for token in normalize_text(f"{item.apellido} {item.nombre}").split()
    }
    if "falcon" in active_tokens:
        return str(text or "")
    return re.sub(r"\bfalc[oó]n\b", "falto", str(text or ""), flags=re.IGNORECASE)


# Detecta indicios de una nueva novedad durante una aclaracion de empleado.
def _looks_like_attendance_update(text: str | None) -> bool:
    tokens = set(_normalize_command(text).split())
    update_terms = {
        "falto",
        "falta",
        "faltaron",
        "ausente",
        "enfermo",
        "enfermedad",
        "accidente",
        "vacaciones",
        "permiso",
        "presente",
        "trabajo",
        "vino",
        "horas",
        "hora",
        "hs",
    }
    return bool(tokens & update_terms)


# Interpreta novedades simples solo si falla el LLM; no cubre consultas ni correcciones.
def _fallback_simple_attendance_plan(message: str | None, estados: list[EstadoItem]) -> TurnPlan | None:
    active_codes = {item.abreviatura.upper() for item in estados}
    operations: list[ParteDiarioOperation] = _parse_plural_absence_operations(message, active_codes)
    for segment in _split_simple_attendance_segments(message):
        operation = _parse_simple_attendance_segment(segment, active_codes)
        if operation is not None:
            operations.append(operation)
    if not operations:
        return None
    return TurnPlan(operations=operations)


# Convierte una expresion de faltas de varias personas en operaciones individuales.
def _parse_plural_absence_operations(
    message: str | None,
    active_codes: set[str],
) -> list[ParteDiarioOperation]:
    if "FAL" not in active_codes:
        return []
    normalized = _normalize_command(message)
    match = re.match(r"^faltaron\s+(?P<nombres>.+)$", normalized)
    if not match:
        return []
    names = [
        _clean_simple_name(name)
        for name in re.split(r"[,;\n]+|\s+y\s+", match.group("nombres"), flags=re.IGNORECASE)
        if _clean_simple_name(name)
    ]
    return [
        ParteDiarioOperation(type="agregar_novedad", nombre=name, estado_codigo="FAL")
        for name in names
    ]


# Separa novedades simples por puntuacion o conjuncion para el interprete local.
def _split_simple_attendance_segments(message: str | None) -> list[str]:
    text = str(message or "").strip()
    if not text:
        return []
    parts = re.split(r"[,;\n]+|\s+y\s+", text, flags=re.IGNORECASE)
    return [part.strip(" .") for part in parts if part.strip(" .")]


# Reconoce una falta, enfermedad o presencia en un segmento de texto simple.
def _parse_simple_attendance_segment(
    segment: str,
    active_codes: set[str],
) -> ParteDiarioOperation | None:
    normalized = _normalize_command(segment)
    hours = _parse_simple_hours(normalized)

    absence_prefix = re.match(
        r"^(?:falto|falta|no\s+vino|no\s+trabajo)\s+(?P<nombre>.+?)"
        r"(?:\s+\d{1,2}(?:[,.]\d+)?\s*(?:h|hs|horas?))?$",
        normalized,
    )
    if absence_prefix and "FAL" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(absence_prefix.group("nombre")),
            estado_codigo="FAL",
        )

    absence_suffix = re.match(
        r"^(?P<nombre>.+?)\s+(?:falto|falta|no\s+vino|no\s+trabajo)$",
        normalized,
    )
    if absence_suffix and "FAL" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(absence_suffix.group("nombre")),
            estado_codigo="FAL",
        )

    illness = re.match(
        r"^(?P<nombre>.+?)\s+(?:esta\s+)?(?:enfermo|enferma|enfermedad)$",
        normalized,
    )
    if illness and "ENF" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(illness.group("nombre")),
            estado_codigo="ENF",
        )

    worked = re.match(
        r"^(?P<nombre>.+?)\s+(?:trabajo|vino|presente)(?:\s+\d{1,2}(?:[,.]\d+)?\s*(?:h|hs|horas?))?$",
        normalized,
    )
    if worked and "P" in active_codes:
        return ParteDiarioOperation(
            type="agregar_novedad",
            nombre=_clean_simple_name(worked.group("nombre")),
            estado_codigo="P",
            horas=hours,
        )

    return None


# Extrae las horas numericas de una novedad simple.
def _parse_simple_hours(normalized_segment: str) -> float | None:
    match = re.search(r"\b(\d{1,2}(?:[,.]\d+)?)\s*(?:h|hs|horas?)\b", normalized_segment)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


# Limpia espacios y puntuacion del nombre extraido por el interprete local.
def _clean_simple_name(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip(" .")


# Reconoce consultas de parte o nomina que no deben consumir una aclaracion pendiente.
def _parse_local_readonly_operation(command: str) -> str | None:
    tokens = set(command.split())
    asks_to_show = any(
        token.startswith(("mostr", "muestr", "consult", "resum")) or token == "ver"
        for token in tokens
    )
    if not asks_to_show:
        return None
    if "parte" in tokens:
        return "mostrar_parte"
    if "nomina" in tokens or "personal" in tokens or "empleado" in tokens or "empleados" in tokens:
        return "mostrar_nomina"
    return None


# Obtiene el alcance de nomina indicado en las operaciones interpretadas.
def _nomina_scope_from_operations(operations: list[ParteDiarioOperation]) -> str | None:
    for operation in operations:
        if operation.type == "mostrar_nomina" and operation.alcance in {"propia", "obra", "global"}:
            return operation.alcance
    return None


# Reconoce el pedido de nomina completa de la obra.
def _requests_full_nomina(text: str | None) -> bool:
    command = _normalize_command(text)
    if not command:
        return False
    full_phrases = {
        "toda la nomina",
        "toda nomina",
        "toda la obra",
        "toda obra",
        "todas las nominas",
        "todas nominas",
        "nomina completa",
        "nomina general",
        "nomina global",
        "personal completo",
        "personal general",
        "personal global",
        "todo el personal",
        "todos los empleados",
        "todos los empleados de la obra",
    }
    if any(phrase in command for phrase in full_phrases):
        return True
    tokens = set(command.split())
    return bool(
        "nomina" in tokens
        and ({"toda", "todas", "completa", "completo", "general", "global"} & tokens)
    )


# Reconoce un pedido explicito de personal de toda la empresa.
def _requests_global_nomina(text: str | None) -> bool:
    command = _normalize_command(text)
    if not command:
        return False
    global_phrases = {
        "toda la empresa",
        "toda empresa",
        "todas las obras",
        "todas obras",
        "todos los proyectos",
        "todos proyectos",
        "no solo la obra",
        "no solo esta obra",
        "no solo de esta obra",
        "no solo la de esta obra",
    }
    return any(phrase in command for phrase in global_phrases)

# endregion
