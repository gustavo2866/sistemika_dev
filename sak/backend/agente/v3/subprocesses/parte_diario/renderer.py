"""Respuestas deterministicas del proceso parte_diario."""

from __future__ import annotations

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
        horas = f"{novedad.horas:g}h" if novedad.horas is not None else "horas pendientes"
        estado = novedad.estado_codigo or "estado pendiente"
        externo = _external_label(novedad)
        motivo = (
            f", motivo: {novedad.descripcion}"
            if novedad.descripcion and str(novedad.estado_codigo or "").upper() != "P"
            else ""
        )
        rows.append(f"- {novedad.nombre}{externo}: {estado}, {horas}{motivo}")
    shown_pending_names = set()
    for pending in state.pendientes_ambiguos:
        normalized_name = normalize_text(pending.nombre)
        if normalized_name in shown_pending_names:
            continue
        shown_pending_names.add(normalized_name)
        rows.append(_resumen_pendiente(pending))
    return "\n".join(rows)


def _resumen_pendiente(pending: PendienteAmbiguo) -> str:
    estado = pending.estado_codigo or "estado pendiente"
    horas = _pending_hours(pending)
    horas_text = f"{horas:g}h" if horas is not None else "horas pendientes"
    motivo = (
        f", motivo: {pending.descripcion}"
        if pending.descripcion and str(pending.estado_codigo or "").upper() != "P"
        else ""
    )
    return f"- {pending.nombre} (**a validar): {estado}, {horas_text}{motivo}"


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
        return f" (asignado a {novedad.nombre_proyecto})"
    return ""


def actualizado(state: ParteDiarioState, errors: list[str] | None = None) -> str:
    prefix = ""
    if errors:
        prefix = "\n".join(errors) + "\n\n"
    return f"{prefix}Parte diario actualizado:\nFecha: {state.fecha}\n\n{resumen(state)}\n\nCuando termines, escribi CONFIRMAR."


def solicitar_confirmacion(state: ParteDiarioState) -> str:
    has_clarifications = bool(state.pendientes_ambiguos or state.conflictos_novedad)
    action = "Para resolver las aclaraciones, responde CONFIRMAR." if has_clarifications else "Para guardarlo, responde CONFIRMAR."
    return f"Parte diario para confirmar:\nFecha: {state.fecha}\n\n{resumen(state)}\n\n{action}"


def consulta(state: ParteDiarioState) -> str:
    if state.parte_id is None:
        return f"No hay un parte diario guardado para el {state.fecha}."
    return confirmado(state)


def solicitar_cancelacion() -> str:
    return "Para descartar el parte diario completo, responde CANCELAR."


def cancelado() -> str:
    return "Parte diario cancelado."


def falta_informacion() -> str:
    return "Todavia no informaste novedades. Indicalas o escribi SIN NOVEDADES si todos estuvieron presentes."


def sin_novedades_registrado() -> str:
    return "Asistencia completa registrada. Escribi CONFIRMAR para guardar."


def sin_novedades_rechazado() -> str:
    return "Ya hay novedades cargadas. Las conserve. Eliminalas o responde CANCELAR antes de informar todos presentes."


def confirmado(state: ParteDiarioState, *, cerrado: bool = False) -> str:
    title = "*PARTE DIARIO CERRADO*" if cerrado else "*PARTE DIARIO REGISTRADO*"
    return (
        f"{title}\n"
        "━━━━━━━━━━━━━━\n\n"
        f"*Fecha:* {state.fecha}\n\n"
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
    if candidate.nro_legajo:
        details.append(f"legajo {candidate.nro_legajo}")
    if candidate.fuera_de_proyecto and candidate.nombre_proyecto:
        details.append(f"asignado a {candidate.nombre_proyecto}")
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
    return "*NOMINA ACTIVA*\n" + "\n".join(f"- {item.nombre_completo}" for item in items)


def parte_cerrado(fecha: str) -> str:
    return f"El parte diario del {fecha} ya esta cerrado y no puede modificarse desde WhatsApp."


def preguntar_cambio_fecha(fecha_actual: str | None, fecha_propuesta: str) -> str:
    return (
        f"El parte en carga corresponde al {fecha_actual}. Para cambiarlo al {fecha_propuesta}, "
        "responde CAMBIAR FECHA. Para conservar la fecha actual, responde MANTENER FECHA."
    )


def fecha_original_conservada(fecha: str | None) -> str:
    return f"Conserve el parte del {fecha}. Podes seguir cargando novedades."


def bloquear_otro_proceso() -> str:
    return "Hay un parte diario abierto. Confirmalo o responde CANCELAR antes de iniciar otro proceso."
