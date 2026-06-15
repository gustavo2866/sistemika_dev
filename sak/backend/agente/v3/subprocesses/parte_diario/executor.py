"""Executor puro del proceso parte_diario."""

from __future__ import annotations

from agente.v3.subprocesses.parte_diario import renderer
from agente.v3.subprocesses.parte_diario.models import (
    ConflictoNovedad,
    EstadoItem,
    ExecutionResult,
    NominaItem,
    NovedadPersonal,
    ParteDiarioOperation,
    ParteDiarioState,
    PendienteAmbiguo,
    TurnPlan,
)
from agente.v3.subprocesses.parte_diario.resolver import NominaResolver, normalize_text, resolve_estado_codigo


KNOWN_OPERATIONS = {
    "agregar_novedad",
    "modificar_novedad",
    "eliminar_novedad",
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
    state: ParteDiarioState,
    plan: TurnPlan,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
    estados: list[EstadoItem],
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

        if op_type == "agregar_novedad":
            error = _agregar_novedad(current, operation, nominas_proyecto, nominas_completas, estados)
            if error:
                errors.append(error)
            else:
                status = "updated"
            continue

        if op_type == "modificar_novedad":
            error = _modificar_novedad(current, operation, estados)
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

        if op_type == "mostrar_parte":
            return ExecutionResult("shown", current, renderer.solicitar_confirmacion(current), applied_operations=applied)

        if op_type == "mostrar_nomina":
            return ExecutionResult("shown_nomina", current, renderer.mostrar_nomina(nominas_proyecto), applied_operations=applied)

        if op_type == "sin_novedades":
            if current.novedades or current.pendientes_ambiguos or current.conflictos_novedad:
                return ExecutionResult(
                    "sin_novedades_rejected",
                    current,
                    renderer.sin_novedades_rechazado(),
                    applied_operations=applied,
                )
            current.sin_novedades_informado = True
            return ExecutionResult(
                "sin_novedades",
                current,
                renderer.sin_novedades_registrado(),
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
                ParteDiarioState(oportunidad_id=current.oportunidad_id, idproyecto=current.idproyecto),
                renderer.cancelado(),
                keep_active=False,
                cancelado=True,
                applied_operations=applied,
            )

        if op_type == "offtopic":
            reply = operation.reply or plan.reply or renderer.falta_informacion()
            return ExecutionResult("offtopic", current, reply, applied_operations=applied)

    return ExecutionResult(
        status,
        current,
        renderer.actualizado(current, errors),
        errors=errors,
        applied_operations=applied,
    )


def _agregar_novedad(
    state: ParteDiarioState,
    operation: ParteDiarioOperation,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
    estados: list[EstadoItem],
) -> str | None:
    nombre = str(operation.nombre or "").strip()
    if not nombre:
        return "No pude identificar a que persona corresponde una novedad."
    estado = resolve_estado_codigo(operation.estado_codigo, estados)
    if estado is None and (
        operation.horas_extra is not None
        or (operation.horas is not None and operation.horas >= 9)
    ):
        estado = resolve_estado_codigo("P", estados)
    if operation.horas_extra is not None and estado and estado.abreviatura.upper() != "P":
        return f"Para {nombre}, las horas extra solo pueden registrarse como PRESENTE."
    resolved = NominaResolver.resolve(nombre, nominas_proyecto, nominas_completas)
    if resolved.error:
        state.pendientes_ambiguos.append(
            PendienteAmbiguo(
                nombre=nombre,
                idestado=estado.id if estado else None,
                estado_codigo=estado.abreviatura if estado else None,
                horas=operation.horas,
                horas_extra=operation.horas_extra,
                descripcion=operation.descripcion,
                nombre_no_encontrado=True,
            )
        )
        state.sin_novedades_informado = False
        return None
    if resolved.ambiguo:
        candidates = resolved.candidatos or []
        if (
            estado
            and estado.abreviatura.upper() == "P"
            and operation.horas is not None
            and operation.horas < 9
            and candidates
            and all(not item.fuera_de_proyecto for item in candidates)
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
                fuera_de_proyecto=bool(candidates) and all(item.fuera_de_proyecto for item in candidates),
            )
        )
        state.sin_novedades_informado = False
        return None

    item = resolved.match
    if item is None:
        return f"No encontre a {nombre} en la nomina activa."
    if estado is None and not item.fuera_de_proyecto:
        state.pendientes_ambiguos.append(
            PendienteAmbiguo(
                nombre=nombre,
                horas=operation.horas,
                horas_extra=operation.horas_extra,
                descripcion=operation.descripcion,
                idnomina_resuelto=item.idnomina,
            )
        )
        state.sin_novedades_informado = False
        return None
    normalized_hours = normalizar_horas(
        horas=operation.horas,
        horas_extra=operation.horas_extra,
        estado_codigo=estado.abreviatura if estado else None,
        fuera_de_proyecto=item.fuera_de_proyecto,
    )
    novedad = _build_novedad(nombre, item, estado, operation.horas, operation.horas_extra, operation.descripcion)
    _registrar_o_encolar_conflicto(state, novedad)
    state.sin_novedades_informado = False
    return None


def _build_novedad(
    nombre: str,
    nomina: NominaItem,
    estado: EstadoItem | None,
    horas: float | None,
    horas_extra: float | None,
    descripcion: str | None,
) -> NovedadPersonal:
    return NovedadPersonal(
        nombre=nomina.nombre_completo or nombre,
        idnomina=nomina.idnomina,
        idestado=estado.id if estado else None,
        estado_codigo=estado.abreviatura if estado else None,
        horas=normalizar_horas(
            horas=horas,
            horas_extra=horas_extra,
            estado_codigo=estado.abreviatura if estado else None,
            fuera_de_proyecto=nomina.fuera_de_proyecto,
        ),
        descripcion=descripcion,
        fuera_de_proyecto=nomina.fuera_de_proyecto,
        nombre_proyecto=nomina.nombre_proyecto,
    )


def normalizar_horas(
    *,
    horas: float | None,
    horas_extra: float | None,
    estado_codigo: str | None,
    fuera_de_proyecto: bool,
) -> float:
    if horas_extra is not None:
        return 9.0 + horas_extra
    if horas is not None:
        return horas
    normalized_code = str(estado_codigo or "").upper()
    if normalized_code and normalized_code != "P":
        return 0.0
    if fuera_de_proyecto or normalized_code == "P":
        return 9.0
    return 0.0


def registrar_pendiente_resuelto(
    state: ParteDiarioState,
    pending: PendienteAmbiguo,
    estados: list[EstadoItem],
) -> None:
    candidate = next(
        (item for item in pending.candidatos or [] if item.idnomina == pending.idnomina_resuelto),
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
    )
    _registrar_o_encolar_conflicto(state, novedad)


def _registrar_o_encolar_conflicto(state: ParteDiarioState, novedad: NovedadPersonal) -> None:
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


def limpiar_conflictos_repetidos(state: ParteDiarioState) -> None:
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
    if not normalized and state.esperando == "resolucion_conflictos":
        state.esperando = None


def _find_novedad(state: ParteDiarioState, nombre: str | None) -> NovedadPersonal | None:
    searched = set(normalize_text(nombre).split())
    matches = [
        item for item in state.novedades
        if searched and searched <= set(normalize_text(item.nombre).split())
    ]
    return matches[0] if len(matches) == 1 else None


def _modificar_novedad(
    state: ParteDiarioState,
    operation: ParteDiarioOperation,
    estados: list[EstadoItem],
) -> str | None:
    novedad = _find_novedad(state, operation.nombre)
    if novedad is None:
        return f"No encontre una unica novedad para {operation.nombre or 'esa persona'}."
    estado = resolve_estado_codigo(operation.estado_codigo, estados) if operation.estado_codigo else None
    proposed_code = estado.abreviatura if estado else novedad.estado_codigo
    proposed_hours = (
        normalizar_horas(
            horas=operation.horas,
            horas_extra=operation.horas_extra,
            estado_codigo=proposed_code,
            fuera_de_proyecto=novedad.fuera_de_proyecto,
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
    state.sin_novedades_informado = False
    return None


def _eliminar_novedad(state: ParteDiarioState, operation: ParteDiarioOperation) -> str | None:
    novedad = _find_novedad(state, operation.nombre)
    if novedad is None:
        return f"No encontre una unica novedad para {operation.nombre or 'esa persona'}."
    state.novedades.remove(novedad)
    state.conflictos_novedad = [
        item for item in state.conflictos_novedad
        if item.idnomina != novedad.idnomina
    ]
    return None
