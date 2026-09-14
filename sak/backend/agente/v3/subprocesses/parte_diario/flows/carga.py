"""Entrada de texto libre y procesamiento comun con LISTADO.

procesar atiende carga; interpretar_novedades recibe el texto de ambos modos.
Una novedad puede dejar carga/listado, una validacion especifica o revision.
None como texto solo muestra el inicio; nunca se interpreta como una novedad.
GUARDAR devuelve None para ejecutar revision en el mismo turno, sin preguntar.
"""

from __future__ import annotations

import logging
from sqlmodel import Session
from app import db

from agente.v3.subprocesses.parte_diario.domain import empleados, novedades, obras
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation, TurnPlan, TurnResult
from agente.v3.subprocesses.parte_diario.domain.models import ParteDiarioDraft
from agente.v3.subprocesses.parte_diario.utils import calendario, interpretacion
from agente.v3.subprocesses.parte_diario.utils.texto import _normalize_command
from typing import TYPE_CHECKING

from agente.v3.subprocesses.parte_diario.domain import parte_diario
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.flows import aclaracion, confirmar_salida, listado, revision, validacion_carga
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer

if TYPE_CHECKING:
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
    from agente.v3.subprocesses.parte_diario.adapters.query_agent import ParteDiarioQueryAgentClient

logger = logging.getLogger(__name__)
FIN_CARGA = {
    "no", "listo", "finalizar carga", "revisar", "ver resumen",
}


# Atiende comandos de texto libre y envia las novedades al procesamiento comun.
async def procesar(
    text: str | None, state: ParteDiarioV3State,
    llm_client: ParteDiarioLLMClient, query_agent: ParteDiarioQueryAgentClient,
) -> str | None:
    if text is None:
        return renderer.inicio_carga(state)
    command = normalize_text(text)
    if command == "listado":
        return listado.iniciar(state)
    if command in FIN_CARGA:
        draft = state.draft()
        if not (draft.novedades or draft.pendientes_ambiguos or draft.conflictos_novedad):
            draft.sin_novedades_informado = True
            state.set_draft(draft)
        return revision.iniciar(state)
    if command in {"salir", "cancelar"}:
        return confirmar_salida.iniciar(state)
    if command in {"guardar", "guardar borrador"}:
        state.etapa = "revision"
        state.accion_cierre = "guardar"
        return None
    if command in {"cerrar", "finalizar", "finalizar parte", "confirmar"}:
        return revision.iniciar(state)
    if command == "volver":
        return renderer.inicio_carga(state)
    if es_consulta_pendientes(text):
        try:
            reply = await consultar(state, text, query_agent)
            if reply:
                return renderer.seguimiento_carga(state, reply)
        except Exception:
            logger.exception("No se pudo responder la consulta durante la carga")
    return await interpretar_novedades(text, state, llm_client)


# Interpreta ambas entradas, aplica al draft y presenta el resultado o la aclaracion.
async def interpretar_novedades(text: str, state: ParteDiarioV3State, llm_client: ParteDiarioLLMClient) -> str:
    llm = llm_client.for_stage("carga") if hasattr(llm_client, "for_stage") else llm_client
    aclarando = state.etapa == "carga_aclaracion"
    origen = state.aclaracion_origen if aclarando else state.etapa
    en_listado = origen == "listado"
    result = await procesar_mensaje(state, text, llm)
    payload = result.payload
    status = (payload.get("parte_diario") or {}).get("status")
    reply = str(payload.get("reply_to_user") or "")
    if payload.get("cancelado"):
        return confirmar_salida.iniciar(state)
    if validacion_carga.tiene_pendientes(state):
        if aclarando:
            aclaracion.terminar(state)
        question = validacion_carga.preparar(state)
        errors = "\n".join(payload.get("errores") or [])
        return f"{errors}\n\n{question}" if errors else question
    if status == "waiting" or payload.get("errores"):
        detalle = "\n".join(payload.get("errores") or []) or reply
        return aclaracion.iniciar(state, f"{detalle}\n\nQue novedad o cambio queres registrar?")
    if status == "clarification":
        return aclaracion.iniciar(state, reply)
    if aclarando and status in {"shown", "shown_nomina", "offtopic", "other_process_blocked"}:
        return f"{reply}\n\n{state.aclaracion_pregunta}"
    if aclarando and status in {"updated", "resumed", "sin_novedades", "confirmation_required", "confirmed"}:
        aclaracion.terminar(state)
    if status in {"sin_novedades", "confirmation_required", "confirmed"}:
        return revision.iniciar(state)
    if status == "cancel_confirmation_required":
        return confirmar_salida.iniciar(state)
    if en_listado:
        if status == "updated" and not payload.get("errores"):
            return listado.avanzar(state, "Cargado.")
        return listado.mostrar(state, renderer.seguimiento_carga(state, reply))
    return renderer.seguimiento_carga(state, reply)


# Reconoce consultas sobre partes pendientes antes de interpretar una novedad.
def es_consulta_pendientes(text: str) -> bool:
    tokens = set(normalize_text(text).split())
    if not tokens & {"parte", "partes", "pendiente", "pendientes", "borrador", "borradores"}:
        return False
    return tokens <= {"parte", "partes", "pendiente", "pendientes", "borrador", "borradores"} or bool(
        tokens & {"ver", "mostrame", "mostrar", "consulta", "consultar", "listame", "listar", "cuales", "que"}
        and tokens & {"pendiente", "pendientes", "borrador", "borradores"}
    )


# region Interpretacion comun y consultas durante la carga

# Abre la sesion de lectura y conserva el resultado comun de texto libre y LISTADO.
async def procesar_mensaje(state: ParteDiarioV3State, text: str, llm_client) -> TurnResult:
    with Session(db.engine) as session:
        result = await _interpretar_operaciones(session, state, text, llm_client)
    if result.process_state and not result.payload.get("cancelado"):
        state.parte_state = dict(result.process_state)
    return result


# Interpreta operaciones y coordina su resolucion y aplicacion, sin persistir el parte.
async def _interpretar_operaciones(
    session: Session, state: ParteDiarioV3State, text: str, llm_client,
) -> TurnResult:
    draft = state.draft()
    project = obras.buscar_por_oportunidad(session, draft.oportunidad_id)
    if project is None:
        return renderer.respuesta_simple("No encontre un proyecto asociado para cargar el parte diario.", keep_active=False)
    contacto_id = draft.contacto_id
    estados = parte_diario.cargar_estados(session)
    nominas_proyecto, nominas_completas = empleados.cargar_referencias(session,
        project.id,
        contacto_id=contacto_id,
        fecha=calendario.parsear_fecha(draft.fecha),
    )
    had_conversational_draft = novedades._has_conversational_draft(draft)
    novedades.limpiar_conflictos_repetidos(draft)
    command = _normalize_command(text)

    if command == "cancelar":
        return renderer.resultado_ejecucion(
            novedades.execute_plan(
                draft,
                TurnPlan(operations=[ParteDiarioOperation(type="cancelar")]),
                nominas_proyecto,
                nominas_completas,
                estados,
            )
        )

    session.commit()
    message_text = interpretacion._normalize_attendance_transcription(
        text,
        nominas_proyecto,
        nominas_completas,
    )
    try:
        plan = await llm_client.interpret_turn(
            message_text, draft, nominas_proyecto, estados,
            contexto_conversacion={
                "etapa": state.etapa,
                "obra": state.nombre_obra,
                "fecha_parte": draft.fecha,
                "historial": [dict(turno) for turno in state.historial],
                "pregunta_pendiente": state.aclaracion_pregunta,
                "opciones_listado": [item.to_dict() for item in state.asistencia_opciones],
            },
        )
    except Exception:
        logger.exception("No se pudo interpretar el turno de parte_diario")
        return renderer.respuesta_borrador(
            draft,
            "No pude interpretar el parte diario. Proba nuevamente con una descripcion breve.",
        )
    identity_error = interpretacion._apply_pre_resolved_nomina(plan, message_text)
    if identity_error:
        return renderer.respuesta_borrador(draft, identity_error)

    validation_error = novedades._validate_plan(plan, draft.fecha)
    if validation_error:
        return renderer.respuesta_borrador(draft, validation_error)

    if not calendario.tiene_referencia_fecha(message_text):
        plan.operations = [operation for operation in plan.operations if operation.type != "set_fecha"]

    date_operations = [operation for operation in plan.operations if operation.type == "set_fecha"]
    if date_operations:
        new_date = calendario.parsear_fecha(date_operations[-1].fecha)
        if new_date is None:
            return renderer.respuesta_borrador(draft, "No pude interpretar la fecha del parte diario.")
        if new_date > calendario.hoy():
            return renderer.respuesta_borrador(draft, "No se pueden registrar partes diarios de fechas futuras.")
        if draft.fecha and draft.fecha != new_date.isoformat() and not plan.is_readonly():
            draft.fecha_propuesta = new_date.isoformat()
            return renderer.respuesta_borrador(draft, renderer.preguntar_cambio_fecha(draft.fecha, draft.fecha_propuesta))
        date_error = parte_diario.aplicar_fecha(session,
            draft,
            new_date.isoformat(),
            estados,
            allow_closed=plan.is_readonly(),
        )
        if date_error:
            return renderer.respuesta_simple(date_error, keep_active=False)
        plan.operations = [operation for operation in plan.operations if operation.type != "set_fecha"]

    if draft.fecha is None and not plan.is_readonly():
        date_error = parte_diario.aplicar_fecha(session, draft, calendario.hoy().isoformat(), estados)
        if date_error:
            return renderer.respuesta_simple(date_error, keep_active=False)

    project_error = obras.resolver_operaciones_destino(session, plan, int(project.id), message_text)
    if project_error:
        return renderer.respuesta_borrador(draft, project_error)

    nominas_visibles = (
        empleados.listar_para_consulta(session,
            project.id,
            contacto_id=contacto_id,
            command=message_text,
            alcance=interpretacion._nomina_scope_from_operations(plan.operations),
            nominas_completas=nominas_completas,
            fecha=calendario.parsear_fecha(draft.fecha),
        )
        if any(operation.type == "mostrar_nomina" for operation in plan.operations)
        else None
    )
    result = novedades.execute_plan(
        draft,
        plan,
        nominas_proyecto,
        nominas_completas,
        estados,
        nominas_visibles=nominas_visibles,
    )
    if plan.is_readonly() and not had_conversational_draft:
        if any(operation.type == "mostrar_parte" for operation in plan.operations):
            result.reply = renderer.consulta(result.next_state)
        result.keep_active = False
    return renderer.resultado_ejecucion(result, plan=plan)


# Responde consultas de partes usando el adaptador, sin modificar el borrador.
async def consultar(state: ParteDiarioV3State, text: str, query_client) -> str:
    with Session(db.engine) as session:
        return await query_client.respond(
            session=session, message_text=text, etapa=state.etapa,
            proyecto_id=int(state.proyecto_id), contacto_id=state.contacto_id,
            nombre_obra=state.nombre_obra, fecha=state.draft().fecha, opciones_visibles=[],
        )

# endregion
