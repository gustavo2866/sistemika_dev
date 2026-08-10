"""Respuestas deterministicas del proceso parte_diario."""

from __future__ import annotations

from datetime import date

from agente.v3.subprocesses.parte_diario.models import (
    ConflictoNovedad,
    EstadoItem,
    NominaItem,
    ParteDiarioState,
    PendienteAmbiguo,
)
from agente.v3.subprocesses.parte_diario.resolver import normalize_text


def resumen(state: ParteDiarioState) -> str:
    if state.sin_novedades_informado and not state.novedades:
        return "Sin novedades. Todos presentes."
    if not state.novedades and not state.pendientes_ambiguos:
        return "(sin novedades cargadas)"
    rows = []
    for novedad in state.novedades:
        estado = novedad.estado_codigo or "estado pendiente"
        externo = _external_label(novedad)
        horas = _hours_text(novedad.estado_codigo, novedad.horas)
        hours_part = f", {horas}" if horas else ""
        motivo = (
            f", motivo: {novedad.descripcion}"
            if novedad.descripcion and str(novedad.estado_codigo or "").upper() != "P"
            else ""
        )
        rows.append(f"- {novedad.nombre}{externo}: {estado}{hours_part}{motivo}")
    shown_pending_names = set()
    for pending in state.pendientes_ambiguos:
        normalized_name = normalize_text(pending.nombre)
        if normalized_name in shown_pending_names:
            continue
        shown_pending_names.add(normalized_name)
        rows.append(_resumen_pendiente(pending))
    return "\n".join(rows)


def resumen_revision(state: ParteDiarioState) -> str:
    if state.sin_novedades_informado and not state.novedades and not state.pendientes_ambiguos:
        return "Sin novedades. Todos presentes."

    ausencias: list[str] = []
    horas_extra: list[str] = []
    otra_obra: list[str] = []
    otras: list[str] = []
    pendientes: list[str] = []

    for novedad in state.novedades:
        name = _short_person_name(novedad.nombre)
        code = str(novedad.estado_codigo or "").upper()
        hours = novedad.horas
        if novedad.fuera_de_proyecto:
            otra_obra.append(_review_row(name, _review_hours_suffix(hours)))
            continue
        if code and code != "P":
            ausencias.append(_review_row(name, _state_label(novedad.estado_codigo)))
            continue
        if hours is not None and hours > 9:
            horas_extra.append(_review_row(name, f"{hours - 9:g}"))
            continue
        if code == "P" or hours is not None:
            otras.append(_review_row(name, _review_present_suffix(hours)))

    for pending in state.pendientes_ambiguos:
        name = _short_person_name(pending.nombre)
        suffix = _state_label(pending.estado_codigo) or "a validar"
        pendientes.append(_review_row(name, suffix))

    groups = [
        ("Ausencias", ausencias),
        ("Horas extra", horas_extra),
        ("Otra obra", otra_obra),
        ("Otras novedades", otras),
        ("Pendientes de validar", pendientes),
    ]
    lines: list[str] = []
    for title, rows in groups:
        if not rows:
            continue
        if lines:
            lines.append("")
        lines.append(title)
        lines.extend(f"- {row}" for row in rows)
    return "\n".join(lines) if lines else "(sin novedades cargadas)"


def _short_person_name(value: str | None) -> str:
    text = str(value or "").strip()
    return text


def _state_label(code: str | None) -> str:
    labels = {
        "ACC": "Accidente",
        "ENF": "Enfermedad",
        "FAL": "Falta",
        "FER": "Feriado",
        "LLV": "Lluvia",
        "P": "Presente",
        "PER": "Permiso",
        "VAC": "Vacaciones",
    }
    return labels.get(str(code or "").upper(), str(code or "").upper())


def _review_row(name: str, suffix: str | None = None) -> str:
    clean_suffix = str(suffix or "").strip()
    return f"{name} ({clean_suffix})" if clean_suffix else name


def _review_hours_suffix(hours: float | None) -> str | None:
    if hours is None or hours == 9:
        return None
    return f"{hours:g}h"


def _review_present_suffix(hours: float | None) -> str | None:
    if hours is None:
        return "Presente"
    return f"{hours:g}h"


def _resumen_pendiente(pending: PendienteAmbiguo) -> str:
    estado = pending.estado_codigo or "estado pendiente"
    horas = _pending_hours(pending)
    horas_text = _hours_text(pending.estado_codigo, horas)
    hours_part = f", {horas_text}" if horas_text else ""
    motivo = (
        f", motivo: {pending.descripcion}"
        if pending.descripcion and str(pending.estado_codigo or "").upper() != "P"
        else ""
    )
    return f"- {pending.nombre} (**a validar): {estado}{hours_part}{motivo}"


def _hours_text(estado_codigo: str | None, horas: float | None) -> str:
    if str(estado_codigo or "").upper() == "FAL" and horas in {0, 0.0, None}:
        return ""
    return f"{horas:g}h" if horas is not None else "horas pendientes"


def _pending_hours(pending: PendienteAmbiguo) -> float | None:
    if pending.horas_extra is not None:
        return 9.0 + pending.horas_extra
    if pending.horas is not None:
        return pending.horas
    normalized_code = str(pending.estado_codigo or "").upper()
    if normalized_code and normalized_code != "P":
        return 0.0
    if pending.fuera_de_proyecto or normalized_code == "P":
        return 9.0
    return None


def _external_label(novedad) -> str:
    if novedad.idnomina is None:
        return " (sin validar)"
    if novedad.fuera_de_proyecto and novedad.nombre_proyecto:
        return f" ({_project_short_label(novedad.nombre_proyecto)})"
    return ""


def _project_short_label(nombre_proyecto: str | None) -> str:
    return str(nombre_proyecto or "").strip()[:6].strip()


def actualizado(state: ParteDiarioState, errors: list[str] | None = None) -> str:
    prefix = ""
    if errors:
        prefix = "\n".join(errors) + "\n\n"
    return f"{prefix}Parte diario actualizado:\nFecha: {_fecha_humana(state.fecha)}\n\n{resumen(state)}\n\nCuando termines, escribi CONFIRMAR."


def solicitar_confirmacion(state: ParteDiarioState) -> str:
    has_clarifications = bool(state.pendientes_ambiguos or state.conflictos_novedad)
    action = "Para resolver las aclaraciones, responde CONFIRMAR." if has_clarifications else "Para guardarlo, responde CONFIRMAR."
    return f"Parte diario para confirmar:\nFecha: {_fecha_humana(state.fecha)}\n\n{resumen(state)}\n\n{action}"


def confirmar_cierre_validado(state: ParteDiarioState) -> str:
    return f"Parte diario listo para cerrar:\nFecha: {_fecha_humana(state.fecha)}\n\n{resumen(state)}\n\nConfirmas cerrar el parte diario?"


def consulta(state: ParteDiarioState) -> str:
    if state.parte_id is None:
        return f"No hay un parte diario guardado para el {_fecha_humana(state.fecha)}."
    return confirmado(state)


def solicitar_cancelacion() -> str:
    return "Para descartar el parte diario completo, responde CANCELAR."


def cancelado() -> str:
    return "Parte diario cancelado."


def falta_informacion() -> str:
    return "Todavia no informaste novedades. Indicalas o escribi SIN NOVEDADES si todos estuvieron presentes."


def sin_novedades_confirmado() -> str:
    return "Asistencia completa registrada. Escribi CONFIRMAR para guardar."


def sin_novedades_rechazado() -> str:
    return "Ya hay novedades cargadas. Las conserve. Eliminalas o responde CANCELAR antes de informar todos presentes."


def confirmado(state: ParteDiarioState, *, cerrado: bool = False) -> str:
    title = "*PARTE DIARIO CONFIRMADO*" if cerrado else "*PARTE DIARIO GUARDADO*"
    return (
        f"{title}\n"
        "━━━━━━━━━━━━━━\n\n"
        f"*Fecha:* {_fecha_humana(state.fecha)}\n\n"
        "*Novedades*\n"
        f"{_resumen_bullets(state)}"
    )


def _resumen_bullets(state: ParteDiarioState) -> str:
    return "\n".join(
        f"• {row[2:]}" if row.startswith("- ") else row
        for row in resumen(state).splitlines()
    )


def preguntar_pendiente(pending: PendienteAmbiguo, estados: list[EstadoItem]) -> str:
    if pending.nombre_no_encontrado:
        return f"No encontre a {pending.nombre} en la nomina activa. Indica el nombre correcto."
    if pending.nombre_pendiente:
        candidates = pending.candidatos or []
        options = "\n".join(
            f"{index}. {_candidate_label(candidate)}"
            for index, candidate in enumerate(candidates, start=1)
        )
        unvalidated_option = f"{len(candidates) + 1}. Registrar como {pending.nombre} sin validar"
        options = f"{options}\n{unvalidated_option}" if options else unvalidated_option
        return f"A cual {pending.nombre} te referis?\n{options}"
    return preguntar_estado(pending, estados)


def validacion_requerida(question: str) -> str:
    return f"Antes de continuar, necesito completar la validacion pendiente.\n\n{question}"


def _candidate_label(candidate: NominaItem) -> str:
    details = []
    if candidate.fuera_de_proyecto and candidate.nombre_proyecto:
        details.append(f"asignado a {_project_short_label(candidate.nombre_proyecto)}")
    if candidate.encargado_nombre:
        details.append(f"encargado {candidate.encargado_nombre}")
    suffix = f" ({', '.join(details)})" if details else ""
    return f"{candidate.nombre_completo}{suffix}"


def preguntar_estado(pending: PendienteAmbiguo, estados: list[EstadoItem], *, exigir_numero: bool = False) -> str:
    available = [estado for estado in estados if estado.abreviatura.upper() != "P"]
    options = "\n".join(
        f"{index}. {estado.nombre}"
        for index, estado in enumerate(available, start=1)
    )
    suffix = "\nResponde con el numero de una opcion." if exigir_numero else ""
    return f"Que le paso a {pending.nombre}?\n{options}{suffix}"


def preguntar_conflicto(conflict: ConflictoNovedad) -> str:
    options = "\n".join(
        f"{index}. {option.estado_codigo or 'sin estado'}, {option.horas:g}h"
        for index, option in enumerate(conflict.opciones, start=1)
    )
    return f"{conflict.nombre} fue mencionado mas de una vez. Que novedad queres registrar?\n{options}"


def mostrar_nomina(items: list[NominaItem]) -> str:
    if not items:
        return "No hay personal activo asignado a la obra."
    sorted_items = sorted(items, key=lambda item: (_sort_key(item.apellido), _sort_key(item.nombre)))
    groups = _nomina_groups(sorted_items)
    lines = ["*NOMINA ACTIVA*", f"{len(sorted_items)} personas", ""]
    lines.extend(f"{label}: {', '.join(_nomina_compact_label(item) for item in group)}" for label, group in groups)
    return "\n".join(lines)


def _nomina_label(item: NominaItem) -> str:
    return item.nombre_completo


def _nomina_compact_label(item: NominaItem) -> str:
    parts = [str(item.apellido or "").strip(), str(item.nombre or "").strip()]
    return " ".join(part for part in parts if part)


def _nomina_groups(items: list[NominaItem], *, target_size: int = 8) -> list[tuple[str, list[NominaItem]]]:
    groups: list[tuple[str, list[NominaItem]]] = []
    for index in range(0, len(items), target_size):
        group = items[index : index + target_size]
        groups.append((_nomina_group_label(group), group))
    return groups


def _nomina_group_label(items: list[NominaItem]) -> str:
    if not items:
        return ""
    first = _initial(items[0].apellido or items[0].nombre)
    last = _initial(items[-1].apellido or items[-1].nombre)
    return first if first == last else f"{first}-{last}"


def _initial(value: str | None) -> str:
    text = _sort_key(value)
    return text[:1].upper() if text else "#"


def _sort_key(value: str | None) -> str:
    replacements = str.maketrans("áéíóúÁÉÍÓÚñÑ", "aeiouAEIOUnN")
    return str(value or "").strip().translate(replacements).lower()


def parte_cerrado(fecha: str) -> str:
    return f"El parte diario del {_fecha_humana(fecha)} ya esta confirmado y no puede modificarse desde WhatsApp."


def preguntar_cambio_fecha(fecha_actual: str | None, fecha_propuesta: str) -> str:
    return (
        f"El parte en carga corresponde al {_fecha_humana(fecha_actual)}. Para cambiarlo al {_fecha_humana(fecha_propuesta)}, "
        "responde CAMBIAR FECHA. Para conservar la fecha actual, responde MANTENER FECHA."
    )


def fecha_original_conservada(fecha: str | None) -> str:
    return f"Conserve el parte del {_fecha_humana(fecha)}. Podes seguir cargando novedades."


def bloquear_otro_proceso() -> str:
    return "Hay un parte diario abierto. Confirmalo o responde CANCELAR antes de iniciar otro proceso."


def _weekday_label(value: date) -> str:
    return ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"][value.weekday()]


def _fecha_humana(value: date | str | None) -> str:
    if isinstance(value, date):
        target_date = value
    else:
        try:
            target_date = date.fromisoformat(str(value or "").strip())
        except ValueError:
            return str(value or "").strip()
    return f"{_weekday_label(target_date)} {target_date.strftime('%d/%m/%Y')}"
