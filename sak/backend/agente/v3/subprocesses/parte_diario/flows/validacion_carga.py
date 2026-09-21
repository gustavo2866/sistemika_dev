"""Aclaraciones inmediatas en los estados carga_validar_* y carga_cambiar_fecha.

preparar elige la siguiente pregunta de la cola: fecha, conflicto o novedad.
En cada novedad se resuelve empleado, obra, encargado y motivo, en ese orden.
Al terminar se vuelve a carga o se avanza la pagina de LISTADO, sin persistir el parte.
"""

from __future__ import annotations

import logging
import re
from sqlmodel import Session
from app import db

from agente.v3.subprocesses.parte_diario.domain import empleados, encargados, novedades, obras
from agente.v3.subprocesses.parte_diario.flows import carga, fecha
from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, ParteDiarioDraft
from agente.v3.subprocesses.parte_diario.models import TurnResult
from agente.v3.subprocesses.parte_diario.domain.empleados import NominaResolver
from agente.v3.subprocesses.parte_diario.domain.novedades import parse_estado_local, resolve_estado_codigo
from agente.v3.subprocesses.parte_diario.utils import calendario, interpretacion
from agente.v3.subprocesses.parte_diario.utils.texto import _normalize_command, _append_description
from typing import TYPE_CHECKING

from agente.v3.subprocesses.parte_diario.adapters.carga_agent import fallback_person_validation
from agente.v3.subprocesses.parte_diario.domain import parte_diario
from agente.v3.subprocesses.parte_diario.domain.empleados import filter_candidate_selection, parse_candidate_selection
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.flows import confirmar_salida, listado
from agente.v3.subprocesses.parte_diario.domain.models import NominaItem, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer

if TYPE_CHECKING:
    from agente.v3.subprocesses.parte_diario.adapters.carga_agent import ParteDiarioCargaAgentClient
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient

logger = logging.getLogger(__name__)
ETAPAS = {
    "carga_validar_empleado", "carga_validar_obra",
    "carga_validar_encargado", "carga_validar_estado", "carga_validar_conflicto",
    "carga_cambiar_fecha",
}


# Detecta aclaraciones de carga, sin revisar nuevamente las novedades ya resueltas.
def tiene_pendientes(state: ParteDiarioV3State) -> bool:
    draft = state.draft()
    return bool(draft.pendientes_ambiguos or draft.conflictos_novedad or draft.fecha_propuesta)


# Asigna al primer pendiente una etapa especifica y muestra la pregunta correspondiente.
def preparar(state: ParteDiarioV3State) -> str:
    draft = state.draft()
    state.validacion_origen = state.validacion_origen or (
        "listado" if state.etapa == "listado" else "carga"
    )
    if draft.fecha_propuesta:
        state.etapa = "carga_cambiar_fecha"
        return renderer.preguntar_cambio_fecha(draft.fecha, draft.fecha_propuesta)
    if draft.conflictos_novedad:
        state.etapa = "carga_validar_conflicto"
        reply = renderer.preguntar_conflicto(draft.conflictos_novedad[0])
    elif draft.pendientes_ambiguos:
        # Solo una novedad pendiente necesita consultar nomina y catalogo de estados.
        estados = preparar_candidatos(state)
        draft = state.draft()
        pending = draft.pendientes_ambiguos[0]
        if pending.nombre_pendiente:
            kind = "empleado"
        elif pending.obra_destino_pendiente:
            kind = "obra"
        elif pending.encargado_destino_pendiente:
            kind = "encargado"
        else:
            kind = "estado"
        state.etapa = f"carga_validar_{kind}"
        reply = menu_personas(pending) if kind == "empleado" else renderer.preguntar_pendiente(pending, estados)
    else:
        return terminar(state)
    state.set_draft(draft)
    return reply


# Recupera el modo de entrada cuando ya no quedan aclaraciones de la carga.
def terminar(state: ParteDiarioV3State) -> str:
    state.etapa = "listado" if state.validacion_origen == "listado" else "carga"
    state.validacion_origen = None
    return "Validacion de carga completada."



# Presenta solo candidatos habilitados; no admite altas sin validar.
def menu_personas(pending: PendienteAmbiguo) -> str:
    people = empleados.candidatos_activos(pending)
    if not people:
        return (f"No encontre a {pending.nombre} en la nomina activa.\n"
                "Indica un empleado de la nomina de esta obra y encargado, o NO para descartar la novedad.")
    lines = [f"A cual {pending.nombre} te referis?"]
    for index, person in enumerate(people, start=1):
        details = [value for value in (
            person.nombre_proyecto if person.fuera_de_proyecto else None, person.encargado_nombre,
        ) if value]
        suffix = f" ({', '.join(details)})" if details else ""
        lines.append(f"{index}. {person.nombre_completo}{suffix}")
    lines.append("Responde con numero, nombre o NO para descartar la novedad.")
    return "\n".join(lines)


# Atiende aclaraciones y consultas durante la validacion y retorna al modo de origen.
async def procesar(
    text: str | None, state: ParteDiarioV3State,
    llm_client: ParteDiarioLLMClient, carga_agent: ParteDiarioCargaAgentClient,
) -> str:
    if text is None:
        return preparar(state)
    command = normalize_text(text)
    if command == "salir":
        return confirmar_salida.iniciar(state)
    llm = llm_client.for_stage("carga") if hasattr(llm_client, "for_stage") else llm_client
    reply = await resolver_respuesta(text, state, llm, carga_agent)
    if state.etapa in ETAPAS:
        return reply
    if state.etapa == "listado":
        return listado.avanzar(state, reply if reply.startswith("No cargo ") else "")
    return renderer.seguimiento_carga(state, reply)


# Resuelve la aclaracion solicitada y prepara el siguiente pendiente de la cola.
async def resolver_respuesta(
    text: str, state: ParteDiarioV3State,
    llm_client: ParteDiarioLLMClient, carga_agent: ParteDiarioCargaAgentClient,
) -> str:
    command = normalize_text(text)
    if command in {"opciones", "ver opciones", "elegir opcion"}:
        return preparar(state)
    if state.etapa == "carga_cambiar_fecha" and command not in {"1", "2", "cambiar fecha", "mantener fecha"}:
        return preparar(state)
    if state.etapa == "carga_validar_empleado":
        text, reply = await resolver_persona(text, state, carga_agent)
        if reply is not None:
            return reply
    result = (
        await carga.procesar_mensaje(state, text, llm_client)
        if state.etapa not in ETAPAS
        else await resolver_pendiente(state, text, llm_client)
    )
    reply = str(result.payload.get("reply_to_user") or "")
    if tiene_pendientes(state):
        question = preparar(state)
        # El dominio incluye la explicacion y las opciones cuando rechaza un motivo.
        return reply if state.etapa == "carga_validar_estado" and reply else question
    terminar(state)
    return reply


# Devuelve (texto para el dominio, None) o (None, respuesta), usando el adaptador si hace falta.
async def resolver_persona(
    text: str, state: ParteDiarioV3State, carga_agent: ParteDiarioCargaAgentClient,
) -> tuple[str | None, str | None]:
    draft = state.draft()
    pending = draft.pendientes_ambiguos[0]
    command = normalize_text(text)
    people = empleados.candidatos_activos(pending)
    if command in {"no", "ninguno", "ninguna"}:
        reply = descartar_pendiente(state)
        if tiene_pendientes(state):
            return None, f"{reply}\n\n{preparar(state)}"
        terminar(state)
        return None, reply
    if command in {"registrar sin validar", "sin validar", "otros"}:
        return None, menu_personas(pending)
    selected = parse_candidate_selection(text, people)
    if selected is not None:
        return str(next(index for index, person in enumerate(people, 1) if person.idnomina == selected.idnomina)), None
    if command.isdigit():
        return None, menu_personas(pending)
    filtered = filter_candidate_selection(text, people)
    if 1 < len(filtered) < len(people):
        if pending.mostrando_candidatos_externos:
            pending.candidatos_externos = filtered
        else:
            pending.candidatos = filtered
        state.set_draft(draft)
        return None, menu_personas(pending)
    try:
        decision = await carga_agent.resolve_person_validation(message_text=text, pending=pending)
    except Exception:
        logger.exception("No se pudo interpretar la aclaracion de empleado")
        decision = fallback_person_validation(text, pending)
    if decision.action == "seleccionar_persona":
        index = next((index for index, person in enumerate(people, 1) if person.idnomina == decision.candidate_id), None)
        return (str(index), None) if index else (None, menu_personas(pending))
    if decision.action == "procesar_como_novedad":
        # La novedad nueva vuelve al interprete comun sin eliminar pendientes anteriores.
        state.etapa = "listado" if state.validacion_origen == "listado" else "carga"
        return decision.text or text, None
    if pending.nombre_no_encontrado:
        return text, None
    return None, menu_personas(pending)


# region Resolucion de la respuesta y avance de la cola

# Prepara candidatos del primer pendiente y devuelve los estados para su menu.
def preparar_candidatos(state: ParteDiarioV3State) -> list[EstadoItem]:
    draft = state.draft()
    with Session(db.engine) as session:
        estados = parte_diario.cargar_estados(session)
        if draft.pendientes_ambiguos:
            locales, completas = empleados.cargar_referencias(session,
                int(state.proyecto_id), contacto_id=state.contacto_id,
                fecha=calendario.parsear_fecha(draft.fecha),
            )
            empleados.preparar_candidatos(draft.pendientes_ambiguos[0], locales, completas)
    state.set_draft(draft)
    return estados


# Resuelve una respuesta segun la etapa de validacion y actualiza el borrador conversacional.
async def resolver_pendiente(state: ParteDiarioV3State, text: str, llm_client) -> TurnResult:
    draft = state.draft()
    with Session(db.engine) as session:
        estados = parte_diario.cargar_estados(session)
        locales, completas = empleados.cargar_referencias(session,
            int(state.proyecto_id), contacto_id=state.contacto_id,
            fecha=calendario.parsear_fecha(draft.fecha),
        )
        if state.etapa == "carga_cambiar_fecha":
            if _normalize_command(text) in {"1", "cambiar fecha"}:
                result = fecha.aplicar_cambio_confirmado(session, draft, estados)
            else:
                draft.fecha_propuesta = None
                result = renderer.respuesta_borrador(draft, renderer.fecha_original_conservada(draft.fecha))
        elif state.etapa == "carga_validar_conflicto":
            result = _resolver_conflicto(draft, text, estados, locales, completas)
        else:
            result = await _resolver_seleccion(session, state, text, llm_client, estados, locales, completas)
    state.parte_state = dict(result.process_state)
    return result


# Quita solo el pendiente rechazado y conserva las demas novedades del mensaje.
def descartar_pendiente(state: ParteDiarioV3State) -> str:
    draft = state.draft()
    pending = draft.pendientes_ambiguos.pop(0)
    state.set_draft(draft)
    return f"No cargo {pending.nombre}."


# Resuelve el primer pendiente en orden: empleado, obra, encargado y motivo.
async def _resolver_seleccion(
    session: Session,
    state: ParteDiarioV3State,
    text: str,
    llm_client,
    estados: list[EstadoItem],
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> TurnResult:
    draft = state.draft()
    if not draft.pendientes_ambiguos:
        return _terminar_pendientes(draft)
    pending = draft.pendientes_ambiguos[0]
    if pending.nombre_no_encontrado:
        resolved = NominaResolver.resolve(text, nominas_proyecto, nominas_completas)
        if resolved.error:
            empleados.preparar_candidatos(pending, nominas_proyecto, nominas_completas)
            if state.validacion_origen == "carga" and not pending.candidatos and interpretacion._looks_like_attendance_update(text):
                return await carga._interpretar_operaciones(session, state, text, llm_client)
            return renderer.respuesta_borrador(
                draft,
                renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
            )
        pending.nombre = text.strip() or pending.nombre
        pending.nombre_no_encontrado = False
        if resolved.ambiguo:
            pending.candidatos = resolved.candidatos
            pending.candidatos_externos = resolved.candidatos_externos
            pending.mostrando_candidatos_externos = bool(pending.candidatos) and all(
                item.fuera_de_proyecto for item in pending.candidatos
            )
            return renderer.respuesta_borrador(draft, renderer.preguntar_pendiente(pending, estados))
        selected = resolved.match
        if selected is None:
            pending.nombre_no_encontrado = True
            return renderer.respuesta_borrador(draft, renderer.preguntar_pendiente(pending, estados))
        pending.candidatos = [selected]
        pending.idnomina_resuelto = selected.idnomina
        pending.fuera_de_proyecto = pending.fuera_de_proyecto or selected.fuera_de_proyecto
        pending.nombre_proyecto = pending.nombre_proyecto or selected.nombre_proyecto
        if pending.validar_destino_trabajo and (
            pending.obra_destino_pendiente or pending.encargado_destino_pendiente
        ):
            return renderer.respuesta_borrador(draft, renderer.preguntar_pendiente(pending, estados))
        if pending.estado_pendiente:
            return renderer.respuesta_borrador(draft, renderer.preguntar_estado(pending, estados))

    if pending.nombre_pendiente:
        candidates = empleados.candidatos_activos(pending)
        selected = parse_candidate_selection(text, candidates)
        if selected is None:
            if state.validacion_origen == "carga":
                return await carga._interpretar_operaciones(session, state, text, llm_client)
            return renderer.respuesta_borrador(
                draft,
                renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
            )
        pending.idnomina_resuelto = selected.idnomina
        pending.fuera_de_proyecto = pending.fuera_de_proyecto or selected.fuera_de_proyecto
        pending.nombre_proyecto = pending.nombre_proyecto or selected.nombre_proyecto
        if pending.validar_destino_trabajo and (
            pending.obra_destino_pendiente or pending.encargado_destino_pendiente
        ):
            return renderer.respuesta_borrador(draft, renderer.preguntar_pendiente(pending, estados))
        if pending.estado_pendiente:
            return renderer.respuesta_borrador(draft, renderer.preguntar_estado(pending, estados))

    if pending.obra_destino_pendiente:
        selected_project = obras._match_destination_project(text, pending.opciones_proyecto_destino or [])
        if selected_project is None:
            return renderer.respuesta_borrador(
                draft,
                renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
            )
        pending.idproyecto_destino = selected_project.proyecto_id
        pending.nombre_proyecto = selected_project.nombre
        pending.destino_pendiente = None
        pending.opciones_proyecto_destino = None
        encargados.resolver_destino(session, pending, message_text=text)
        if pending.obra_destino_pendiente or pending.encargado_destino_pendiente:
            return renderer.respuesta_borrador(draft, renderer.preguntar_pendiente(pending, estados))
        if pending.estado_pendiente:
            return renderer.respuesta_borrador(draft, renderer.preguntar_estado(pending, estados))

    if pending.encargado_destino_pendiente:
        selected_manager = encargados.seleccionar(
            text,
            pending.opciones_encargado_destino or [],
            project_text=pending.nombre_proyecto,
        )
        if selected_manager is None:
            return renderer.respuesta_borrador(
                draft,
                renderer.validacion_requerida(renderer.preguntar_pendiente(pending, estados)),
            )
        pending.contacto_id_destino = selected_manager.contacto_id
        pending.nombre_encargado_destino = selected_manager.nombre
        pending.destino_pendiente = None
        pending.opciones_encargado_destino = None
        if pending.estado_pendiente:
            return renderer.respuesta_borrador(draft, renderer.preguntar_estado(pending, estados))

    elif pending.estado_pendiente:
        selected_state = parse_estado_local(text, estados)
        if selected_state is None and pending.intentos_estado < 2:
            session.commit()
            try:
                code = await llm_client.interpretar_estado_pendiente(text, estados)
            except Exception:
                logger.exception("No se pudo interpretar el estado pendiente de parte_diario")
                code = "NO_DETERMINADO"
            selected_state = resolve_estado_codigo(code, estados)
        if selected_state is None:
            pending.intentos_estado += 1
            return renderer.respuesta_borrador(
                draft,
                renderer.validacion_requerida(
                    renderer.preguntar_estado(pending, estados, exigir_numero=pending.intentos_estado >= 2)
                ),
            )
        pending.idestado = selected_state.id
        pending.estado_codigo = selected_state.abreviatura
        pending.descripcion = _append_description(pending.descripcion, text)

    if pending.idnomina_resuelto not in {item.idnomina for item in nominas_proyecto}:
        pending.idnomina_resuelto = None
        pending.nombre_no_encontrado = True
        pending.candidatos = None
        pending.candidatos_externos = None
        return renderer.respuesta_borrador(draft, "El empleado no pertenece a la nomina vigente de esta obra y encargado.")

    pending_error = novedades._validate_pending_business_rules(pending, draft.fecha)
    if pending_error:
        pending.idestado = None
        pending.estado_codigo = None
        return renderer.respuesta_borrador(draft, f"{pending_error}\n\n{renderer.preguntar_estado(pending, estados)}")

    draft.pendientes_ambiguos.pop(0)
    novedades.registrar_pendiente_resuelto(draft, pending, estados)
    if draft.conflictos_novedad:
        return renderer.respuesta_borrador(draft, renderer.preguntar_conflicto(draft.conflictos_novedad[0]))
    if draft.pendientes_ambiguos:
        empleados.preparar_candidatos(draft.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
        return renderer.respuesta_borrador(draft, renderer.preguntar_pendiente(draft.pendientes_ambiguos[0], estados))
    return _terminar_pendientes(draft)


# Conserva la novedad elegida para un empleado y retira su conflicto de la cola.
def _resolver_conflicto(
    state: ParteDiarioDraft,
    command: str,
    estados: list[EstadoItem],
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> TurnResult:
    if not state.conflictos_novedad:
        return _terminar_pendientes(state)
    conflict = state.conflictos_novedad[0]
    numbers = re.findall(r"\d+", command)
    if len(numbers) != 1:
        return renderer.respuesta_borrador(state, renderer.validacion_requerida(renderer.preguntar_conflicto(conflict)))
    index = int(numbers[0]) - 1
    if not 0 <= index < len(conflict.opciones):
        return renderer.respuesta_borrador(state, renderer.validacion_requerida(renderer.preguntar_conflicto(conflict)))
    selected = conflict.opciones[index]
    state.novedades = [item for item in state.novedades if item.idnomina != conflict.idnomina]
    state.novedades.append(selected)
    state.conflictos_novedad.pop(0)
    if state.conflictos_novedad:
        return renderer.respuesta_borrador(state, renderer.preguntar_conflicto(state.conflictos_novedad[0]))
    if state.pendientes_ambiguos:
        empleados.preparar_candidatos(state.pendientes_ambiguos[0], nominas_proyecto, nominas_completas)
        return renderer.respuesta_borrador(state, renderer.preguntar_pendiente(state.pendientes_ambiguos[0], estados))
    return _terminar_pendientes(state)


# Cierra la aclaracion inmediata y conserva el borrador para volver a carga o LISTADO.
def _terminar_pendientes(state: ParteDiarioDraft, *, prefix: str | None = None) -> TurnResult:
    reply = renderer.actualizado(state)
    if prefix:
        reply = f"{prefix}\n\n{reply}"
    return renderer.respuesta_borrador(state, reply)


# endregion
