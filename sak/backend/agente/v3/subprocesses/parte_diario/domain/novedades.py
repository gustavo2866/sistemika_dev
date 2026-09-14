"""Executor puro del proceso parte_diario."""

from __future__ import annotations

from datetime import date
from app.utils.jornada import get_jornada_esperada

_RESERVED_OPERATIONS = {"confirmar", "cancelar"}
_MUTATING_OPERATIONS = {"agregar_novedad", "modificar_novedad", "eliminar_novedad", "sin_novedades"}

from agente.v3.subprocesses.parte_diario.utils import renderer
from agente.v3.subprocesses.parte_diario.domain.models import ConflictoNovedad, EstadoItem, NominaItem, NovedadPersonal, ParteDiarioDraft, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.models import ExecutionResult, ParteDiarioOperation, TurnPlan
from agente.v3.subprocesses.parte_diario.domain.empleados import NominaResolver
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text


KNOWN_OPERATIONS = {
    "retomar_carga",
    "agregar_novedad",
    "modificar_novedad",
    "eliminar_novedad",
    "pedir_aclaracion",
    "set_fecha",
    "mostrar_parte",
    "mostrar_nomina",
    "sin_novedades",
    "solicitar_confirmacion",
    "solicitar_cancelacion",
    "request_other_process",
    "confirmar",
    "cancelar",
    "offtopic",
}


def execute_plan(
    state: ParteDiarioDraft,
    plan: TurnPlan,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
    estados: list[EstadoItem],
    *,
    nominas_visibles: list[NominaItem] | None = None,
) -> ExecutionResult:
    current = state.copy()
    applied: list[str] = []
    errors: list[str] = []
    status = "clarification"

    for operation in plan.operations:
        op_type = operation.type
        if op_type not in KNOWN_OPERATIONS:
            continue
        applied.append(op_type)

        if op_type == "retomar_carga":
            return ExecutionResult("resumed", current, "No se aplicaron cambios.", applied_operations=applied)

        if op_type == "agregar_novedad":
            error = _agregar_novedad(current, operation, nominas_proyecto, nominas_completas, estados)
            if error:
                errors.append(error)
            else:
                status = "updated"
            continue

        if op_type == "modificar_novedad":
            error = _modificar_novedad(current, operation, estados, nominas_proyecto, nominas_completas)
            if error:
                errors.append(error)
            else:
                status = "updated"
            continue

        if op_type == "eliminar_novedad":
            error = _eliminar_novedad(current, operation)
            if error:
                errors.append(error)
            else:
                status = "updated"
            continue

        if op_type == "pedir_aclaracion":
            reply = operation.reply or plan.reply or "Necesito una aclaracion para continuar."
            return ExecutionResult("clarification", current, reply, applied_operations=applied)

        if op_type == "mostrar_parte":
            return ExecutionResult("shown", current, renderer.mostrar_borrador(current), applied_operations=applied)

        if op_type == "mostrar_nomina":
            items = nominas_visibles if nominas_visibles is not None else nominas_proyecto
            items = _filter_nomina_items(items, operation.nombre)
            return ExecutionResult(
                "shown_nomina",
                current,
                renderer.mostrar_nomina(items),
                applied_operations=applied,
            )

        if op_type == "sin_novedades":
            if current.novedades or current.pendientes_ambiguos or current.conflictos_novedad:
                return ExecutionResult(
                    "confirmation_required",
                    current,
                    renderer.solicitar_confirmacion(current),
                    applied_operations=applied,
                )
            current.sin_novedades_informado = True
            return ExecutionResult(
                "sin_novedades",
                current,
                renderer.sin_novedades_confirmado(),
                applied_operations=applied,
            )

        if op_type == "solicitar_confirmacion":
            return ExecutionResult(
                "confirmation_required",
                current,
                renderer.solicitar_confirmacion(current),
                applied_operations=applied,
            )

        if op_type == "solicitar_cancelacion":
            return ExecutionResult(
                "cancel_confirmation_required",
                current,
                renderer.solicitar_cancelacion(),
                applied_operations=applied,
            )

        if op_type == "request_other_process":
            return ExecutionResult(
                "other_process_blocked",
                current,
                renderer.bloquear_otro_proceso(),
                applied_operations=applied,
            )

        if op_type == "confirmar":
            return ExecutionResult(
                "confirmed",
                current,
                renderer.confirmado(current),
                parte_listo=True,
                applied_operations=applied,
            )

        if op_type == "cancelar":
            return ExecutionResult(
                "cancelled",
                ParteDiarioDraft(oportunidad_id=current.oportunidad_id, idproyecto=current.idproyecto),
                renderer.cancelado(),
                keep_active=False,
                cancelado=True,
                applied_operations=applied,
            )

        if op_type == "offtopic":
            reply = operation.reply or plan.reply or renderer.falta_informacion()
            return ExecutionResult("offtopic", current, reply, applied_operations=applied)

    if not applied:
        return ExecutionResult(
            "clarification",
            current,
            plan.reply or "No pude interpretar una novedad o accion para el parte. Decime la novedad o confirma si terminaste la carga.",
            applied_operations=applied,
        )

    return ExecutionResult(
        status,
        current,
        renderer.actualizado(current, errors),
        errors=errors,
        applied_operations=applied,
    )


def _filter_nomina_items(items: list[NominaItem], text: str | None) -> list[NominaItem]:
    searched = set(normalize_text(text).split()) - {
        "otro",
        "otros",
        "otra",
        "otras",
        "el",
        "la",
        "los",
        "las",
        "de",
        "del",
    }
    if not searched:
        return items
    filtered = [
        item for item in items
        if searched <= set(
            normalize_text(
                " ".join(
                    value
                    for value in (
                        item.apellido,
                        item.nombre,
                        item.nombre_completo,
                        item.nro_legajo,
                    )
                    if value
                )
            ).split()
        )
    ]
    return filtered or items


def _agregar_novedad(
    state: ParteDiarioDraft,
    operation: ParteDiarioOperation,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
    estados: list[EstadoItem],
) -> str | None:
    nombre = str(operation.nombre or "").strip()
    resolved_by_id = _resolve_nomina_by_id(operation.idnomina, nominas_proyecto, nominas_completas)
    if resolved_by_id is not None and not nombre:
        nombre = resolved_by_id.nombre_completo
    if not nombre:
        return "No pude identificar a que persona corresponde una novedad."
    if not _has_concrete_attendance_update(operation):
        return f"No pude identificar la novedad para {nombre}. Indica si falto, trabajo horas o el motivo."
    if (
        operation.fuera_de_proyecto
        and not operation.validar_destino_trabajo
        and not str(operation.nombre_proyecto or "").strip()
    ):
        return f"Indica a que obra fue a trabajar {nombre}."
    estado = resolve_estado_codigo(operation.estado_codigo, estados)
    if estado is None and operation.fuera_de_proyecto:
        estado = resolve_estado_codigo("P", estados)
    if estado is None and (
        operation.horas_extra is not None
        or (operation.horas is not None and operation.horas >= get_jornada_esperada(state.fecha))
    ):
        estado = resolve_estado_codigo("P", estados)
    if operation.horas_extra is not None and estado and estado.abreviatura.upper() != "P":
        return f"Para {nombre}, las horas extra solo pueden registrarse como PRESENTE."
    if operation.idnomina is not None:
        if resolved_by_id is None:
            return f"No encontre a {nombre} en la nomina activa."
        resolved = None
    else:
        resolved = NominaResolver.resolve(nombre, nominas_proyecto, nominas_completas)
    item = resolved_by_id if resolved is None else None
    if resolved is not None and resolved.error:
        state.pendientes_ambiguos.append(
            PendienteAmbiguo(
                nombre=nombre,
                idestado=estado.id if estado else None,
                estado_codigo=estado.abreviatura if estado else None,
                horas=operation.horas,
                horas_extra=operation.horas_extra,
                descripcion=operation.descripcion,
                idproyecto_destino=operation.idproyecto_destino,
                contacto_id_destino=operation.contacto_id_destino,
                nombre_encargado_destino=operation.nombre_encargado_destino,
                validar_destino_trabajo=operation.validar_destino_trabajo,
                destino_pendiente=operation.destino_pendiente,
                opciones_proyecto_destino=operation.opciones_proyecto_destino,
                opciones_encargado_destino=operation.opciones_encargado_destino,
                nombre_no_encontrado=True,
                fuera_de_proyecto=operation.fuera_de_proyecto,
                nombre_proyecto=operation.nombre_proyecto,
            )
        )
        state.sin_novedades_informado = False
        return None
    if resolved is not None and resolved.ambiguo:
        project_candidates = resolved.candidatos or []
        candidates = project_candidates or resolved.candidatos_externos or []
        if (
            estado
            and estado.abreviatura.upper() == "P"
            and operation.horas is not None
            and operation.horas < get_jornada_esperada(state.fecha)
            and not operation.fuera_de_proyecto
            and project_candidates
            and all(not item.fuera_de_proyecto for item in project_candidates)
        ):
            estado = None
        state.pendientes_ambiguos.append(
            PendienteAmbiguo(
                nombre=nombre,
                idestado=estado.id if estado else None,
                estado_codigo=estado.abreviatura if estado else None,
                horas=operation.horas,
                horas_extra=operation.horas_extra,
                descripcion=operation.descripcion,
                candidatos=candidates,
                candidatos_externos=resolved.candidatos_externos,
                mostrando_candidatos_externos=bool(candidates) and all(item.fuera_de_proyecto for item in candidates),
                fuera_de_proyecto=operation.fuera_de_proyecto
                or (bool(candidates) and all(item.fuera_de_proyecto for item in candidates)),
                nombre_proyecto=operation.nombre_proyecto,
                idproyecto_destino=operation.idproyecto_destino,
                contacto_id_destino=operation.contacto_id_destino,
                nombre_encargado_destino=operation.nombre_encargado_destino,
                validar_destino_trabajo=operation.validar_destino_trabajo,
                destino_pendiente=operation.destino_pendiente,
                opciones_proyecto_destino=operation.opciones_proyecto_destino,
                opciones_encargado_destino=operation.opciones_encargado_destino,
            )
        )
        state.sin_novedades_informado = False
        return None

    item = item or (resolved.match if resolved is not None else None)
    if item is None:
        return f"No encontre a {nombre} en la nomina activa."
    if estado is None and not item.fuera_de_proyecto:
        state.pendientes_ambiguos.append(
            PendienteAmbiguo(
                nombre=nombre,
                horas=operation.horas,
                horas_extra=operation.horas_extra,
                descripcion=operation.descripcion,
                candidatos=[item],
                idnomina_resuelto=item.idnomina,
                fuera_de_proyecto=operation.fuera_de_proyecto,
                nombre_proyecto=operation.nombre_proyecto,
                idproyecto_destino=operation.idproyecto_destino,
                contacto_id_destino=operation.contacto_id_destino,
                nombre_encargado_destino=operation.nombre_encargado_destino,
                validar_destino_trabajo=operation.validar_destino_trabajo,
                destino_pendiente=operation.destino_pendiente,
                opciones_proyecto_destino=operation.opciones_proyecto_destino,
                opciones_encargado_destino=operation.opciones_encargado_destino,
            )
        )
        state.sin_novedades_informado = False
        return None
    if operation.validar_destino_trabajo and (
        operation.destino_pendiente
        or operation.idproyecto_destino is None
        or operation.contacto_id_destino is None
    ):
        state.pendientes_ambiguos.append(
            PendienteAmbiguo(
                nombre=nombre,
                idestado=estado.id if estado else None,
                estado_codigo=estado.abreviatura if estado else None,
                horas=operation.horas,
                horas_extra=operation.horas_extra,
                descripcion=operation.descripcion,
                candidatos=[item],
                idnomina_resuelto=item.idnomina,
                fuera_de_proyecto=True,
                nombre_proyecto=operation.nombre_proyecto,
                idproyecto_destino=operation.idproyecto_destino,
                contacto_id_destino=operation.contacto_id_destino,
                nombre_encargado_destino=operation.nombre_encargado_destino,
                validar_destino_trabajo=True,
                destino_pendiente=operation.destino_pendiente
                or ("obra" if operation.idproyecto_destino is None else "encargado"),
                opciones_proyecto_destino=operation.opciones_proyecto_destino,
                opciones_encargado_destino=operation.opciones_encargado_destino,
            )
        )
        state.sin_novedades_informado = False
        return None
    novedad = _build_novedad(
        nombre,
        item,
        estado,
        operation.horas,
        operation.horas_extra,
        operation.descripcion,
        fecha=state.fecha,
        fuera_de_proyecto=operation.fuera_de_proyecto,
        nombre_proyecto=operation.nombre_proyecto,
        idproyecto_destino=operation.idproyecto_destino,
        contacto_id_destino=operation.contacto_id_destino,
        nombre_encargado_destino=operation.nombre_encargado_destino,
        validar_destino_trabajo=operation.validar_destino_trabajo,
    )
    _registrar_o_encolar_conflicto(state, novedad)
    state.sin_novedades_informado = False
    return None


# Resuelve IDs solo dentro de la nomina habilitada para la fecha del parte.
def _resolve_nomina_by_id(
    idnomina: int | None,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> NominaItem | None:
    try:
        target = int(idnomina or 0)
    except (TypeError, ValueError):
        return None
    if target <= 0:
        return None
    for item in nominas_proyecto:
        if item.idnomina == target:
            return item
    return None


def _build_novedad(
    nombre: str,
    nomina: NominaItem,
    estado: EstadoItem | None,
    horas: float | None,
    horas_extra: float | None,
    descripcion: str | None,
    *,
    fecha: date | str,
    fuera_de_proyecto: bool = False,
    nombre_proyecto: str | None = None,
    idproyecto_destino: int | None = None,
    contacto_id_destino: int | None = None,
    nombre_encargado_destino: str | None = None,
    validar_destino_trabajo: bool = False,
) -> NovedadPersonal:
    external = nomina.fuera_de_proyecto or fuera_de_proyecto
    project_name = nombre_proyecto if validar_destino_trabajo or fuera_de_proyecto else nomina.nombre_proyecto
    destination_id = idproyecto_destino if validar_destino_trabajo else None
    return NovedadPersonal(
        nombre=nomina.nombre_completo or nombre,
        idnomina=nomina.idnomina,
        idestado=estado.id if estado else None,
        estado_codigo=estado.abreviatura if estado else None,
        horas=normalizar_horas(
            fecha=fecha,
            horas=horas,
            horas_extra=horas_extra,
            estado_codigo=estado.abreviatura if estado else None,
            fuera_de_proyecto=external,
        ),
        descripcion=descripcion,
        fuera_de_proyecto=external,
        nombre_proyecto=project_name,
        idproyecto_destino=destination_id,
        contacto_id_destino=contacto_id_destino if validar_destino_trabajo else None,
        nombre_encargado_destino=nombre_encargado_destino if validar_destino_trabajo else None,
        validar_destino_trabajo=validar_destino_trabajo,
        nro_legajo=nomina.nro_legajo,
    )


# Conserva horas explicitas y calcula defaults y extras segun la fecha del parte.
def normalizar_horas(
    *,
    fecha: date | str,
    horas: float | None,
    horas_extra: float | None,
    estado_codigo: str | None,
    fuera_de_proyecto: bool,
) -> float:
    if horas_extra is not None:
        return float(get_jornada_esperada(fecha)) + horas_extra
    if horas is not None:
        return horas
    normalized_code = str(estado_codigo or "").upper()
    if normalized_code and normalized_code != "P":
        return 0.0
    if fuera_de_proyecto or normalized_code == "P":
        return float(get_jornada_esperada(fecha))
    return 0.0


def registrar_pendiente_resuelto(
    state: ParteDiarioDraft,
    pending: PendienteAmbiguo,
    estados: list[EstadoItem],
) -> None:
    candidate = next(
        (item for item in pending.candidatos or [] if item.idnomina == pending.idnomina_resuelto),
        None,
    )
    if candidate is None:
        candidate = next(
            (item for item in pending.candidatos_externos or [] if item.idnomina == pending.idnomina_resuelto),
            None,
        )
    if candidate is None:
        candidate = NominaItem(
            idnomina=int(pending.idnomina_resuelto or 0),
            nombre=pending.nombre,
            apellido="",
            fuera_de_proyecto=pending.fuera_de_proyecto,
            nombre_proyecto=pending.nombre_proyecto,
        )
    estado = next((item for item in estados if item.id == pending.idestado), None)
    novedad = _build_novedad(
        pending.nombre,
        candidate,
        estado,
        pending.horas,
        pending.horas_extra,
        pending.descripcion,
        fecha=state.fecha,
        fuera_de_proyecto=pending.fuera_de_proyecto,
        nombre_proyecto=pending.nombre_proyecto,
        idproyecto_destino=pending.idproyecto_destino,
        contacto_id_destino=pending.contacto_id_destino,
        nombre_encargado_destino=pending.nombre_encargado_destino,
        validar_destino_trabajo=pending.validar_destino_trabajo,
    )
    _registrar_o_encolar_conflicto(state, novedad)


def registrar_pendiente_sin_validar(state: ParteDiarioDraft, pending: PendienteAmbiguo) -> None:
    state.novedades.append(
        NovedadPersonal(
            nombre=pending.nombre,
            idnomina=None,
            idestado=pending.idestado,
            estado_codigo=pending.estado_codigo,
            horas=normalizar_horas(
                fecha=state.fecha,
                horas=pending.horas,
                horas_extra=pending.horas_extra,
                estado_codigo=pending.estado_codigo,
                fuera_de_proyecto=pending.fuera_de_proyecto,
            ),
            descripcion=pending.descripcion,
            fuera_de_proyecto=pending.fuera_de_proyecto,
            nombre_proyecto=pending.nombre_proyecto,
            idproyecto_destino=pending.idproyecto_destino,
            contacto_id_destino=pending.contacto_id_destino,
            nombre_encargado_destino=pending.nombre_encargado_destino,
            validar_destino_trabajo=pending.validar_destino_trabajo,
        )
    )


def _registrar_o_encolar_conflicto(state: ParteDiarioDraft, novedad: NovedadPersonal) -> None:
    if novedad.idnomina is None:
        return
    existing_conflict = next(
        (item for item in state.conflictos_novedad if item.idnomina == novedad.idnomina),
        None,
    )
    if existing_conflict is not None:
        if any(_misma_novedad(item, novedad) for item in existing_conflict.opciones):
            return
        existing_conflict.opciones.append(novedad)
        return
    existing = next((item for item in state.novedades if item.idnomina == novedad.idnomina), None)
    if existing is None:
        state.novedades.append(novedad)
        return
    if _misma_novedad(existing, novedad):
        return
    state.conflictos_novedad.append(
        ConflictoNovedad(idnomina=novedad.idnomina, nombre=novedad.nombre, opciones=[existing, novedad])
    )


def _misma_novedad(left: NovedadPersonal, right: NovedadPersonal) -> bool:
    return (
        left.idnomina,
        left.idestado,
        left.estado_codigo,
        left.horas,
        left.ingreso,
        left.egreso,
        left.fuera_de_proyecto,
    ) == (
        right.idnomina,
        right.idestado,
        right.estado_codigo,
        right.horas,
        right.ingreso,
        right.egreso,
        right.fuera_de_proyecto,
    )


def limpiar_conflictos_repetidos(state: ParteDiarioDraft) -> None:
    normalized = []
    for conflict in state.conflictos_novedad:
        unique_options = []
        for option in conflict.opciones:
            if not any(_misma_novedad(existing, option) for existing in unique_options):
                unique_options.append(option)
        if len(unique_options) > 1:
            conflict.opciones = unique_options
            normalized.append(conflict)
    state.conflictos_novedad = normalized


def _find_novedad(state: ParteDiarioDraft, nombre: str | None) -> NovedadPersonal | None:
    searched = set(normalize_text(nombre).split())
    matches = [
        item for item in state.novedades
        if searched and searched <= set(normalize_text(item.nombre).split())
    ]
    return matches[0] if len(matches) == 1 else None


def _find_pending(state: ParteDiarioDraft, nombre: str | None) -> PendienteAmbiguo | None:
    searched = set(normalize_text(nombre).split())
    matches = [
        item for item in state.pendientes_ambiguos
        if searched and searched <= set(normalize_text(item.nombre).split())
    ]
    return matches[0] if len(matches) == 1 else None


def _find_conflict(state: ParteDiarioDraft, nombre: str | None) -> ConflictoNovedad | None:
    searched = set(normalize_text(nombre).split())
    matches = [
        item for item in state.conflictos_novedad
        if searched and searched <= set(normalize_text(item.nombre).split())
    ]
    return matches[0] if len(matches) == 1 else None


def _modificar_novedad(
    state: ParteDiarioDraft,
    operation: ParteDiarioOperation,
    estados: list[EstadoItem],
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> str | None:
    novedad = _find_novedad(state, operation.nombre)
    if novedad is None:
        pending = _find_pending(state, operation.nombre)
        if pending is not None:
            error = _modificar_pendiente(pending, operation, estados)
            if error is None:
                state.sin_novedades_informado = False
            return error
        if _has_concrete_attendance_update(operation):
            return _agregar_novedad(state, operation, nominas_proyecto, nominas_completas, estados)
        return f"No encontre una unica novedad para {operation.nombre or 'esa persona'}."
    if novedad.idnomina not in {item.idnomina for item in nominas_proyecto}:
        return f"{novedad.nombre} no pertenece a la nomina vigente de esta obra y encargado."
    estado = resolve_estado_codigo(operation.estado_codigo, estados) if operation.estado_codigo else None
    if estado is None and operation.fuera_de_proyecto:
        estado = resolve_estado_codigo("P", estados)
    proposed_code = estado.abreviatura if estado else novedad.estado_codigo
    proposed_external = novedad.fuera_de_proyecto or operation.fuera_de_proyecto
    proposed_hours = (
        normalizar_horas(
            fecha=state.fecha,
            horas=operation.horas,
            horas_extra=operation.horas_extra,
            estado_codigo=proposed_code,
            fuera_de_proyecto=proposed_external,
        )
        if operation.horas is not None or operation.horas_extra is not None or estado is not None
        else novedad.horas
    )
    if operation.horas_extra is not None and str(proposed_code or "").upper() != "P":
        return f"Para {novedad.nombre}, las horas extra solo pueden registrarse como PRESENTE."
    if estado:
        novedad.idestado = estado.id
        novedad.estado_codigo = estado.abreviatura
    if operation.horas is not None or operation.horas_extra is not None or estado is not None:
        novedad.horas = proposed_hours
    if operation.descripcion:
        novedad.descripcion = operation.descripcion
    if operation.fuera_de_proyecto:
        novedad.fuera_de_proyecto = True
        novedad.nombre_proyecto = operation.nombre_proyecto
        novedad.idproyecto_destino = operation.idproyecto_destino
    state.sin_novedades_informado = False
    return None


def _modificar_pendiente(
    pending: PendienteAmbiguo,
    operation: ParteDiarioOperation,
    estados: list[EstadoItem],
) -> str | None:
    estado = resolve_estado_codigo(operation.estado_codigo, estados) if operation.estado_codigo else None
    if estado is None and operation.fuera_de_proyecto:
        estado = resolve_estado_codigo("P", estados)
    proposed_code = estado.abreviatura if estado else pending.estado_codigo
    if operation.horas_extra is not None and str(proposed_code or "").upper() != "P":
        return f"Para {pending.nombre}, las horas extra solo pueden registrarse como PRESENTE."
    if estado:
        pending.idestado = estado.id
        pending.estado_codigo = estado.abreviatura
    if operation.horas is not None:
        pending.horas = operation.horas
    if operation.horas_extra is not None:
        pending.horas_extra = operation.horas_extra
    if operation.descripcion:
        pending.descripcion = operation.descripcion
    if operation.fuera_de_proyecto:
        pending.fuera_de_proyecto = True
        pending.nombre_proyecto = operation.nombre_proyecto
        pending.idproyecto_destino = operation.idproyecto_destino
    return None


def _has_concrete_attendance_update(operation: ParteDiarioOperation) -> bool:
    return bool(
        str(operation.estado_codigo or "").strip()
        or operation.horas is not None
        or operation.horas_extra is not None
        or operation.fuera_de_proyecto
        or bool(str(operation.nombre_proyecto or "").strip())
    )


def _eliminar_novedad(state: ParteDiarioDraft, operation: ParteDiarioOperation) -> str | None:
    novedad = _find_novedad(state, operation.nombre)
    if novedad is None:
        pending = _find_pending(state, operation.nombre)
        if pending is not None:
            state.pendientes_ambiguos.remove(pending)
            return None
        conflict = _find_conflict(state, operation.nombre)
        if conflict is not None:
            state.conflictos_novedad.remove(conflict)
            return None
        return f"No encontre una unica novedad para {operation.nombre or 'esa persona'}."
    state.novedades.remove(novedad)
    state.conflictos_novedad = [
        item for item in state.conflictos_novedad
        if item.idnomina != novedad.idnomina
    ]
    return None


# region Integridad de las novedades

# Resuelve el codigo de un motivo dentro del catalogo disponible.
def resolve_estado_codigo(codigo: str | None, estados: list[EstadoItem]) -> EstadoItem | None:
    normalized = normalize_text(codigo).upper()
    for estado in estados:
        if estado.abreviatura.upper() == normalized:
            return estado
    return None


# Resuelve un motivo por opcion, alias o nombre antes de consultar al LLM.
def parse_estado_local(text: str, estados: list[EstadoItem]) -> EstadoItem | None:
    normalized = normalize_text(text)
    if normalized.isdigit():
        index = int(normalized) - 1
        available = [estado for estado in estados if estado.abreviatura.upper() != "P"]
        return available[index] if 0 <= index < len(available) else None
    aliases = {
        "falto": "FAL",
        "falta": "FAL",
        "enfermo": "ENF",
        "enfermedad": "ENF",
        "accidente": "ACC",
        "accidento": "ACC",
        "accidentado": "ACC",
        "accidentada": "ACC",
        "vacaciones": "VAC",
        "permiso": "PER",
        "lluvia": "LLV",
        "feriado": "FER",
        "presente": "P",
        "trabajo": "P",
        "vino": "P",
    }
    alias = aliases.get(normalized)
    if alias is None:
        for token in normalized.split():
            alias = aliases.get(token)
            if alias is not None:
                break
    for estado in estados:
        if alias == estado.abreviatura.upper():
            return estado
        if normalized in {normalize_text(estado.abreviatura), normalize_text(estado.nombre)}:
            return estado
    return None


# Rechaza operaciones reservadas, comandos incompatibles y horas fuera de los limites.
def _validate_plan(plan: TurnPlan, fecha: date | str) -> str | None:
    operation_types = {item.type for item in plan.operations}
    if operation_types & _RESERVED_OPERATIONS:
        return "No pude validar la accion solicitada. Proba nuevamente."
    if operation_types & _MUTATING_OPERATIONS and operation_types & {
        "solicitar_confirmacion",
        "solicitar_cancelacion",
        "retomar_carga",
    }:
        return "No pude validar acciones mezcladas en el mismo mensaje. Envialas por separado."
    for operation in plan.operations:
        for value in (operation.horas, operation.horas_extra):
            if value is not None and not 0 <= value <= 24:
                return "Las horas informadas deben estar entre 0 y 24."
        if operation.horas_extra is not None and operation.horas_extra + float(get_jornada_esperada(fecha)) > 24:
            return "La jornada total no puede superar 24 horas."
    return None


# Detecta si hay un parte retomado o novedades que deban conservar la conversacion.
def _has_conversational_draft(state: ParteDiarioDraft) -> bool:
    return bool(
        state.parte_id
        or state.novedades
        or state.pendientes_ambiguos
        or state.conflictos_novedad
        or state.sin_novedades_informado
    )


# Comprueba motivo de jornada parcial, horas extra y destino antes de registrar un pendiente.
def _validate_pending_business_rules(pending: PendienteAmbiguo, fecha: date | str) -> str | None:
    code = str(pending.estado_codigo or "").upper()
    if pending.horas_extra is not None and code != "P":
        return f"Para {pending.nombre}, las horas extra solo pueden registrarse como PRESENTE."
    if (
        not pending.fuera_de_proyecto
        and code == "P"
        and pending.horas is not None
        and pending.horas < get_jornada_esperada(fecha)
    ):
        return f"Para {pending.nombre}, una jornada menor a {get_jornada_esperada(fecha):g} horas requiere indicar el motivo."
    if pending.validar_destino_trabajo and (
        pending.idproyecto_destino is None or pending.contacto_id_destino is None
    ):
        return f"Para {pending.nombre}, falta validar obra y encargado destino."
    return None

# endregion
