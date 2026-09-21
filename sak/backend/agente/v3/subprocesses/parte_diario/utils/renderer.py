"""Respuestas deterministicas del proceso parte_diario."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from app.utils.jornada import get_jornada_esperada

from app.models import Nomina, ParteDiarioDetalle
from agente.v3.subprocesses.parte_diario.utils import calendario
from agente.v3.subprocesses.parte_diario.utils.texto import _format_decimal

from agente.v3.subprocesses.parte_diario.domain.models import ConflictoNovedad, EstadoItem, NominaItem, ParteDiarioDraft, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.models import ExecutionResult, TurnPlan, TurnResult
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text


_INTERNAL_NOMINA_STATE_CODES = {"ALT", "BAJ", "TRA"}


# Muestra el borrador y las acciones que confirman la revision sin otra pregunta.
def menu_revision(state) -> str:
    draft = state.draft()
    summary = resumen(draft)
    if not (draft.novedades or draft.pendientes_ambiguos or draft.conflictos_novedad):
        summary = "Sin novedades. Todos presentes."
    volver = "Volver al listado" if state.revision_origen == "listado" else "Volver a carga"
    return (f"Resumen del parte\nObra: {state.nombre_obra}\nFecha: {draft.fecha}\n{summary}\n\n"
            f"1. Guardar\n2. {volver}\n3. Salir y descartar")


# Solicita consentimiento explicito antes de descartar cambios no guardados.
def confirmar_descarte() -> str:
    return "Queres descartar los cambios no guardados?\n1. Si, descartar\n2. No, volver"


# Presenta la fecha del siguiente parte antes de abrirlo.
def propuesta_continuar(fecha: str) -> str:
    return f"Queres cargar el parte del {fecha}?\n1. Si\n2. No, finalizar"


def resumen(state: ParteDiarioDraft) -> str:
    if state.sin_novedades_informado and not state.novedades:
        return "Sin novedades. Todos presentes."
    if not state.novedades and not state.pendientes_ambiguos:
        return "(sin novedades cargadas)"
    rows = []
    for novedad in state.novedades:
        if _is_internal_nomina_state(novedad.estado_codigo):
            continue
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
        if _is_internal_nomina_state(pending.estado_codigo):
            continue
        normalized_name = normalize_text(pending.nombre)
        if normalized_name in shown_pending_names:
            continue
        shown_pending_names.add(normalized_name)
        rows.append(_resumen_pendiente(pending, state.fecha))
    return "\n".join(rows) if rows else "(sin novedades cargadas)"


def resumen_revision(state: ParteDiarioDraft) -> str:
    if state.sin_novedades_informado and not state.novedades and not state.pendientes_ambiguos:
        return "Sin novedades. Todos presentes."

    ausencias: list[str] = []
    horas_extra: list[str] = []
    otra_obra: list[str] = []
    otras: list[str] = []
    pendientes: list[str] = []

    for novedad in state.novedades:
        if _is_internal_nomina_state(novedad.estado_codigo):
            continue
        name = _short_person_name(novedad.nombre)
        code = str(novedad.estado_codigo or "").upper()
        hours = novedad.horas
        if novedad.fuera_de_proyecto:
            otra_obra.append(_review_row(name, _review_hours_suffix(hours, state.fecha)))
            continue
        if code and code != "P":
            ausencias.append(_review_row(name, _state_label(novedad.estado_codigo)))
            continue
        if hours is not None and hours > get_jornada_esperada(state.fecha):
            horas_extra.append(_review_row(name, f"{hours - float(get_jornada_esperada(state.fecha)):g}"))
            continue
        if code == "P" or hours is not None:
            otras.append(_review_row(name, _review_present_suffix(hours)))

    for pending in state.pendientes_ambiguos:
        if _is_internal_nomina_state(pending.estado_codigo):
            continue
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


def _is_internal_nomina_state(code: str | None) -> bool:
    return str(code or "").strip().upper() in _INTERNAL_NOMINA_STATE_CODES


def _review_row(name: str, suffix: str | None = None) -> str:
    clean_suffix = str(suffix or "").strip()
    return f"{name} ({clean_suffix})" if clean_suffix else name


def _review_hours_suffix(hours: float | None, fecha: date | str) -> str | None:
    if hours is None or hours == get_jornada_esperada(fecha):
        return None
    return f"{hours:g}h"


def _review_present_suffix(hours: float | None) -> str | None:
    if hours is None:
        return "Presente"
    return f"{hours:g}h"


def _resumen_pendiente(pending: PendienteAmbiguo, fecha: date | str) -> str:
    estado = pending.estado_codigo or "estado pendiente"
    horas = _pending_hours(pending, fecha)
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


# Muestra los defaults del pendiente usando la fecha del borrador.
def _pending_hours(pending: PendienteAmbiguo, fecha: date | str) -> float | None:
    if pending.horas_extra is not None:
        return float(get_jornada_esperada(fecha)) + pending.horas_extra
    if pending.horas is not None:
        return pending.horas
    normalized_code = str(pending.estado_codigo or "").upper()
    if normalized_code and normalized_code != "P":
        return 0.0
    if pending.fuera_de_proyecto or normalized_code == "P":
        return float(get_jornada_esperada(fecha))
    return None


def _external_label(novedad) -> str:
    if novedad.idnomina is None:
        return " (sin validar)"
    destination = detalle_destino(novedad)
    if destination:
        return f" ({destination})"
    return ""


# Expone obra y encargado de destino sin ocultar datos ya cargados.
def detalle_destino(novedad) -> str:
    if not novedad.fuera_de_proyecto:
        return ""
    project = str(novedad.nombre_proyecto or "").strip()
    manager = str(novedad.nombre_encargado_destino or "").strip()
    if project and manager:
        return f"Destino: {project} / {manager}"
    if project:
        return f"Destino: {project}"
    if manager:
        return f"Encargado destino: {manager}"
    return "Destino: otra obra"


def _project_short_label(nombre_proyecto: str | None) -> str:
    text = str(nombre_proyecto or "").strip()
    if text.lower().startswith("obra "):
        return text[5:].strip()[:4].strip().upper()
    return text[:6].strip()


# Presenta el borrador preparado y pregunta por las novedades de la fecha activa.
def inicio_carga(state) -> str:
    from agente.v3.subprocesses.parte_diario.utils import calendario

    draft = state.draft()
    title = "Parte diario recuperado" if draft.parte_id else "Parte diario en carga"
    question = "Que novedades hubo hoy?" if draft.fecha == calendario.hoy().isoformat() else "Que novedades hubo ese dia?"
    if draft.novedades or draft.pendientes_ambiguos or draft.sin_novedades_informado:
        question = "Queres agregar o corregir alguna novedad?"
    return f"{title}:\nFecha: {_fecha_humana(draft.fecha)}\nObra: {state.nombre_obra}\n\n{resumen(draft)}\n\n{question}"


# Conserva la respuesta de carga y reemplaza las instrucciones de cierre heredadas.
def seguimiento_carga(state, reply: str, *, question: str = "Hay alguna otra novedad?") -> str:
    tails = (
        "Cuando termines, escribi CONFIRMAR.", "Para guardarlo, responde CONFIRMAR.",
        "Para resolver las aclaraciones, responde CONFIRMAR.",
        "Novedades registradas. Escribi CONFIRMAR para guardar.",
        "Para descartar el parte diario completo, responde CANCELAR.",
    )
    reply = reply.strip()
    for tail in tails:
        if reply.endswith(tail):
            reply = reply[:-len(tail)].rstrip()
    if not reply:
        reply = resumen(state.draft())
    if "\nFecha:" in reply and "\nObra:" not in reply:
        lines = reply.splitlines()
        index = next(index for index, line in enumerate(lines) if line.startswith("Fecha:"))
        lines.insert(index + 1, f"Obra: {state.nombre_obra}")
        reply = "\n".join(lines)
    return f"{reply}\n\n{question}"


def actualizado(state: ParteDiarioDraft, errors: list[str] | None = None) -> str:
    prefix = ""
    if errors:
        prefix = "\n".join(errors) + "\n\n"
    return f"{prefix}Parte diario actualizado:\nFecha: {_fecha_humana(state.fecha)}\n\n{resumen(state)}\n\nCuando termines, escribi CONFIRMAR."


# Presenta lo cargado sin anunciar una confirmacion ni exigir guardar.
def mostrar_borrador(state: ParteDiarioDraft) -> str:
    return f"Parte diario cargado:\nFecha: {_fecha_humana(state.fecha)}\n\n{resumen(state)}"


def solicitar_confirmacion(state: ParteDiarioDraft) -> str:
    has_clarifications = bool(state.pendientes_ambiguos or state.conflictos_novedad)
    action = "Para resolver las aclaraciones, responde CONFIRMAR." if has_clarifications else "Para guardarlo, responde CONFIRMAR."
    return f"Parte diario para confirmar:\nFecha: {_fecha_humana(state.fecha)}\n\n{resumen(state)}\n\n{action}"


def confirmar_cierre_validado(state: ParteDiarioDraft) -> str:
    return f"Parte diario listo para cerrar:\nFecha: {_fecha_humana(state.fecha)}\n\n{resumen(state)}\n\nConfirmas cerrar el parte diario?"


def consulta(state: ParteDiarioDraft) -> str:
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
    return "Novedades registradas. Escribi CONFIRMAR para guardar."


def sin_novedades_rechazado() -> str:
    return "Ya hay novedades cargadas. Las conserve. Eliminalas o responde CANCELAR antes de informar todos presentes."


def confirmado(state: ParteDiarioDraft, *, cerrado: bool = False) -> str:
    title = "*PARTE DIARIO CONFIRMADO*" if cerrado else "*PARTE DIARIO GUARDADO*"
    return (
        f"{title}\n"
        "━━━━━━━━━━━━━━\n\n"
        f"*Fecha:* {_fecha_humana(state.fecha)}\n\n"
        "*Novedades*\n"
        f"{_resumen_bullets(state)}"
    )


def _resumen_bullets(state: ParteDiarioDraft) -> str:
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
        options = f"{options}\nNO para descartar la novedad."
        return f"A cual {pending.nombre} te referis?\n{options}"
    if pending.obra_destino_pendiente:
        options = "\n".join(
            f"{option.opcion}. {_destination_option_label(option.nombre)}"
            for option in pending.opciones_proyecto_destino or []
        )
        return f"A que obra fue {pending.nombre}?\n{options}".rstrip()
    if pending.encargado_destino_pendiente:
        options = "\n".join(
            f"{option.opcion}. {option.nombre}"
            for option in pending.opciones_encargado_destino or []
        )
        obra = f" de {pending.nombre_proyecto}" if pending.nombre_proyecto else ""
        return f"A que encargado{obra} corresponde {pending.nombre}?\n{options}".rstrip()
    return preguntar_estado(pending, estados)


def validacion_requerida(question: str) -> str:
    return f"Antes de continuar, necesito completar la validacion pendiente.\n\n{question}"


def _destination_option_label(value: str | None) -> str:
    text = str(value or "").strip()
    return text[:20].rstrip()


def _candidate_label(candidate: NominaItem) -> str:
    details = []
    if candidate.fuera_de_proyecto and candidate.nombre_proyecto:
        details.append(f"asignado a {_project_short_label(candidate.nombre_proyecto)}")
    if candidate.encargado_nombre:
        details.append(f"encargado {candidate.encargado_nombre}")
    suffix = f" ({', '.join(details)})" if details else ""
    return f"{candidate.nombre_completo}{suffix}"


def preguntar_estado(pending: PendienteAmbiguo, estados: list[EstadoItem], *, exigir_numero: bool = False) -> str:
    available = [
        estado for estado in estados
        if estado.abreviatura.upper() not in _INTERNAL_NOMINA_STATE_CODES | {"P"}
    ]
    options = "\n".join(
        f"{index}. {estado.nombre}"
        for index, estado in enumerate(available, start=1)
    )
    suffix = "\nResponde con el numero de una opcion." if exigir_numero else ""
    question = (
        f"{pending.nombre} trabajo {pending.horas:g}h. Cual fue el motivo de la jornada reducida?"
        if pending.horas is not None
        else f"Que le paso a {pending.nombre}?"
    )
    return f"{question}\n{options}{suffix}"


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


# region Resultados de interpretacion y borrador

# Serializa novedades, pendientes y metadata de interpretacion para los consumidores del resultado.
def payload_ejecucion(result: ExecutionResult, *, plan: TurnPlan | None = None) -> dict:
    state = result.next_state
    process_metadata = {
        "status": result.status,
        "operations": result.applied_operations,
    }
    if plan is not None:
        process_metadata["llm_operations"] = [operation.type for operation in plan.operations]
        process_metadata["llm_raw"] = plan.raw_response
        process_metadata["llm_ms"] = plan.llm_ms
    return {
        "type": "parte_diario_reply",
        "reply_to_user": result.reply,
        "parte_listo": result.parte_listo,
        "cerrar_parte": result.cerrar_parte,
        "confirmar_parte": result.cerrar_parte,
        "close_after_materialization": result.parte_listo,
        "cancelado": result.cancelado,
        "oportunidad_id": state.oportunidad_id,
        "idproyecto": state.idproyecto,
        "contacto_id": state.contacto_id,
        "fecha": state.fecha,
        "parte_id_existente": state.parte_id,
        "sin_novedades_informado": state.sin_novedades_informado,
        "novedades": [item.to_dict() for item in state.novedades],
        "pendientes_ambiguos": [item.to_dict() for item in state.pendientes_ambiguos],
        "conflictos_novedad": [item.to_dict() for item in state.conflictos_novedad],
        "errores": result.errors,
        "parte_diario": process_metadata,
    }


# Convierte una ejecucion de novedades en respuesta de dominio y estado serializado.
def resultado_ejecucion(result: ExecutionResult, *, plan: TurnPlan | None = None) -> TurnResult:
    return TurnResult(
        payload=payload_ejecucion(result, plan=plan),
        keep_active=result.keep_active,
        process_state=result.next_state.to_dict(),
    )


# Devuelve un texto junto con el borrador que debe conservar la conversacion.
def respuesta_borrador(state: ParteDiarioDraft, text: str) -> TurnResult:
    return TurnResult(
        payload=payload_ejecucion(ExecutionResult("waiting", state, text)),
        keep_active=True,
        process_state=state.to_dict(),
    )


# Construye una respuesta sin borrador e indica si el procesamiento sigue activo.
def respuesta_simple(text: str, *, keep_active: bool) -> TurnResult:
    return TurnResult(
        payload={"type": "parte_diario_reply", "reply_to_user": text, "parte_listo": False},
        keep_active=keep_active,
    )

# endregion

# region Presentacion de consultas guardadas

# Presenta la nomina general con el nombre de la obra de cada empleado.
def nomina_completa(nominas: list[Nomina], proyectos: dict[int, str]) -> str:
    lines = ["*NOMINA COMPLETA*"]
    for item in nominas[:30]:
        proyecto = proyectos.get(item.idproyecto)
        suffix = f" ({proyecto})" if proyecto else ""
        lines.append(f"- {etiqueta_nomina(item)}{suffix}")
    return "\n".join(lines)

# Presenta las novedades ya filtradas sin realizar consultas de base de datos.
def consulta_novedades(
    filtered: list[tuple[date, ParteDiarioDetalle]], states_by_id: dict[int, str],
    nominas: dict[int, Nomina], proyectos: dict[int, str], proyecto_id: int,
    nombre_obra: str, persona: str | None, normalized_state: str | None,
    solo_horas_extras: bool, agrupar_por: str | None, horas_igual_a: float | None,
) -> str:
    if not filtered:
        subject = f" para {persona}" if persona else ""
        state_text = " con horas extras" if solo_horas_extras else (f" con estado {normalized_state}" if normalized_state else "")
        return f"No encontre novedades{state_text}{subject} en {nombre_obra} en el periodo consultado."

    if str(agrupar_por or "fecha").lower() == "persona":
        grouped_by_person: dict[str, list[str]] = {}
        for item_date, detail in filtered:
            value = item_date.strftime("%d/%m/%Y")
            if solo_horas_extras:
                value = f"{value} ({_format_decimal(Decimal(str(detail.horas)) - get_jornada_esperada(item_date))}h extras)"
            grouped_by_person.setdefault(_persona_detalle(detail, nominas, proyectos, proyecto_id), []).append(value)
        lines = ["Horas extras registradas:" if solo_horas_extras else "Novedades registradas:"]
        for person in sorted(grouped_by_person):
            lines.append(f"- {person}: {', '.join(grouped_by_person[person])}")
        return "\n".join(lines)

    grouped: dict[date, list[str]] = {}
    for item_date, detail in filtered:
        label = _etiqueta_extras(detail, nominas, proyectos, proyecto_id, item_date) if solo_horas_extras else _etiqueta_detalle(detail, states_by_id, nominas, proyectos, proyecto_id)
        grouped.setdefault(item_date, []).append(label)
    if solo_horas_extras:
        title = "Horas extras registradas:"
    elif horas_igual_a == 0:
        title = "Personas que no trabajaron:"
    elif normalized_state == "FAL":
        title = "Faltas registradas:"
    else:
        title = "Novedades registradas:"
    lines = [title]
    for item_date in sorted(grouped.keys(), reverse=True):
        lines.append(f"- {item_date.strftime('%d/%m/%Y')}: " + "; ".join(grouped[item_date]))
    return "\n".join(lines)


# Forma el nombre visible del empleado como apellido y nombre.
def etiqueta_nomina(item: Nomina) -> str:
    return f"{item.apellido}, {item.nombre}"


# Describe un detalle con persona, legajo, procedencia, motivo y horas.
def _etiqueta_detalle(detail: ParteDiarioDetalle, states: dict[int, str], nominas: dict[int, Nomina], proyectos: dict[int, str], proyecto_id: int) -> str:
    name = str(detail.nombre_provisorio or "").strip()
    legajo = ""
    external = ""
    if detail.idnomina:
        nomina = nominas.get(detail.idnomina)
        if nomina is not None:
            name = etiqueta_nomina(nomina)
            legajo = f" (legajo {nomina.nro_legajo})" if nomina.nro_legajo else ""
            external = _procedencia_nomina(nomina, proyectos, proyecto_id)
    if not name:
        name = "Persona sin identificar"
    state = states.get(int(detail.idestado or 0), "estado pendiente")
    hours = _format_decimal(detail.horas)
    description = f", motivo: {detail.descripcion}" if detail.descripcion else ""
    return f"{name}{legajo}{external}: {state}, {hours}h{description}"


# Obtiene el nombre y la procedencia de un detalle, incluso si la persona es provisoria.
def _persona_detalle(detail: ParteDiarioDetalle, nominas: dict[int, Nomina], proyectos: dict[int, str], proyecto_id: int) -> str:
    name = str(detail.nombre_provisorio or "").strip()
    if detail.idnomina:
        nomina = nominas.get(detail.idnomina)
        if nomina is not None:
            return f"{etiqueta_nomina(nomina)}{_procedencia_nomina(nomina, proyectos, proyecto_id)}"
    return name or "Persona sin identificar"


# Describe la obra de procedencia cuando el empleado es externo.
def _procedencia_nomina(nomina: Nomina, proyectos: dict[int, str], proyecto_id: int) -> str:
    if nomina.idproyecto == proyecto_id:
        return ""
    project_name = None
    if nomina.idproyecto:
        project = proyectos.get(nomina.idproyecto)
        project_name = project
    suffix = f": {project_name}" if project_name else ""
    return f" (otra nomina{suffix})"


# Describe el excedente sobre la jornada de esa fecha y el total informado.
def _etiqueta_extras(detail: ParteDiarioDetalle, nominas: dict[int, Nomina], proyectos: dict[int, str], proyecto_id: int, fecha: date) -> str:
    extra = max(0.0, float(detail.horas) - float(get_jornada_esperada(fecha)))
    return (
        f"{_persona_detalle(detail, nominas, proyectos, proyecto_id)}: "
        f"{_format_decimal(Decimal(str(extra)))}h extras ({_format_decimal(detail.horas)}h reportadas)"
    )

# endregion
