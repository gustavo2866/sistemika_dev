"""Handler de parteDiario v3."""

from __future__ import annotations

import logging
import re
import time
from datetime import date, timedelta
from types import SimpleNamespace

from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessMessage, V3ProcessResult
from agente.v3.emisor import V3MessageEmitter
from agente.v3.interactive import InteractiveButton, InteractiveListRow, whatsapp_buttons, whatsapp_list
from agente.v3.subprocesses.general_agent import GENERAL_MENU_TEXT
from agente.v3.subprocesses.parte_diario.carga_agent import (
    ParteDiarioCargaAgentClient,
    fallback_person_validation,
)
from agente.v3.subprocesses.parte_diario.calendario import (
    dia_operativo_anterior,
    es_dia_laborable,
    es_feriado,
    fecha_es_feriado,
)
from agente.v3.subprocesses.parte_diario.llm_client import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.query_agent import ParteDiarioQueryAgentClient
from agente.v3.subprocesses.parte_diario import renderer
from agente.v3.subprocesses.parte_diario.models import (
    NovedadPersonal,
    ParteDiarioState as ParteDiarioDraftState,
)
from agente.v3.subprocesses.parte_diario.process import (
    ParteDiarioProcess,
    _has_explicit_date_reference,
    _normalize_command,
    _requests_full_nomina,
    _requests_global_nomina,
    _today,
)
from agente.v3.subprocesses.parte_diario.resolver import (
    filter_candidate_selection,
    normalize_text,
    parse_candidate_selection,
    parse_estado_local,
    project_match_score,
)
from agente.v3.subprocesses.parte_diario.state import (
    ParteDiarioApoyoProyectoOption,
    ParteDiarioAsistenciaOption,
    ParteDiarioAsistenciaRegistro,
    ParteDiarioFechaOption,
    ParteDiarioOption,
    ParteDiarioV3State,
)
from app.db import engine
from app.models import CRMContacto, CRMOportunidad, EstadoParteDiario, Nomina, ParteDiario, Proyecto, ProyectoEncargado
from app.services.parte_diario_service import parte_diario_service

logger = logging.getLogger(__name__)

ASISTENCIA_PAGE_SIZE = 8


class ParteDiarioSubprocess:
    name = "parteDiario"

    def __init__(
        self,
        llm_client: ParteDiarioLLMClient | None = None,
        query_agent_client: ParteDiarioQueryAgentClient | None = None,
        carga_agent_client: ParteDiarioCargaAgentClient | None = None,
    ) -> None:
        self._llm = llm_client or ParteDiarioLLMClient()
        self._query_agent = query_agent_client or ParteDiarioQueryAgentClient()
        self._carga_agent = carga_agent_client or ParteDiarioCargaAgentClient()

    async def handle(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        state = ParteDiarioV3State.from_dict(context.process_state)

        if state.etapa == "seleccionar_obra" or (state.opciones_obra and not state.has_resolved_obra()):
            return await self._handle_seleccionar_obra(
                message,
                context,
                state,
                emisor=emisor,
            )

        # Compatibilidad: "cargar_fecha" era una etapa persistida; ahora es una transicion interna.
        if state.etapa == "cargar_fecha" and state.has_resolved_obra():
            return await self._preparar_fecha(context, state, emisor=emisor)

        if not state.has_resolved_obra():
            return await self._handle_inicial(message, context, state, emisor=emisor)

        if state.etapa == "seleccionar_fecha":
            return await self._handle_fecha_selection(message, context, state, emisor=emisor)

        if state.etapa == "continuar":
            return await self._handle_continuar(message, context, state)

        if state.etapa == "pendientes":
            return await self._handle_pendientes(message, context, state, emisor=emisor)

        if state.etapa == "novedades":
            return await self._handle_asistencia(message, context, state)

        if state.etapa == "apoyos":
            return self._apoyos_disabled_result(context, state)

        if state.etapa == "confirmar_salida":
            return self._handle_confirmar_salida(message, context, state)

        if state.etapa == "revision":
            return await self._handle_revision(message, context, state)

        if state.etapa == "cierre":
            return await self._handle_cierre(message, context, state)

        if state.etapa == "validacion":
            return await self._handle_validacion(message, context, state)

        if state.etapa == "carga":
            return await self._handle_carga(message, context, state)

        if state.etapa == "menu":
            return self._handle_menu(message, context, state)

        return await self._handle_inicial(message, context, state, emisor=emisor)

    async def _handle_validacion(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        if command in {"salir"}:
            state.etapa = "confirmar_salida"
            reply = _salida_confirmacion()
            return self._active_result(
                context,
                state,
                reply,
                "exit_confirmation",
                _confirmation_metadata(reply),
            )
        draft = state.draft()
        pending = draft.pendientes_ambiguos[0] if draft.pendientes_ambiguos else None
        if command in {"elegir opcion", "ver opciones", "opciones"}:
            return self._show_validation_options(context, state, reset_page=True)
        if pending is None:
            return await self._handle_parte_diario(message, context, state)

        if getattr(pending, "nombre_no_encontrado", False) and not _validation_candidates(pending):
            command = _normalize_command(message.text)
            if command == "si":
                return await self._handle_parte_diario(
                    message,
                    context,
                    state,
                    forced_text="registrar sin validar",
                    extra_result_metadata={
                        "carga_agent_source": "deterministic",
                        "carga_agent_action": "registrar_sin_validar",
                    },
                )
            if command == "no":
                draft = state.draft()
                skipped_name = draft.pendientes_ambiguos[0].nombre if draft.pendientes_ambiguos else pending.nombre
                if draft.pendientes_ambiguos:
                    draft.pendientes_ambiguos.pop(0)
                draft.esperando = None
                draft.validacion_origen = None
                state.etapa = "carga"
                state.set_draft(draft)
                return self._active_result(
                    context,
                    state,
                    f"No cargo {skipped_name}.\n\nHay alguna otra novedad?",
                    "validation_unmatched_skipped",
                    {"carga_agent_source": "deterministic", "carga_agent_action": "descartar_no_encontrado"},
                )

        if _is_other_candidates_command(message.text, pending):
            draft = state.draft()
            if draft.pendientes_ambiguos:
                draft.pendientes_ambiguos[0].mostrando_candidatos_externos = True
                draft.pendientes_ambiguos[0].lista_candidatos_mostrada = True
                pending = draft.pendientes_ambiguos[0]
                state.set_draft(draft)
            return self._active_result(
                context,
                state,
                _validation_text_menu(pending),
                "validation_other_candidates",
                {"carga_agent_source": "deterministic", "carga_agent_action": "mostrar_otros"},
            )

        candidates = _validation_candidates(pending)
        deterministic_selection = parse_candidate_selection(message.text or "", candidates)
        if deterministic_selection is not None:
            for index, candidate in enumerate(candidates, start=1):
                if candidate.idnomina == deterministic_selection.idnomina:
                    if draft.pendientes_ambiguos:
                        draft.pendientes_ambiguos[0].lista_candidatos_mostrada = True
                        state.set_draft(draft)
                    return await self._handle_parte_diario(
                        message,
                        context,
                        state,
                        forced_text=str(index),
                        extra_result_metadata={
                            "carga_agent_source": "deterministic",
                            "carga_agent_action": "seleccionar_persona",
                        },
                    )
        filtered_candidates = filter_candidate_selection(message.text or "", candidates)
        if len(filtered_candidates) > 1 and len(filtered_candidates) < len(candidates):
            draft = state.draft()
            if draft.pendientes_ambiguos:
                draft_pending = draft.pendientes_ambiguos[0]
                if draft_pending.mostrando_candidatos_externos:
                    draft_pending.candidatos_externos = filtered_candidates
                else:
                    draft_pending.candidatos = filtered_candidates
                draft_pending.lista_candidatos_mostrada = True
                state.set_draft(draft)
                return self._active_result(
                    context,
                    state,
                    _validation_text_menu(draft_pending),
                    "validation_candidates_filtered",
                    {"carga_agent_source": "deterministic", "carga_agent_action": "filtrar_candidatos"},
                )

        try:
            decision = await self._carga_agent.resolve_person_validation(
                message_text=message.text or "",
                pending=pending,
            )
            source = "agent_sdk"
        except RuntimeError as exc:
            logger.info("Agent SDK de carga parteDiario no disponible: %s", exc)
            decision = fallback_person_validation(message.text or "", pending)
            source = "fallback"
        except Exception:
            logger.exception("No se pudo resolver validacion de persona con Agent SDK")
            decision = fallback_person_validation(message.text or "", pending)
            source = "fallback"

        if decision.action == "registrar_sin_validar":
            return await self._handle_parte_diario(
                message,
                context,
                state,
                forced_text="registrar sin validar",
                extra_result_metadata={"carga_agent_source": source, "carga_agent_action": decision.action},
            )

        if decision.action == "seleccionar_persona" and decision.candidate_id is not None:
            for index, candidate in enumerate(candidates, start=1):
                if candidate.idnomina == decision.candidate_id:
                    draft = state.draft()
                    if draft.pendientes_ambiguos:
                        draft.pendientes_ambiguos[0].lista_candidatos_mostrada = True
                        state.set_draft(draft)
                    return await self._handle_parte_diario(
                        message,
                        context,
                        state,
                        forced_text=str(index),
                        extra_result_metadata={"carga_agent_source": source, "carga_agent_action": decision.action},
                    )

        if decision.action == "procesar_como_novedad":
            return await self._handle_parte_diario(
                message,
                context,
                state,
                forced_text=decision.text or message.text or "",
                extra_result_metadata={"carga_agent_source": source, "carga_agent_action": decision.action},
            )

        reply = _validation_text_menu(pending)
        return self._active_result(
            context,
            state,
            reply,
            "validation_agent_clarification",
            {"carga_agent_source": source, "carga_agent_action": decision.action},
        )

    async def _infer_initial_date(self, message: V3InboundMessage, state: ParteDiarioV3State) -> None:
        await self._infer_initial_date_text(message.text or "", state)

    async def _infer_initial_date_text(self, text: str, state: ParteDiarioV3State) -> None:
        draft = state.draft()
        if draft.fecha:
            return
        target_date = _parse_fecha_reference_in_text(text)
        if target_date is not None:
            if target_date > _today():
                return
            draft.fecha = target_date.isoformat()
            state.set_draft(draft)
            state.fecha_objetivo = draft.fecha
            state.fecha_referida_explicita = True
            return
        weekday = _weekday_only_reference(text)
        if weekday is not None:
            state.dia_semana_objetivo = weekday
            state.fecha_referida_explicita = True
            return
        if not _has_explicit_date_reference(text):
            return
        try:
            llm = _llm_for_stage(self._llm, "carga")
            if hasattr(llm, "normalize_initial_request"):
                normalized = await llm.normalize_initial_request(text)
                target_date = _parse_iso_date(normalized.get("fecha"))
            else:
                plan = await llm.interpret_turn(text, draft, [], [])
                date_operations = [operation for operation in plan.operations if operation.type == "set_fecha"]
                target_date = _parse_iso_date(date_operations[-1].fecha) if date_operations else None
        except Exception:
            logger.exception("No se pudo inferir fecha inicial de parteDiario")
            return
        if target_date is None:
            return
        if target_date > _today():
            return
        draft.fecha = target_date.isoformat()
        state.set_draft(draft)
        state.fecha_objetivo = draft.fecha
        state.fecha_referida_explicita = True

    async def _handle_inicial(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        state.modo_pendientes = _is_pending_parts_command(command)
        options = self._resolve_obra_options(message.from_address)
        if not options:
            state.etapa = "finalizado"
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text="No encontre una obra asociada para cargar el parte diario.",
                metadata={"process_name": self.name, "status": "obra_not_found"},
            )

        if len(options) == 1:
            state.set_obra(options[0])
            if state.modo_pendientes:
                return self._show_pending_parts_selection(context, state)
            if _is_date_menu_command(command) or _parse_fecha_value(message.text):
                return await self._handle_fecha_selection(message, context, state, emisor=emisor)
            await self._infer_initial_date(message, state)
            if _is_parte_diario_start_command(command):
                return await self._preparar_fecha(context, state, emisor=emisor)
            prepared = await self._preparar_fecha(context, state, reply_on_success=False, emisor=emisor)
            if prepared is not None:
                return prepared
            return await self._handle_carga(message, context, state)

        selected_by_text = _select_obra_option_from_text(message.text, options)
        if selected_by_text is not None:
            state.set_obra(selected_by_text)
            if state.modo_pendientes:
                return self._show_pending_parts_selection(context, state)
            if _is_date_menu_command(command) or _parse_fecha_value(message.text):
                return await self._handle_fecha_selection(message, context, state, emisor=emisor)
            await self._infer_initial_date(message, state)
            return await self._preparar_fecha(context, state, emisor=emisor)

        state.etapa = "seleccionar_obra"
        state.opciones_obra = options
        state.fecha_menu_pendiente = _is_date_menu_command(command)
        state.texto_fecha_inicial = message.text or None
        if not state.modo_pendientes:
            await self._infer_initial_date(message, state)
        return self._active_result(context, state, _seleccionar_obra(state), "obra_selection_required")

    async def _handle_seleccionar_obra(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        state.etapa = "seleccionar_obra"
        if command in {"salir"}:
            return _return_to_general(
                context,
                source="parte_diario_obra_selection",
                prefix="Carga de parte diario cancelada.",
            )
        selected_by_text = _select_obra_option_from_text(message.text, state.opciones_obra)
        if selected_by_text is not None:
            state.set_obra(selected_by_text)
            state.fecha_menu_pendiente = False
            if state.modo_pendientes:
                state.texto_fecha_inicial = None
                return self._show_pending_parts_selection(context, state)
            if state.texto_fecha_inicial:
                await self._infer_initial_date_text(state.texto_fecha_inicial, state)
                state.texto_fecha_inicial = None
            return await self._preparar_fecha(context, state, emisor=emisor)
        try:
            selected_option = int(command)
        except ValueError:
            return self._active_result(context, state, _comando_invalido(), "invalid_obra_selection")

        for option in state.opciones_obra:
            if option.opcion == selected_option:
                state.set_obra(option)
                state.fecha_menu_pendiente = False
                if state.modo_pendientes:
                    state.texto_fecha_inicial = None
                    return self._show_pending_parts_selection(context, state)
                if state.texto_fecha_inicial:
                    await self._infer_initial_date_text(state.texto_fecha_inicial, state)
                    state.texto_fecha_inicial = None
                return await self._preparar_fecha(context, state, emisor=emisor)
        return self._active_result(context, state, _comando_invalido(), "invalid_obra_selection")

    def _show_date_menu(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        prefix: str | None = None,
        status: str = "date_selection_required",
        extra_metadata: dict | None = None,
    ) -> V3ProcessResult:
        if not state.proyecto_id:
            return self._closed_result(
                context,
                "No encontre una obra asociada para cargar el parte diario.",
                "obra_not_found",
            )
        state.etapa = "seleccionar_fecha"
        state.fecha_menu_pendiente = False
        state.nombre_obra = state.nombre_obra or self._resolve_project_name(int(state.proyecto_id))
        state.opciones_fecha = self._build_fecha_options(int(state.proyecto_id), contacto_id=state.contacto_id)
        reply = _render_fecha_menu(state.opciones_fecha, prefix=prefix, obra=state.nombre_obra)
        return self._active_result(
            context,
            state,
            reply,
            status,
            _merge_metadata(extra_metadata, _date_menu_metadata(state.opciones_fecha, prefix=prefix, obra=state.nombre_obra)),
        )

    async def _handle_fecha_selection(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        selected_fecha = _parse_fecha_value(message.text)
        if selected_fecha:
            return await self._handle_fecha_value(selected_fecha, context, state, emisor=emisor)
        if _is_date_menu_command(command):
            state.parte_state = {}
            state.opciones_fecha = []
            return await self._preparar_fecha(context, state, emisor=emisor)

        if command in {"salir"}:
            return _return_to_general(context, source="parte_diario_fecha_menu")
        if command in {"continuar cargando", "continuar", "cargar", "seguir cargando"}:
            return self._show_date_menu(context, state)
        if _is_show_nomina_command(command):
            return self._show_nomina_on_date_menu(context, state, command=command)

        try:
            selected_option = int(command)
        except ValueError:
            return await self._contextual_fallback_to_date_menu(message, context, state)

        selected = next((option for option in state.opciones_fecha if option.opcion == selected_option), None)
        if selected is None:
            return self._active_result(
                context,
                state,
                _render_fecha_menu(state.opciones_fecha, prefix="Opcion invalida.", obra=state.nombre_obra),
                "invalid_date_selection",
                _date_menu_metadata(state.opciones_fecha, prefix="Opcion invalida.", obra=state.nombre_obra),
            )

        return await self._apply_fecha_selection(selected, context, state, emisor=emisor)

    async def _contextual_fallback_to_date_menu(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        reply = "Primero elegi una fecha del menu para continuar."
        options = [
            {
                "opcion": option.opcion,
                "fecha": option.fecha,
                "estado": option.estado,
            }
            for option in state.opciones_fecha
        ]
        if state.proyecto_id and _looks_like_internal_query(message.text or ""):
            try:
                with Session(engine) as session:
                    query_reply = await self._query_agent.respond(
                        session=session,
                        message_text=message.text or "",
                        etapa=state.etapa,
                        proyecto_id=int(state.proyecto_id),
                        contacto_id=state.contacto_id,
                        nombre_obra=state.nombre_obra,
                        opciones_visibles=options,
                    )
                if query_reply:
                    reply = query_reply
                    return self._show_date_menu(
                        context,
                        state,
                        prefix=reply,
                        status="contextual_query",
                        extra_metadata={"result": {"parte_diario": {"status": "contextual_query"}}},
                    )
            except RuntimeError as exc:
                logger.info("Agent SDK contextual de parteDiario no disponible: %s", exc)
            except Exception:
                logger.exception("No se pudo responder consulta contextual de parteDiario con Agent SDK")
        try:
            reply = await _llm_for_stage(self._llm, state.etapa).contextual_reply(
                mensaje=message.text or "",
                etapa=state.etapa,
                obra=state.nombre_obra,
                opciones_visibles=options,
            )
        except Exception:
            logger.exception("No se pudo generar fallback contextual de parteDiario")
        return self._show_date_menu(
            context,
            state,
            prefix=reply,
            status="contextual_fallback",
            extra_metadata={"result": {"parte_diario": {"status": "contextual_fallback"}}},
        )

    async def _handle_active_contextual_query(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult | None:
        if not state.proyecto_id or not _looks_like_pending_parts_query(message.text or ""):
            return None
        try:
            with Session(engine) as session:
                query_reply = await self._query_agent.respond(
                    session=session,
                    message_text=message.text or "",
                    etapa=state.etapa,
                    proyecto_id=int(state.proyecto_id),
                    contacto_id=state.contacto_id,
                    nombre_obra=state.nombre_obra,
                    opciones_visibles=[],
                )
            if not query_reply:
                return None
        except RuntimeError as exc:
            logger.info("Agent SDK contextual de parteDiario no disponible: %s", exc)
            return None
        except Exception:
            logger.exception("No se pudo responder consulta contextual activa de parteDiario")
            return None
        reply = _load_followup_reply(
            _humanize_dates_in_text(query_reply),
            state.draft(),
            status="shown",
            obra=state.nombre_obra,
        )
        return self._active_result(
            context,
            state,
            reply,
            "contextual_query",
            {"result": {"parte_diario": {"status": "contextual_query"}}},
        )

    def _show_nomina_on_date_menu(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        command: str,
    ) -> V3ProcessResult:
        if not state.proyecto_id:
            return self._closed_result(
                context,
                "No encontre una obra asociada para cargar el parte diario.",
                "obra_not_found",
            )
        with Session(engine) as session:
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, state.etapa))
            nominas_proyecto, nominas_completas = process._load_nominas(
                int(state.proyecto_id),
                contacto_id=state.contacto_id,
                filtrar_por_contacto=True,
            )
            if _requests_global_nomina(command):
                nominas = nominas_completas
            elif _requests_full_nomina(command):
                nominas, _ = process._load_nominas(
                    int(state.proyecto_id),
                    contacto_id=state.contacto_id,
                    filtrar_por_contacto=False,
                )
            else:
                nominas = nominas_proyecto
        return self._show_date_menu(
            context,
            state,
            prefix=renderer.mostrar_nomina(nominas),
            status="shown_nomina",
            extra_metadata={"result": {"parte_diario": {"status": "shown_nomina"}}},
        )

    @staticmethod
    def _resolve_project_name(proyecto_id: int) -> str | None:
        with Session(engine) as session:
            proyecto = session.get(Proyecto, proyecto_id)
            if proyecto is None:
                return None
            return proyecto.nombre

    async def _handle_fecha_value(
        self,
        fecha: str,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        if not state.proyecto_id:
            return self._closed_result(
                context,
                "No encontre una obra asociada para cargar el parte diario.",
                "obra_not_found",
            )

        if not state.opciones_fecha:
            state.opciones_fecha = self._build_fecha_options(int(state.proyecto_id), contacto_id=state.contacto_id)

        selected = next((option for option in state.opciones_fecha if option.fecha == fecha), None)
        if selected is None:
            state.etapa = "seleccionar_fecha"
            return self._active_result(
                context,
                state,
                _render_fecha_menu(state.opciones_fecha, prefix="Opcion invalida.", obra=state.nombre_obra),
                "invalid_date_selection",
                _date_menu_metadata(state.opciones_fecha, prefix="Opcion invalida.", obra=state.nombre_obra),
            )

        return await self._apply_fecha_selection(selected, context, state, emisor=emisor)

    async def _apply_fecha_selection(
        self,
        selected: ParteDiarioFechaOption,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        draft = state.draft()
        draft.fecha = selected.fecha
        draft.parte_id = None
        draft.novedades = []
        draft.pendientes_ambiguos = []
        draft.conflictos_novedad = []
        draft.sin_novedades_informado = False
        draft.fecha_propuesta = None
        draft.esperando = None
        draft.validacion_origen = None
        draft.retomado = False
        state.set_draft(draft)
        state.opciones_fecha = []
        state.etapa = "seleccionar_fecha"
        if selected.estado in {"confirmado", "cerrado"}:
            error = self._aplicar_fecha(state, allow_closed=True)
            if error:
                state.etapa = "seleccionar_fecha"
                return self._active_result(context, state, error, "date_selection_blocked")
            draft = state.draft()
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text=renderer.consulta(draft),
                metadata={
                    "process_name": self.name,
                    "status": "closed_date_selected",
                    "fecha": selected.fecha,
                    "parte_id": selected.parte_id,
                },
            )

        return await self._preparar_fecha(context, state, emisor=emisor)

    async def _preparar_fecha(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        reply_on_success: bool = True,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult | None:
        draft = state.draft()
        if not draft.fecha:
            if state.dia_semana_objetivo is not None:
                selected, has_closed_match = _resolve_pending_weekday_option(
                    int(state.proyecto_id or 0),
                    state.dia_semana_objetivo,
                    contacto_id=state.contacto_id,
                )
                if selected is None:
                    weekday_name = _weekday_name_by_index(state.dia_semana_objetivo)
                    state.fecha_referida_explicita = False
                    state.dia_semana_objetivo = None
                    prefix = f"No encontre un parte abierto de {weekday_name} en los ultimos 10 dias."
                    if has_closed_match:
                        prefix = f"El parte de {weekday_name} de los ultimos 10 dias ya esta cerrado."
                    return self._closed_result(context, prefix, "weekday_part_not_editable")
                draft.fecha = selected.fecha
                state.fecha_objetivo = selected.fecha
                state.dia_semana_objetivo = None
                state.set_draft(draft)
            if not state.fecha_referida_explicita and not state.fecha_objetivo:
                state.fecha_objetivo = _today().isoformat()
            if not draft.fecha:
                default_fecha, pending_count = resolver_fecha_default_parte_diario_info(
                    int(state.proyecto_id or 0),
                    contacto_id=state.contacto_id,
                )
                if default_fecha is None:
                    return self._show_date_menu(context, state)
                draft.fecha = default_fecha
                state.set_draft(draft)
                await _emitir_fecha_default_parte_diario(emisor, state, default_fecha, pending_count)

        explicit_flow = bool(state.fecha_referida_explicita)
        selected_is_target = bool(state.fecha_objetivo and draft.fecha == state.fecha_objetivo)
        error = self._aplicar_fecha(state, allow_closed=explicit_flow and selected_is_target)
        if error:
            state.etapa = "seleccionar_fecha"
            state.opciones_fecha = (
                self._build_fecha_options(int(state.proyecto_id or 0), contacto_id=state.contacto_id)
                if state.proyecto_id
                else []
            )
            return self._active_result(
                context,
                state,
                _render_fecha_menu(state.opciones_fecha, prefix=error, obra=state.nombre_obra),
                "date_not_editable",
                _date_menu_metadata(state.opciones_fecha, prefix=error, obra=state.nombre_obra),
            )
        if explicit_flow and selected_is_target and self._draft_fecha_is_closed(state.draft()):
            draft = state.draft()
            state.fecha_referida_explicita = False
            state.fecha_objetivo = None
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text=renderer.consulta(draft),
                metadata={
                    "process_name": self.name,
                    "status": "closed_date_selected",
                    "fecha": draft.fecha,
                    "parte_id": draft.parte_id,
                },
            )
        if selected_is_target:
            state.fecha_referida_explicita = False
        if not reply_on_success:
            return None
        draft = state.draft()
        reply = _load_start_reply(draft, _draft_status(draft), obra=state.nombre_obra)
        return self._active_result(
            context,
            state,
            reply,
            "date_loaded",
            {"fecha": draft.fecha, "parte_id": draft.parte_id},
        )

    async def _handle_continuar(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        if command in {"si", "sí", "continuar", "1", "continuar cargando", "cargar", "seguir cargando"}:
            draft = state.draft()
            fecha = str(draft.fecha_propuesta or "").strip()
            if not fecha and state.proyecto_id:
                fecha, _pending_count = resolver_fecha_default_parte_diario_info(
                    int(state.proyecto_id),
                    contacto_id=state.contacto_id,
                )
            if not fecha:
                return _finish_parte_diario_flow(context)
            draft.fecha = fecha
            draft.fecha_propuesta = None
            draft.parte_id = None
            draft.novedades = []
            draft.pendientes_ambiguos = []
            draft.conflictos_novedad = []
            draft.sin_novedades_informado = False
            draft.esperando = None
            draft.validacion_origen = None
            draft.retomado = False
            state.set_draft(draft)
            state.opciones_fecha = []
            state.etapa = "seleccionar_fecha"
            prepared = await self._preparar_fecha(context, state)
            if prepared is not None:
                return prepared

        if command in {"no", "finalizar", "2", "salir"}:
            return _finish_parte_diario_flow(context)

        draft = state.draft()
        fecha = str(draft.fecha_propuesta or "").strip()
        if fecha:
            reply = _continue_proposal_reply(fecha)
            return self._active_result(
                context,
                state,
                reply,
                "continue_confirmation_required",
            )
        return _finish_parte_diario_flow(context)

    async def _handle_pendientes(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        emisor: V3MessageEmitter | None = None,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        if command in {"no", "ninguno", "ninguna", "finalizar", "salir", "2"}:
            return _finish_parte_diario_flow(context)

        if not state.opciones_fecha and state.proyecto_id:
            state.opciones_fecha = _pending_parts_last_days_options(state)
        if not state.opciones_fecha:
            return _finish_parte_diario_flow(context)

        selected = _select_pending_option(message.text, state.opciones_fecha)
        if selected is None:
            reply = _pending_parts_prompt(
                state.opciones_fecha,
                prefix="No pude identificar que parte pendiente queres cargar.",
            )
            return self._active_result(
                context,
                state,
                reply,
                "pending_part_selection_required",
                _pending_parts_metadata(state.opciones_fecha),
            )

        state.fecha_referida_explicita = True
        state.fecha_objetivo = selected.fecha
        state.opciones_fecha = []
        return await self._apply_fecha_selection(selected, context, state, emisor=emisor)

    def _aplicar_fecha(self, state: ParteDiarioV3State, *, allow_closed: bool = False) -> str | None:
        draft = state.draft()
        if not draft.fecha:
            return "Selecciona una fecha para cargar el parte diario."
        with Session(engine) as session:
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, state.etapa))
            estados = process._load_estados()
            error = process._apply_date(draft, draft.fecha, estados, allow_closed=allow_closed)
        if error:
            return error
        state.set_draft(draft)
        state.etapa = "carga"
        return None

    def _draft_fecha_is_closed(self, draft) -> bool:
        if not draft.fecha or not draft.idproyecto:
            return False
        with Session(engine) as session:
            query = (
                select(ParteDiario)
                .where(ParteDiario.idproyecto == int(draft.idproyecto))
                .where(ParteDiario.fecha == date.fromisoformat(str(draft.fecha)))
                .where(ParteDiario.deleted_at.is_(None))
            )
            if draft.contacto_id:
                parte = session.exec(query.where(ParteDiario.contacto_id == int(draft.contacto_id))).first()
                if parte is None:
                    parte = session.exec(query.where(ParteDiario.contacto_id.is_(None))).first()
            else:
                parte = session.exec(query).first()
        return parte is not None and parte.estado in {EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO}

    def _handle_confirmar_salida(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        if command in {"ok", "1"}:
            return _return_to_general(
                context,
                source="parte_diario_exit_confirmed",
                prefix="Parte diario descartado.",
            )

        if command in {"volver", "2"}:
            state.etapa = "carga"
            reply = _volver_carga_reply(state.draft(), obra=state.nombre_obra)
            return self._active_result(
                context,
                state,
                reply,
                "exit_cancelled",
            )

        return self._active_result(
            context,
            state,
            _salida_confirmacion(),
            "invalid_exit_confirmation",
            _confirmation_metadata(_salida_confirmacion()),
        )

    def _handle_menu(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        if command in {"3", "salir"}:
            return _return_to_general(context, source="parte_diario_legacy_menu")
        return self._show_date_menu(context, state)

    async def _handle_confirmar_sin_novedades(
        self,
        command: str,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        if command in {"ok", "1"}:
            draft.sin_novedades_informado = True
            draft.esperando = None
            state.set_draft(draft)
            state.etapa = "cierre"
            return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")

        if command in {"volver", "2"}:
            draft.esperando = None
            draft.validacion_origen = None
            state.set_draft(draft)
            state.etapa = "revision"
            reply = _review_reply(draft, obra=state.nombre_obra)
            return self._active_result(
                context,
                state,
                reply,
                "empty_close_cancelled",
                _review_metadata(reply),
            )

        return await self._process_as_load_message(
            message,
            context,
            state,
            status="empty_close_confirmation_interrupted",
        )

    async def _handle_confirmar_cierre_validado(
        self,
        command: str,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        if command in {"ok", "1"}:
            draft.esperando = None
            state.set_draft(draft)
            state.etapa = "cierre"
            return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")

        if command in {"volver", "2"}:
            draft.esperando = None
            draft.validacion_origen = None
            state.set_draft(draft)
            state.etapa = "revision"
            reply = _review_reply(draft, obra=state.nombre_obra)
            return self._active_result(
                context,
                state,
                reply,
                "validated_close_cancelled",
                _review_metadata(reply),
            )

        return await self._process_as_load_message(
            message,
            context,
            state,
            status="validated_close_confirmation_interrupted",
        )

    def _show_validation_options(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        reset_page: bool = False,
    ) -> V3ProcessResult:
        draft = state.draft()
        pending = draft.pendientes_ambiguos[0] if draft.pendientes_ambiguos else None
        if reset_page and pending is not None:
            pending.pagina_candidatos = 0
        if pending is not None:
            pending.lista_candidatos_mostrada = True
            state.set_draft(draft)
        reply = _validation_text_menu(pending) if pending else "Elegi una opcion."
        return self._active_result(
            context,
            state,
            reply,
            "validation_options",
        )

    def _back_to_load_from_validation(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        draft.esperando = None
        draft.validacion_origen = None
        state.set_draft(draft)
        state.etapa = "carga"
        reply = _volver_carga_reply(draft, obra=state.nombre_obra)
        return self._active_result(
            context,
            state,
            reply,
            "validation_back_to_load",
        )

    async def _handle_revision(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        draft = state.draft()
        if draft.esperando == "confirmacion_sin_novedades":
            return await self._handle_confirmar_sin_novedades(command, message, context, state)
        if draft.esperando == "confirmacion_cierre_validado":
            return await self._handle_confirmar_cierre_validado(command, message, context, state)

        if command in {"no", "guardar", "guardar borrador", "1"}:
            return await self._guardar_borrador(message, context, state)

        if command in {"si", "cerrar", "finalizar", "finalizar parte", "2"}:
            if _is_empty_draft(draft):
                draft.esperando = "confirmacion_sin_novedades"
                state.set_draft(draft)
                state.etapa = "cierre"
                reply = _sin_novedades_confirmacion()
                return self._active_result(
                    context,
                    state,
                    reply,
                    "empty_close_confirmation",
                    _confirmation_metadata(reply),
                )
            return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")

        if command in {"seguir editando", "editar", "3", "volver"}:
            state.etapa = "carga"
            return self._active_result(
                context,
                state,
                _seguir_editando_reply(draft, obra=state.nombre_obra),
                "back_to_load",
            )

        if command in {"salir"}:
            state.etapa = "confirmar_salida"
            return self._active_result(
                context,
                state,
                _salida_confirmacion(),
                "exit_confirmation",
                _confirmation_metadata(_salida_confirmacion()),
            )

        return await self._process_as_load_message(
            message,
            context,
            state,
            status="review_interrupted",
        )

    async def _handle_cierre(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        draft = state.draft()
        if draft.esperando == "confirmacion_sin_novedades":
            return await self._handle_confirmar_sin_novedades(command, message, context, state)
        if draft.esperando == "confirmacion_cierre_validado":
            return await self._handle_confirmar_cierre_validado(command, message, context, state)

        if command in {"no", "guardar", "guardar borrador", "1"}:
            return await self._guardar_borrador(message, context, state)

        if command in {"si", "cerrar", "finalizar", "finalizar parte", "2"}:
            if _is_empty_draft(draft):
                draft.esperando = "confirmacion_sin_novedades"
                state.set_draft(draft)
                state.etapa = "cierre"
                reply = _sin_novedades_confirmacion()
                return self._active_result(
                    context,
                    state,
                    reply,
                    "empty_close_confirmation",
                    _confirmation_metadata(reply),
                )
            return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")

        if command in {"seguir editando", "editar", "3", "volver"}:
            state.etapa = "carga"
            return self._active_result(
                context,
                state,
                _seguir_editando_reply(draft, obra=state.nombre_obra),
                "back_to_load",
            )

        if command in {"salir"}:
            state.etapa = "confirmar_salida"
            return self._active_result(
                context,
                state,
                _salida_confirmacion(),
                "exit_confirmation",
                _confirmation_metadata(_salida_confirmacion()),
            )

        return await self._process_as_load_message(
            message,
            context,
            state,
            status="review_interrupted",
        )

    async def _process_as_load_message(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        status: str,
    ) -> V3ProcessResult:
        draft = state.draft()
        draft.esperando = None
        draft.validacion_origen = None
        state.set_draft(draft)
        state.etapa = "carga"
        result = await self._handle_carga(message, context, state)
        result.metadata.setdefault("interrupted_status", status)
        return result

    async def _guardar_borrador(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        if not draft.fecha:
            reply = "No hay una fecha cargada para guardar el parte."
            return self._active_result(
                context,
                state,
                reply,
                "missing_date",
            )

        payload = _save_payload(draft, cerrar_parte=False)
        payload["contacto_id"] = int(state.contacto_id or 0)
        started = time.perf_counter()
        with Session(engine) as session:
            try:
                parte = parte_diario_service.create_or_update_from_agent_v3_confirmation(
                    session,
                    contacto_id=int(state.contacto_id or 0),
                    oportunidad_id=int(state.oportunidad_id or 0),
                    result=payload,
                    conversation_id=context.conversation_id,
                    provider=message.provider,
                    channel_type=message.channel_type,
                    account_ref=message.account_ref,
                    from_address=message.from_address,
                    to_address=message.to_address,
                    external_message_id=message.external_message_id,
                    text=message.text,
                    message_type=message.message_type,
                    raw_payload=message.raw_payload,
                    normalized_payload=message.normalized_payload,
                    received_at=message.received_at,
                )
            except Exception as exc:
                logger.exception("Error guardando borrador de parte diario desde agente v3")
                error_reply = _persistence_debug_message(
                    exc,
                    stage="guardar_borrador",
                    draft=draft,
                    state=state,
                    context=context,
                    message=message,
                    payload=payload,
                )
                reply = _review_reply(draft, obra=state.nombre_obra, prefix=error_reply)
                return self._active_result(
                    context,
                    state,
                    reply,
                    "persistence_error",
                    _review_metadata(reply) if state.etapa == "revision" else None,
                )

        payload["parte_diario_id"] = parte.id
        logger.info(
            "v3_parte_diario_save_draft_timing external_message_id=%s parte_diario_id=%s persist_total_ms=%s",
            message.external_message_id,
            parte.id,
            round((time.perf_counter() - started) * 1000, 3),
        )
        return await self._post_action_result(
            context,
            state,
            payload["reply_to_user"],
            "saved",
            {
                "process_name": self.name,
                "parte_listo": True,
                "parte_diario_id": parte.id,
                "mensaje_origen_id": parte.mensaje_origen_id,
                "result": payload,
            },
        )

    async def _handle_carga(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        if draft.esperando == "confirmacion_ambiguos":
            return await self._handle_validacion(message, context, state)
        if draft.esperando == "confirmacion_sin_novedades":
            command = _normalize_command(message.text)
            return await self._handle_confirmar_sin_novedades(command, message, context, state)
        if draft.esperando == "confirmacion_cierre_validado":
            command = _normalize_command(message.text)
            return await self._handle_confirmar_cierre_validado(command, message, context, state)
        return await self._handle_parte_diario(message, context, state)

    def _apoyos_disabled_result(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        self._clear_apoyos_state(state)
        state.etapa = "carga"
        draft = state.draft()
        notice = (
            "La modalidad APOYO ya no esta disponible. "
            "Para registrar trabajo en otra obra, cargalo como novedad normal. "
            "Ejemplo: Perez fue a Francia 118 8hs."
        )
        reply = (
            f"{notice}\n\n"
            f"{_load_followup_reply(renderer.resumen(draft), draft, status='shown', obra=state.nombre_obra)}"
        )
        return self._active_result(
            context,
            state,
            reply,
            "apoyos_disabled",
            {"result": {"parte_diario": {"status": "apoyos_disabled"}}},
        )

    def _start_apoyos(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        text: str,
    ) -> V3ProcessResult:
        state.etapa = "apoyos"
        state.apoyo_proyecto_id = None
        state.apoyo_proyecto_nombre = None
        state.opciones_apoyo_proyecto = []
        state.asistencia_offset = 0
        state.asistencia_opciones = []
        state.asistencia_registros = []
        state.asistencia_reemplazo_pendiente = {}
        origin_text = _extract_apoyos_origin_text(text)
        if origin_text:
            return self._resolve_apoyo_project(context, state, origin_text)
        return self._ask_apoyo_project(context, state)

    async def _handle_apoyos(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        if command in {"salir"}:
            return self._finish_apoyos(context, state)

        if not state.apoyo_proyecto_id:
            selected = self._parse_apoyo_project_selection(message.text, state)
            if selected is not None:
                state.apoyo_proyecto_id = selected.proyecto_id
                state.apoyo_proyecto_nombre = selected.nombre
                state.opciones_apoyo_proyecto = []
                state.asistencia_offset = 0
                return self._show_apoyos_page(context, state)
            return self._resolve_apoyo_project(context, state, message.text or "")

        if not state.asistencia_opciones:
            return self._show_apoyos_page(context, state)

        if command in {"no", "nadie", "ninguno", "ninguna"} or command.startswith("no "):
            return self._advance_apoyos_page(context, state)

        parsed, error = self._parse_apoyo_entries(message.text or "", state.asistencia_opciones)
        if error:
            reply = f"{error}\n\n{self._apoyos_current_page_text(state)}"
            return self._active_result(context, state, reply, "apoyos_invalid_response")

        with Session(engine) as session:
            estados = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, "carga"))._load_estados()
        present = next((item for item in estados if item.abreviatura.upper() == "P"), None)
        draft = state.draft()
        for option, hours in parsed:
            self._apply_apoyo_novedad(draft, state, option=option, horas=hours, present_id=present.id if present else None)
        draft.sin_novedades_informado = False
        draft.esperando = None
        state.set_draft(draft)
        return self._advance_apoyos_page(context, state, prefix="Cargado.")

    def _ask_apoyo_project(self, context: V3ConversationContext, state: ParteDiarioV3State) -> V3ProcessResult:
        state.etapa = "apoyos"
        return self._active_result(context, state, "De que obra viene el apoyo?", "apoyos_project_required")

    def _resolve_apoyo_project(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        text: str,
    ) -> V3ProcessResult:
        options = self._find_apoyo_projects(state, text)
        if not options:
            return self._active_result(
                context,
                state,
                "No encontre una obra con nomina activa para ese apoyo. Indica el nombre de la obra origen.",
                "apoyos_project_not_found",
            )
        if len(options) == 1:
            selected = options[0]
            state.apoyo_proyecto_id = selected.proyecto_id
            state.apoyo_proyecto_nombre = selected.nombre
            state.opciones_apoyo_proyecto = []
            state.asistencia_offset = 0
            return self._show_apoyos_page(context, state)
        state.opciones_apoyo_proyecto = options
        lines = ["A que obra de origen te referis?", ""]
        lines.extend(f"{option.opcion}. {option.nombre}" for option in options)
        lines.append("")
        lines.append("Responde con el numero o el nombre.")
        return self._active_result(context, state, "\n".join(lines), "apoyos_project_ambiguous")

    def _parse_apoyo_project_selection(
        self,
        text: str | None,
        state: ParteDiarioV3State,
    ) -> ParteDiarioApoyoProyectoOption | None:
        command = _normalize_command(text)
        try:
            selected_option = int(command)
        except ValueError:
            selected_option = None
        if selected_option is not None:
            return next((option for option in state.opciones_apoyo_proyecto if option.opcion == selected_option), None)
        normalized = normalize_text(text)
        matches = [
            option for option in state.opciones_apoyo_proyecto
            if project_match_score(normalized, option.nombre) >= 0.55
        ]
        return matches[0] if len(matches) == 1 else None

    def _find_apoyo_projects(self, state: ParteDiarioV3State, text: str) -> list[ParteDiarioApoyoProyectoOption]:
        normalized = normalize_text(text)
        with Session(engine) as session:
            rows = session.exec(
                select(Proyecto.id, Proyecto.nombre)
                .join(Nomina, Nomina.idproyecto == Proyecto.id)
                .where(Proyecto.id != int(state.proyecto_id or 0))
                .where(Proyecto.deleted_at.is_(None))
                .where(Nomina.activo.is_(True))
                .where(Nomina.deleted_at.is_(None))
                .group_by(Proyecto.id, Proyecto.nombre)
                .order_by(Proyecto.nombre.asc())
            ).all()
        scored_matches = [
            (score, int(project_id), str(name or "").strip())
            for project_id, name in rows
            if (score := project_match_score(normalized, str(name or ""))) >= 0.55
        ]
        scored_matches.sort(key=lambda item: (-item[0], item[2].lower()))
        matches = [(project_id, name) for _, project_id, name in scored_matches]
        if not normalized:
            matches = [(int(project_id), str(name or "").strip()) for project_id, name in rows]
        return [
            ParteDiarioApoyoProyectoOption(opcion=index, proyecto_id=project_id, nombre=name)
            for index, (project_id, name) in enumerate(matches[:10], start=1)
            if name
        ]

    def _show_apoyos_page(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        prefix: str | None = None,
    ) -> V3ProcessResult:
        nominas = self._load_apoyos_nomina(state)
        total = len(nominas)
        if total == 0:
            apoyo_nombre = state.apoyo_proyecto_nombre or "la obra origen"
            state.etapa = "carga"
            self._clear_apoyos_state(state)
            return self._active_result(
                context,
                state,
                f"No hay nomina activa en {apoyo_nombre}.\n\n{_apoyos_next_steps()}",
                "apoyos_empty_nomina",
            )
        if state.asistencia_offset >= total:
            return self._finish_apoyos(context, state)
        page = nominas[state.asistencia_offset : state.asistencia_offset + ASISTENCIA_PAGE_SIZE]
        state.asistencia_opciones = [
            ParteDiarioAsistenciaOption(
                opcion=index,
                idnomina=int(item.id),
                nombre=item.nombre,
                apellido=item.apellido,
                nro_legajo=item.nro_legajo,
                proyecto_id=state.apoyo_proyecto_id,
                nombre_proyecto=state.apoyo_proyecto_nombre,
            )
            for index, item in enumerate(page, start=state.asistencia_offset + 1)
            if item.id is not None
        ]
        reply = self._apoyos_page_text(state, total=total, prefix=prefix)
        return self._active_result(context, state, reply, "apoyos_page")

    def _advance_apoyos_page(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        prefix: str | None = None,
    ) -> V3ProcessResult:
        state.asistencia_offset += ASISTENCIA_PAGE_SIZE
        return self._show_apoyos_page(context, state, prefix=prefix)

    def _finish_apoyos(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        registros = list(state.asistencia_registros)
        self._clear_apoyos_state(state)
        state.etapa = "carga"
        if not registros:
            reply = f"Apoyos finalizados.\n\nNo se cargaron apoyos.\n\n{_apoyos_next_steps()}"
        else:
            lines = ["Apoyos finalizados.", "", "Apoyos cargados:"]
            lines.extend(f"- {item.nombre}: {item.motivo}" for item in registros)
            lines.extend(["", _apoyos_next_steps()])
            reply = "\n".join(lines)
        return self._active_result(context, state, reply, "apoyos_finished")

    def _clear_apoyos_state(self, state: ParteDiarioV3State) -> None:
        state.apoyo_proyecto_id = None
        state.apoyo_proyecto_nombre = None
        state.opciones_apoyo_proyecto = []
        state.asistencia_offset = 0
        state.asistencia_opciones = []
        state.asistencia_registros = []
        state.asistencia_reemplazo_pendiente = {}

    def _apoyos_current_page_text(self, state: ParteDiarioV3State) -> str:
        nominas = self._load_apoyos_nomina(state)
        return self._apoyos_page_text(state, total=len(nominas))

    def _apoyos_page_text(
        self,
        state: ParteDiarioV3State,
        *,
        total: int,
        prefix: str | None = None,
    ) -> str:
        start = state.asistencia_offset + 1
        end = state.asistencia_offset + len(state.asistencia_opciones)
        lines: list[str] = []
        if prefix:
            lines.extend([prefix, ""])
        lines.append(f"Apoyos desde {state.apoyo_proyecto_nombre or 'obra origen'} - {state.nombre_obra or 'obra seleccionada'}")
        lines.append(f"Empleados {start}-{end} de {total}:")
        lines.append("")
        for option in state.asistencia_opciones:
            existing = self._find_asistencia_existing(state.draft(), option.idnomina)
            suffix = f" - ya cargado: {existing.horas:g}h" if existing and existing.horas is not None else ""
            lines.append(f"{option.opcion}. {option.nombre_completo}{suffix}")
        lines.extend(
            [
                "",
                "Quien trabajo en esta obra? Indica numero y horas opcionales, o responde NO.",
                "SALIR para terminar apoyos.",
            ]
        )
        return "\n".join(lines)

    def _load_apoyos_nomina(self, state: ParteDiarioV3State) -> list[Nomina]:
        if not state.apoyo_proyecto_id:
            return []
        with Session(engine) as session:
            return list(
                session.exec(
                    select(Nomina)
                    .where(Nomina.idproyecto == int(state.apoyo_proyecto_id))
                    .where(Nomina.activo.is_(True))
                    .where(Nomina.deleted_at.is_(None))
                    .order_by(Nomina.apellido.asc(), Nomina.nombre.asc())
                ).all()
            )

    def _parse_apoyo_entries(self, text: str, options: list[ParteDiarioAsistenciaOption]):
        normalized_text = re.sub(r"\s+y\s+(?=\d+\b)", "\n", text or "", flags=re.IGNORECASE)
        parts = [part.strip() for part in re.split(r"[,;\n]+", normalized_text) if part.strip()]
        if not parts:
            return [], "No pude interpretar la respuesta. Indica numero y horas opcionales, por ejemplo: 2 8hs."
        parsed = []
        options_by_number = {option.opcion: option for option in options}
        for part in parts:
            match = re.match(r"^\s*(\d+)(?:[\).\:\-\s]+(.+?)\s*)?$", part)
            if not match:
                return [], "No pude identificar el numero de empleado. Indica numero y horas opcionales, por ejemplo: 2 8hs."
            number = int(match.group(1))
            detail = (match.group(2) or "").strip()
            option = options_by_number.get(number)
            if option is None:
                available = ", ".join(str(item.opcion) for item in options)
                return [], f"El numero {number} no esta en esta pagina. Opciones disponibles: {available}."
            hours = _parse_hours_from_text(detail) if detail else 9.0
            if hours is None:
                return [], f"No pude identificar las horas en '{detail}'. Usa por ejemplo: {number} 8hs."
            if hours < 0 or hours > 24:
                return [], "Las horas deben estar entre 0 y 24."
            parsed.append((option, hours))
        return parsed, None

    def _apply_apoyo_novedad(
        self,
        draft,
        state: ParteDiarioV3State,
        *,
        option: ParteDiarioAsistenciaOption,
        horas: float,
        present_id: int | None,
    ) -> None:
        nombre = option.nombre_completo
        novedad = NovedadPersonal(
            nombre=nombre,
            idnomina=option.idnomina,
            idestado=present_id,
            estado_codigo="P",
            horas=horas,
            descripcion=f"Apoyo desde {option.nombre_proyecto or state.apoyo_proyecto_nombre or 'otra obra'}",
            fuera_de_proyecto=True,
            nombre_proyecto=option.nombre_proyecto or state.apoyo_proyecto_nombre,
            nro_legajo=option.nro_legajo,
        )
        existing = self._find_asistencia_existing(draft, option.idnomina)
        if existing is None:
            draft.novedades.append(novedad)
        else:
            existing.nombre = novedad.nombre
            existing.idestado = novedad.idestado
            existing.estado_codigo = novedad.estado_codigo
            existing.horas = novedad.horas
            existing.descripcion = novedad.descripcion
            existing.fuera_de_proyecto = True
            existing.nombre_proyecto = novedad.nombre_proyecto
            existing.nro_legajo = novedad.nro_legajo
        state.asistencia_registros.append(
            ParteDiarioAsistenciaRegistro(
                nombre=nombre,
                estado_codigo="P",
                motivo=f"{horas:g}h desde {novedad.nombre_proyecto or 'otra obra'}",
            )
        )

    def _start_asistencia(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        state.etapa = "novedades"
        state.asistencia_offset = 0
        state.asistencia_opciones = []
        state.asistencia_registros = []
        state.asistencia_reemplazo_pendiente = {}
        return self._show_asistencia_page(context, state)

    async def _handle_asistencia(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        command = _normalize_command(message.text)
        if command in {"salir"}:
            return self._finish_asistencia(context, state)

        if state.asistencia_reemplazo_pendiente:
            if command in {"ok", "si", "confirmar"}:
                return self._confirm_asistencia_reemplazo(context, state)
            if command in {"volver", "no", "cancelar"}:
                state.asistencia_reemplazo_pendiente = {}
                reply = f"Mantengo la novedad cargada.\n\n{self._asistencia_current_page_text(state)}"
                return self._active_result(context, state, reply, "asistencia_replace_cancelled")
            reply = (
                "Responde OK para reemplazar la novedad o VOLVER para mantenerla.\n\n"
                f"{self._asistencia_reemplazo_text(state)}"
            )
            return self._active_result(
                context,
                state,
                reply,
                "asistencia_replace_confirmation",
                _confirmation_metadata(reply),
            )

        if not state.asistencia_opciones:
            return self._show_asistencia_page(context, state)

        if command in {"no", "nadie", "ninguno", "ninguna"} or command.startswith("no "):
            return self._advance_asistencia_page(context, state)

        with Session(engine) as session:
            estados = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, "carga"))._load_estados()
            parsed, error = await self._parse_asistencia_entries(
                message.text or "",
                state.asistencia_opciones,
                estados,
                state=state,
            )

        if error:
            reply = f"{error}\n\n{self._asistencia_current_page_text(state)}"
            return self._active_result(context, state, reply, "asistencia_invalid_response")

        draft = state.draft()
        existing_entries = [
            (
                option,
                estado,
                motivo,
                horas,
                nombre_proyecto,
                idproyecto_destino,
                self._find_asistencia_existing(draft, option.idnomina),
            )
            for option, estado, motivo, horas, nombre_proyecto, idproyecto_destino in parsed
        ]
        replacement_entries = [item for item in existing_entries if item[6] is not None]
        if replacement_entries:
            if len(parsed) > 1:
                reply = (
                    "Para reemplazar una novedad ya cargada, indica solo esa persona.\n\n"
                    f"{self._asistencia_current_page_text(state)}"
                )
                return self._active_result(context, state, reply, "asistencia_replace_single_required")
            option, estado, motivo, horas, nombre_proyecto, idproyecto_destino, existing = replacement_entries[0]
            state.asistencia_reemplazo_pendiente = {
                "option": option.to_dict(),
                "estado_id": estado.id,
                "estado_codigo": estado.abreviatura.upper(),
                "motivo": motivo,
                "horas": horas,
                "fuera_de_proyecto": bool(nombre_proyecto),
                "nombre_proyecto": nombre_proyecto,
                "idproyecto_destino": idproyecto_destino,
                "estado_anterior": getattr(existing, "estado_codigo", None),
            }
            reply = self._asistencia_reemplazo_text(state)
            return self._active_result(
                context,
                state,
                reply,
                "asistencia_replace_confirmation",
                _confirmation_metadata(reply),
            )

        for option, estado, motivo, horas, nombre_proyecto, idproyecto_destino in parsed:
            self._apply_asistencia_novedad(
                draft,
                state,
                option=option,
                estado_id=estado.id,
                estado_codigo=estado.abreviatura.upper(),
                motivo=motivo,
                horas=horas,
                fuera_de_proyecto=bool(nombre_proyecto),
                nombre_proyecto=nombre_proyecto,
                idproyecto_destino=idproyecto_destino,
            )
        draft.sin_novedades_informado = False
        draft.esperando = None
        state.set_draft(draft)
        return self._advance_asistencia_page(context, state, prefix="Cargado.")

    def _show_asistencia_page(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        prefix: str | None = None,
    ) -> V3ProcessResult:
        nominas = self._load_asistencia_nomina(state)
        total = len(nominas)
        if total == 0:
            state.etapa = "carga"
            state.asistencia_offset = 0
            state.asistencia_opciones = []
            state.asistencia_registros = []
            state.asistencia_reemplazo_pendiente = {}
            return self._active_result(
                context,
                state,
                f"No hay nomina activa asignada a {state.nombre_obra or 'la obra seleccionada'}.\n\nHay alguna otra novedad?",
                "asistencia_empty_nomina",
            )
        if state.asistencia_offset >= total:
            return self._finish_asistencia(context, state)

        page = nominas[state.asistencia_offset : state.asistencia_offset + ASISTENCIA_PAGE_SIZE]
        state.asistencia_opciones = [
            ParteDiarioAsistenciaOption(
                opcion=index,
                idnomina=int(item.id),
                nombre=item.nombre,
                apellido=item.apellido,
                nro_legajo=item.nro_legajo,
            )
            for index, item in enumerate(page, start=state.asistencia_offset + 1)
            if item.id is not None
        ]
        reply = self._asistencia_page_text(state, total=total, prefix=prefix)
        return self._active_result(context, state, reply, "asistencia_page")

    def _advance_asistencia_page(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        prefix: str | None = None,
    ) -> V3ProcessResult:
        state.asistencia_offset += ASISTENCIA_PAGE_SIZE
        return self._show_asistencia_page(context, state, prefix=prefix)

    def _finish_asistencia(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        state.etapa = "carga"
        state.asistencia_offset = 0
        state.asistencia_opciones = []
        state.asistencia_registros = []
        state.asistencia_reemplazo_pendiente = {}
        draft = state.draft()
        reply = _load_followup_reply(
            renderer.actualizado(draft),
            draft,
            status="updated",
            obra=state.nombre_obra,
        )
        return self._active_result(context, state, reply, "asistencia_finished")

    def _asistencia_current_page_text(self, state: ParteDiarioV3State) -> str:
        nominas = self._load_asistencia_nomina(state)
        return self._asistencia_page_text(state, total=len(nominas))

    def _asistencia_page_text(
        self,
        state: ParteDiarioV3State,
        *,
        total: int,
        prefix: str | None = None,
    ) -> str:
        start = state.asistencia_offset + 1
        end = state.asistencia_offset + len(state.asistencia_opciones)
        lines: list[str] = []
        if prefix:
            lines.extend([prefix, ""])
        lines.append(f"Listado - {state.nombre_obra or 'obra seleccionada'}")
        lines.append(f"Empleados {start}-{end} de {total}:")
        lines.append("")
        for option in state.asistencia_opciones:
            existing = self._find_asistencia_existing(state.draft(), option.idnomina)
            suffix = _asistencia_existing_suffix(existing)
            lines.append(f"{option.opcion}. {option.nombre_completo}{suffix}")
        lines.extend(
            [
                "",
                "Indica numero y motivo u horas, o responde NO.",
                "SALIR para terminar listado.",
            ]
        )
        return "\n".join(lines)

    def _load_asistencia_nomina(self, state: ParteDiarioV3State) -> list[Nomina]:
        if not state.proyecto_id:
            return []
        with Session(engine) as session:
            return list(
                session.exec(
                    select(Nomina)
                    .where(Nomina.idproyecto == int(state.proyecto_id))
                    .where(Nomina.activo.is_(True))
                    .where(Nomina.deleted_at.is_(None))
                    .order_by(Nomina.apellido.asc(), Nomina.nombre.asc())
                ).all()
            )

    async def _parse_asistencia_entries(
        self,
        text: str,
        options: list[ParteDiarioAsistenciaOption],
        estados,
        *,
        state: ParteDiarioV3State | None = None,
    ):
        normalized_text = re.sub(r"\s+y\s+(?=\d+\b)", "\n", text or "", flags=re.IGNORECASE)
        parts = [part.strip() for part in re.split(r"[,;\n]+", normalized_text) if part.strip()]
        if not parts:
            return [], "No pude interpretar la respuesta. Indica numero y motivo, por ejemplo: 2 enfermedad."

        parsed = []
        options_by_number = {option.opcion: option for option in options}
        for part in parts:
            match = re.match(r"^\s*(\d+)(?:[\).\:\-\s]+(.+?)\s*)?$", part)
            if not match:
                return [], "No pude identificar el numero de empleado. Indica numero y motivo, por ejemplo: 2 enfermedad."
            number = int(match.group(1))
            motive = (match.group(2) or "falta").strip()
            option = options_by_number.get(number)
            if option is None:
                available = ", ".join(str(item.opcion) for item in options)
                return [], f"El numero {number} no esta en esta pagina. Opciones disponibles: {available}."
            estado, horas = await self._resolve_asistencia_detail(motive, estados)
            nombre_proyecto = None
            idproyecto_destino = None
            external_project_text = _extract_external_work_project_text(motive)
            if external_project_text:
                estado = self._present_estado(estados)
                if estado is None:
                    return [], "No encontre el estado PRESENTE para cargar trabajo en otra obra."
                hours = _parse_hours_from_text(motive, require_unit=True)
                horas = hours if hours is not None else 9.0
                if state is not None:
                    idproyecto_destino, nombre_proyecto, project_error = self._resolve_asistencia_external_project(
                        state,
                        external_project_text,
                    )
                    if project_error:
                        return [], project_error
                else:
                    nombre_proyecto = external_project_text
                    idproyecto_destino = None
            if estado is None:
                return [], f"No pude identificar '{motive}'. Proba con falta, enfermedad, accidente, presente o trabajo 8hs."
            parsed.append((option, estado, motive, horas, nombre_proyecto, idproyecto_destino))
        return parsed, None

    async def _resolve_asistencia_detail(self, text: str, estados):
        estado = await self._resolve_estado_for_motive(text, estados)
        if estado is None:
            return None, None
        normalized_code = str(estado.abreviatura or "").upper()
        if normalized_code != "P":
            return estado, 0.0
        hours = _parse_hours_from_text(text)
        return estado, hours if hours is not None else 9.0

    @staticmethod
    def _present_estado(estados):
        return next((item for item in estados if str(item.abreviatura or "").upper() == "P"), None)

    def _resolve_asistencia_external_project(
        self,
        state: ParteDiarioV3State,
        project_text: str,
    ) -> tuple[int | None, str | None, str | None]:
        current_project_id = int(state.proyecto_id or 0)
        if not current_project_id:
            return None, None, "No pude resolver la obra destino porque el parte no tiene obra activa."
        with Session(engine) as session:
            projects = list(
                session.exec(
                    select(Proyecto)
                    .where(Proyecto.deleted_at.is_(None))
                    .where(Proyecto.id != current_project_id)
                    .order_by(Proyecto.nombre.asc())
                ).all()
            )
        scored = [
            (project_match_score(project_text, project.nombre), project)
            for project in projects
        ]
        matches = [(score, project) for score, project in scored if score >= 0.55]
        matches.sort(key=lambda pair: (-pair[0], str(pair[1].nombre or "")))
        if not matches:
            return None, None, f"No encontre la obra destino '{project_text}'. Indica el nombre de la obra."
        best_score, best_project = matches[0]
        close = [project for score, project in matches if best_score - score <= 0.05]
        if len(close) > 1:
            names = ", ".join(str(project.nombre) for project in close[:3])
            return None, None, f"La obra destino '{project_text}' es ambigua. Opciones: {names}."
        return int(best_project.id), str(best_project.nombre or "").strip(), None

    async def _resolve_estado_for_motive(self, text: str, estados):
        estado = parse_estado_local(text, estados) or self._resolve_estado_from_text(text, estados)
        if estado is not None:
            return estado
        try:
            code = await self._llm.interpretar_estado_pendiente(text, estados)
        except Exception:
            logger.exception("No se pudo interpretar estado de novedad con LLM")
            return None
        normalized_code = str(code or "").strip().upper()
        if normalized_code == "NO_DETERMINADO":
            return None
        return next((item for item in estados if item.abreviatura.upper() == normalized_code), None)

    @staticmethod
    def _resolve_estado_from_text(text: str, estados):
        normalized = normalize_text(text)
        for estado in estados:
            code = normalize_text(estado.abreviatura)
            name = normalize_text(estado.nombre)
            if code and code in normalized.split():
                return estado
            if name and (name in normalized or normalized in name):
                return estado
        return None

    def _confirm_asistencia_reemplazo(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        pending = dict(state.asistencia_reemplazo_pendiente or {})
        option = ParteDiarioAsistenciaOption.from_dict(dict(pending.get("option") or {}))
        estado_id = pending.get("estado_id")
        estado_codigo = str(pending.get("estado_codigo") or "").strip().upper()
        motivo = str(pending.get("motivo") or "").strip()
        horas = pending.get("horas")
        fuera_de_proyecto = bool(pending.get("fuera_de_proyecto"))
        nombre_proyecto = str(pending.get("nombre_proyecto") or "").strip() or None
        idproyecto_destino = pending.get("idproyecto_destino")
        if option is None or not estado_id or not estado_codigo or not motivo:
            state.asistencia_reemplazo_pendiente = {}
            reply = f"No pude recuperar el reemplazo pendiente.\n\n{self._asistencia_current_page_text(state)}"
            return self._active_result(context, state, reply, "asistencia_replace_lost")

        draft = state.draft()
        self._apply_asistencia_novedad(
            draft,
            state,
            option=option,
            estado_id=int(estado_id),
            estado_codigo=estado_codigo,
            motivo=motivo,
            horas=float(horas) if horas is not None else 0.0,
            fuera_de_proyecto=fuera_de_proyecto,
            nombre_proyecto=nombre_proyecto,
            idproyecto_destino=int(idproyecto_destino) if idproyecto_destino else None,
        )
        draft.sin_novedades_informado = False
        draft.esperando = None
        state.set_draft(draft)
        state.asistencia_reemplazo_pendiente = {}
        return self._advance_asistencia_page(context, state, prefix="Reemplazado.")

    def _asistencia_reemplazo_text(self, state: ParteDiarioV3State) -> str:
        pending = dict(state.asistencia_reemplazo_pendiente or {})
        option = ParteDiarioAsistenciaOption.from_dict(dict(pending.get("option") or {}))
        nombre = option.nombre_completo if option else "La persona seleccionada"
        anterior = str(pending.get("estado_anterior") or "estado previo").upper()
        nuevo = str(pending.get("estado_codigo") or "nuevo estado").upper()
        return f"{nombre} ya tiene {anterior}. Queres reemplazarla por {nuevo}?\n\nOpciones: OK / VOLVER."

    def _apply_asistencia_novedad(
        self,
        draft,
        state: ParteDiarioV3State,
        *,
        option: ParteDiarioAsistenciaOption,
        estado_id: int,
        estado_codigo: str,
        motivo: str,
        horas: float,
        fuera_de_proyecto: bool = False,
        nombre_proyecto: str | None = None,
        idproyecto_destino: int | None = None,
    ) -> None:
        nombre = option.nombre_completo
        novedad = NovedadPersonal(
            nombre=nombre,
            idnomina=option.idnomina,
            idestado=estado_id,
            estado_codigo=estado_codigo,
            horas=horas,
            descripcion=motivo,
            fuera_de_proyecto=fuera_de_proyecto,
            nombre_proyecto=nombre_proyecto,
            idproyecto_destino=idproyecto_destino,
            nro_legajo=option.nro_legajo,
        )
        existing = self._find_asistencia_existing(draft, option.idnomina)
        if existing is None:
            draft.novedades.append(novedad)
        else:
            existing.nombre = novedad.nombre
            existing.idestado = novedad.idestado
            existing.estado_codigo = novedad.estado_codigo
            existing.horas = novedad.horas
            existing.descripcion = novedad.descripcion
            existing.fuera_de_proyecto = novedad.fuera_de_proyecto
            existing.nombre_proyecto = novedad.nombre_proyecto
            existing.idproyecto_destino = novedad.idproyecto_destino
            existing.nro_legajo = novedad.nro_legajo
        state.asistencia_registros.append(
            ParteDiarioAsistenciaRegistro(
                nombre=nombre,
                estado_codigo=estado_codigo,
                motivo=motivo,
                horas=horas,
            )
        )

    @staticmethod
    def _find_asistencia_existing(draft, idnomina: int):
        return next((item for item in draft.novedades if item.idnomina == idnomina), None)

    async def _handle_parte_diario(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        forced_text: str | None = None,
        extra_result_metadata: dict | None = None,
    ) -> V3ProcessResult:
        if not state.contacto_id or not state.oportunidad_id or not state.proyecto_id:
            return self._closed_result(
                context,
                "No encontre una obra asociada para cargar el parte diario.",
                "obra_not_found",
            )

        if state.etapa == "carga" and forced_text is None:
            command = _normalize_command(message.text)
            draft = state.draft()

            if command in {"listado"}:
                return self._start_asistencia(context, state)

            contextual_query = await self._handle_active_contextual_query(message, context, state)
            if contextual_query is not None:
                return contextual_query

            if _is_finish_loading_command(command):
                if _is_empty_draft(draft):
                    draft.sin_novedades_informado = True
                    state.set_draft(draft)
                if _draft_date_before_today(draft):
                    state.etapa = "cierre"
                    return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")
                if _draft_date_is_today(draft):
                    return await self._guardar_borrador(message, context, state)
                state.etapa = "revision"
                reply = _review_reply(state.draft(), obra=state.nombre_obra)
                return self._active_result(
                    context,
                    state,
                    reply,
                    "review_required",
                    _review_metadata(reply),
                )

            if command in {"guardar", "guardar borrador"}:
                return await self._guardar_borrador(message, context, state)

            if command in {"cerrar", "finalizar", "finalizar parte"}:
                if _is_empty_draft(draft):
                    draft.esperando = "confirmacion_sin_novedades"
                    state.set_draft(draft)
                    state.etapa = "cierre"
                    reply = _sin_novedades_confirmacion()
                    return self._active_result(
                        context,
                        state,
                        reply,
                        "empty_close_confirmation",
                        _confirmation_metadata(reply),
                    )
                return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")

            if command in {"salir"}:
                state.etapa = "confirmar_salida"
                return self._active_result(
                    context,
                    state,
                    _salida_confirmacion(),
                    "exit_confirmation",
                    _confirmation_metadata(_salida_confirmacion()),
                )

            if command in {"volver"}:
                state.etapa = "carga"
                reply = _volver_carga_reply(draft, obra=state.nombre_obra)
                return self._active_result(
                    context,
                    state,
                    reply,
                    "back_to_load",
                )

        started = time.perf_counter()
        with Session(engine) as session:
            mapped_text = forced_text or _map_menu_text(message.text or "", state)
            process_context = SimpleNamespace(
                oportunidad_id=state.oportunidad_id,
                contacto_id=state.contacto_id,
                is_project=True,
                active_process=self.name,
                process_state=state.parte_state,
                message=SimpleNamespace(contenido=mapped_text),
            )
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, state.etapa))
            process_result = await process.handle(process_context)
            if _should_validate_incrementally(state, process_result):
                incremental_state = dict(process_result.process_state or {})
                incremental_state["validacion_origen"] = "carga"
                process_context.process_state = incremental_state
                process_context.message = SimpleNamespace(contenido="CERRAR")
                process_result = await process.handle(process_context)
            payload = dict(process_result.payload or {})
            if state.contacto_id:
                payload["contacto_id"] = int(state.contacto_id)
            if extra_result_metadata:
                payload.update(extra_result_metadata)

            if payload.get("parte_listo"):
                try:
                    parte = parte_diario_service.create_or_update_from_agent_v3_confirmation(
                        session,
                        contacto_id=int(state.contacto_id),
                        oportunidad_id=int(state.oportunidad_id),
                        result=payload,
                        conversation_id=context.conversation_id,
                        provider=message.provider,
                        channel_type=message.channel_type,
                        account_ref=message.account_ref,
                        from_address=message.from_address,
                        to_address=message.to_address,
                        external_message_id=message.external_message_id,
                        text=message.text,
                        message_type=message.message_type,
                        raw_payload=message.raw_payload,
                        normalized_payload=message.normalized_payload,
                        received_at=message.received_at,
                    )
                except Exception as exc:
                    logger.exception("Error creando parte diario confirmado desde agente v3")
                    error_reply = _persistence_debug_message(
                        exc,
                        stage="confirmar_cierre",
                        draft=state.draft(),
                        state=state,
                        context=context,
                        message=message,
                        payload=payload,
                    )
                    return self._active_result(
                        context,
                        state,
                        error_reply,
                        "persistence_error",
                    )

                payload["parte_diario_id"] = parte.id
                logger.info(
                    "v3_parte_diario_persist_timing external_message_id=%s parte_diario_id=%s persist_total_ms=%s",
                    message.external_message_id,
                    parte.id,
                    round((time.perf_counter() - started) * 1000, 3),
                )
                return await self._post_action_result(
                    context,
                    state,
                    payload.get("reply_to_user") or f"Parte diario confirmado #{parte.id}.",
                    "confirmed",
                    {
                        "process_name": self.name,
                        "parte_listo": True,
                        "parte_diario_id": parte.id,
                        "mensaje_origen_id": parte.mensaje_origen_id,
                        "result": payload,
                        **(extra_result_metadata or {}),
                    },
                )

        if (process_result.keep_active or _should_keep_active_after_readonly(state, payload)) and not payload.get("cancelado"):
            state.parte_state = dict(process_result.process_state or {})
            status = _status_from_payload(payload)
            if status in {"sin_novedades", "confirmation_required"}:
                draft = state.draft()
                if _draft_date_before_today(draft):
                    state.etapa = "cierre"
                    return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")
                if _draft_date_is_today(draft):
                    return await self._guardar_borrador(message, context, state)
            reply = _format_reply(payload.get("reply_to_user") or "", state, payload)
            return self._active_result(
                context,
                state,
                reply,
                status,
                _merge_metadata(
                    {"result": payload},
                    extra_result_metadata,
                    _reply_interactive_metadata(state, reply),
                ),
            )

        updated = context.copy()
        updated.active_process = None
        updated.process_state = {}
        return V3ProcessResult(
            context=updated,
            reply_text=payload.get("reply_to_user") or "",
            metadata={
                "process_name": self.name,
                "status": _status_from_payload(payload),
                "result": payload,
                **(extra_result_metadata or {}),
            },
        )

    async def _post_action_result(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        reply: str,
        status: str,
        extra_metadata: dict | None = None,
    ) -> V3ProcessResult:
        state.opciones_fecha = []
        state.fecha_menu_pendiente = False
        state.parte_state = {}
        metadata = {"process_name": self.name, "status": status}
        if extra_metadata:
            metadata.update(extra_metadata)
            metadata["status"] = status
        if status in {"confirmed", "saved"}:
            result = (extra_metadata or {}).get("result") or {}
            result_fecha = str(result.get("fecha") or "").strip() or None
            specific_close = bool(
                status == "confirmed"
                and state.fecha_referida_explicita
                and result_fecha
                and result_fecha == state.fecha_objetivo
            )
            today_save = bool(status == "saved" and _parse_iso_date(result_fecha) == _today())
            if specific_close:
                state.fecha_objetivo = None
                state.fecha_referida_explicita = False
                return self._finish_or_prompt_pending_parts(
                    context,
                    state,
                    reply,
                    metadata,
                    exclude_fechas={result_fecha} if result_fecha else None,
                )
            auto_today = await self._auto_open_today_after_previous_close(
                context,
                state,
                reply,
                status,
                metadata,
                additional_messages=[],
            )
            if auto_today is not None:
                return auto_today
            saved_fecha = None
            if status == "saved":
                saved_fecha = str(result.get("fecha") or "").strip() or None
                if today_save:
                    return self._finish_or_prompt_pending_parts(
                        context,
                        state,
                        reply,
                        metadata,
                        exclude_fechas={saved_fecha} if saved_fecha else None,
                    )
            state.etapa = "continuar"
            if state.proyecto_id:
                state.nombre_obra = state.nombre_obra or self._resolve_project_name(int(state.proyecto_id))
                state.opciones_fecha = self._build_fecha_options(
                    int(state.proyecto_id),
                    contacto_id=state.contacto_id,
                )
            next_fecha, pending_count = resolver_fecha_default_parte_diario_info(
                int(state.proyecto_id or 0),
                contacto_id=state.contacto_id,
                exclude_fechas={saved_fecha} if saved_fecha else None,
            )
            if not next_fecha:
                return V3ProcessResult(
                    context=_finish_parte_diario_context(context),
                    reply_text=reply,
                    metadata=metadata,
                )
            draft = state.draft()
            draft.fecha_propuesta = next_fecha
            state.set_draft(draft)
            continue_reply = _continue_proposal_reply(next_fecha)
            return self._active_result(
                context,
                state,
                reply,
                status,
                {
                    **metadata,
                    "next_fecha": next_fecha,
                    "pending_count": pending_count,
                },
                additional_messages=[V3ProcessMessage(text=continue_reply)],
            )
        return self._show_date_menu(
            context,
            state,
            prefix=reply,
            status=status,
            extra_metadata=metadata,
        )

    def _finish_or_prompt_pending_parts(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        reply: str,
        metadata: dict,
        *,
        exclude_fechas: set[str | None] | None = None,
    ) -> V3ProcessResult:
        pending_options = _pending_parts_last_days_options(state, exclude_fechas=exclude_fechas)
        if not pending_options:
            return V3ProcessResult(
                context=_finish_parte_diario_context(context),
                reply_text=reply,
                metadata=metadata,
            )

        state.etapa = "pendientes"
        state.parte_state = {}
        state.opciones_fecha = pending_options
        state.fecha_menu_pendiente = False
        state.fecha_objetivo = None
        state.fecha_referida_explicita = False
        prompt = _pending_parts_prompt(pending_options)
        return self._active_result(
            context,
            state,
            f"{reply}\n\n{prompt}",
            "pending_parts_selection",
            {
                **metadata,
                "pending_count": len(pending_options),
                **(_pending_parts_metadata(pending_options) or {}),
            },
        )

    def _show_pending_parts_selection(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        prefix: str | None = None,
    ) -> V3ProcessResult:
        pending_options = _pending_parts_last_days_options(state)
        state.modo_pendientes = False
        if not pending_options:
            reply = "No quedan partes pendientes de los ultimos 10 dias."
            if prefix:
                reply = f"{prefix.strip()}\n\n{reply}"
            return V3ProcessResult(
                context=_finish_parte_diario_context(context),
                reply_text=reply,
                metadata={"process_name": self.name, "status": "no_pending_parts"},
            )

        state.etapa = "pendientes"
        state.parte_state = {}
        state.opciones_fecha = pending_options
        state.fecha_menu_pendiente = False
        state.fecha_objetivo = None
        state.fecha_referida_explicita = False
        reply = _pending_parts_prompt(pending_options, prefix=prefix)
        return self._active_result(
            context,
            state,
            reply,
            "pending_parts_selection",
            {
                "pending_count": len(pending_options),
                **(_pending_parts_metadata(pending_options) or {}),
            },
        )

    async def _auto_open_today_after_previous_close(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        reply: str,
        status: str,
        metadata: dict,
        additional_messages: list[V3ProcessMessage] | None = None,
    ) -> V3ProcessResult | None:
        if status != "confirmed":
            return None
        result = metadata.get("result")
        if not isinstance(result, dict) or not result.get("cerrar_parte"):
            return None
        closed_fecha = _parse_iso_date(result.get("fecha"))
        target_date = _parse_iso_date(state.fecha_objetivo) or _today()
        if closed_fecha is None or closed_fecha >= target_date:
            return None
        draft = state.draft()
        draft.fecha = target_date.isoformat()
        draft.fecha_propuesta = None
        draft.parte_id = None
        draft.novedades = []
        draft.pendientes_ambiguos = []
        draft.conflictos_novedad = []
        draft.sin_novedades_informado = False
        draft.esperando = None
        draft.validacion_origen = None
        draft.retomado = False
        state.set_draft(draft)
        state.opciones_fecha = []
        state.etapa = "seleccionar_fecha"
        prepared = await self._preparar_fecha(context, state, reply_on_success=False)
        if prepared is not None:
            return prepared
        prefix = (
            f"Ahora seguimos con el parte de hoy, {_fecha_humana(target_date)}."
            if target_date == _today()
            else f"Ahora seguimos con el parte del {_fecha_humana(target_date)}."
        )
        load_reply = _load_start_reply(state.draft(), _draft_status(state.draft()), obra=state.nombre_obra, prefix=prefix)
        return self._active_result(
            context,
            state,
            reply,
            status,
            metadata,
            additional_messages=[
                *(additional_messages or []),
                V3ProcessMessage(text=load_reply),
            ],
        )

    def _active_result(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        reply: str,
        status: str,
        extra_metadata: dict | None = None,
        additional_messages: list[V3ProcessMessage] | None = None,
    ) -> V3ProcessResult:
        updated = context.copy()
        updated.active_process = self.name
        updated.process_state = state.to_dict()
        metadata = {"process_name": self.name, "status": status, "etapa": state.etapa}
        if extra_metadata:
            metadata.update(extra_metadata)
        return V3ProcessResult(
            context=updated,
            reply_text=reply,
            metadata=metadata,
            additional_messages=additional_messages or [],
        )

    def _closed_result(self, context: V3ConversationContext, reply: str, status: str) -> V3ProcessResult:
        updated = context.copy()
        updated.active_process = None
        updated.process_state = {}
        return V3ProcessResult(
            context=updated,
            reply_text=reply,
            metadata={"process_name": self.name, "status": status},
        )

    @staticmethod
    def _resolve_obra_options(phone: str) -> list[ParteDiarioOption]:
        started = time.perf_counter()
        normalized_phone = _normalize_phone(phone)
        if not normalized_phone:
            logger.info("v3_parte_diario_resolve_obra_timing phone_empty=true total_ms=%s", 0)
            return []
        with Session(engine) as session:
            contacts = session.exec(select(CRMContacto)).all()
            matched_contacts = [
                contact
                for contact in contacts
                if any(_normalize_phone(value) == normalized_phone for value in (contact.telefonos or []))
            ]
            options: list[ParteDiarioOption] = []
            for contact in matched_contacts:
                added_project_ids: set[int] = set()

                def add_project_option(proyecto: Proyecto | None, *, oportunidad_id: int | None = None, nombre: str | None = None) -> None:
                    if (
                        proyecto is None
                        or proyecto.id is None
                        or proyecto.deleted_at is not None
                        or contact.id is None
                    ):
                        return
                    resolved_oportunidad_id = oportunidad_id or proyecto.oportunidad_id
                    if resolved_oportunidad_id is None:
                        return
                    proyecto_id = int(proyecto.id)
                    if proyecto_id in added_project_ids:
                        return
                    added_project_ids.add(proyecto_id)
                    options.append(
                        ParteDiarioOption(
                            opcion=len(options) + 1,
                            nombre=nombre or proyecto.nombre or f"Obra {proyecto.id}",
                            contacto_id=int(contact.id),
                            oportunidad_id=int(resolved_oportunidad_id),
                            proyecto_id=proyecto_id,
                        )
                    )

                asignaciones = session.exec(
                    select(ProyectoEncargado)
                    .where(ProyectoEncargado.contacto_id == contact.id)
                    .where(ProyectoEncargado.activo.is_(True))
                    .where(ProyectoEncargado.deleted_at.is_(None))
                ).all()
                for asignacion in asignaciones:
                    proyecto = session.get(Proyecto, asignacion.proyecto_id)
                    add_project_option(proyecto)

                nomina_project_ids = session.exec(
                    select(Nomina.idproyecto)
                    .where(Nomina.encargado_contacto_id == contact.id)
                    .where(Nomina.activo.is_(True))
                    .where(Nomina.deleted_at.is_(None))
                    .where(Nomina.idproyecto.is_not(None))
                    .distinct()
                ).all()
                for proyecto_id in nomina_project_ids:
                    add_project_option(session.get(Proyecto, proyecto_id))

                if added_project_ids:
                    continue

                oportunidades = session.exec(
                    select(CRMOportunidad).where(CRMOportunidad.contacto_id == contact.id)
                ).all()
                for oportunidad in oportunidades:
                    proyecto = session.exec(
                        select(Proyecto).where(Proyecto.oportunidad_id == oportunidad.id).limit(1)
                    ).first()
                    add_project_option(
                        proyecto,
                        oportunidad_id=int(oportunidad.id) if oportunidad.id is not None else None,
                        nombre=(
                            proyecto.nombre
                            if proyecto is not None and proyecto.nombre
                            else oportunidad.titulo or f"Obra {proyecto.id}" if proyecto is not None else None
                        ),
                    )
            logger.info(
                "v3_parte_diario_resolve_obra_timing phone=%s contacts=%s matched_contacts=%s options=%s total_ms=%s",
                normalized_phone,
                len(contacts),
                len(matched_contacts),
                len(options),
                round((time.perf_counter() - started) * 1000, 3),
            )
            return options

    @staticmethod
    def _build_fecha_options(
        proyecto_id: int,
        *,
        contacto_id: int | None = None,
        today: date | None = None,
        days: int = 7,
    ) -> list[ParteDiarioFechaOption]:
        today = today or _today()
        dates = [today - timedelta(days=offset) for offset in range(days)]
        dates = [target_date for target_date in dates if es_dia_laborable(target_date)]
        with Session(engine) as session:
            base_query = (
                select(ParteDiario)
                .where(ParteDiario.idproyecto == proyecto_id)
                .where(ParteDiario.fecha.in_(dates))
                .where(ParteDiario.deleted_at.is_(None))
            )
            partes = (
                session.exec(base_query.where(ParteDiario.contacto_id == contacto_id)).all()
                if contacto_id
                else session.exec(base_query).all()
            )
            if contacto_id and not partes:
                partes = session.exec(base_query.where(ParteDiario.contacto_id.is_(None))).all()
        by_date = {parte.fecha: parte for parte in partes}
        options: list[ParteDiarioFechaOption] = []
        for index, target_date in enumerate(dates, start=1):
            parte = by_date.get(target_date)
            if parte is None:
                status = "sin cargar"
                parte_id = None
            elif parte.estado == EstadoParteDiario.CONFIRMADO:
                status = "confirmado"
                parte_id = parte.id
            elif parte.estado == EstadoParteDiario.CERRADO:
                status = "cerrado"
                parte_id = parte.id
            else:
                status = "borrador"
                parte_id = parte.id
            options.append(
                ParteDiarioFechaOption(
                    opcion=index,
                    fecha=target_date.isoformat(),
                    estado=status,
                    parte_id=parte_id,
                )
            )
        return options


def resolver_fecha_default_parte_diario(
    proyecto_id: int,
    *,
    contacto_id: int | None = None,
) -> str | None:
    fecha, _pending_count = resolver_fecha_default_parte_diario_info(
        proyecto_id,
        contacto_id=contacto_id,
    )
    return fecha


def resolver_fecha_default_parte_diario_info(
    proyecto_id: int,
    *,
    contacto_id: int | None = None,
    exclude_fechas: set[str | None] | None = None,
    today: date | None = None,
) -> tuple[str | None, int]:
    if proyecto_id <= 0:
        return None, 0

    excluded = {str(item) for item in (exclude_fechas or set()) if item}
    today = today or _today()
    previous_operational_day = dia_operativo_anterior(today)
    options = ParteDiarioSubprocess._build_fecha_options(proyecto_id, contacto_id=contacto_id, today=today)
    pending_options = [
        option
        for option in options
        if option.estado in {"borrador", "sin cargar"} and option.fecha not in excluded
    ]
    if not pending_options:
        return None, 0
    by_fecha = {option.fecha: option for option in pending_options}
    selected = by_fecha.get(previous_operational_day.isoformat()) or by_fecha.get(today.isoformat())
    return (selected.fecha if selected else None), len(pending_options)


def _pending_parts_last_days_messages(
    state: ParteDiarioV3State,
    *,
    exclude_fechas: set[str | None] | None = None,
    days: int = 10,
) -> list[V3ProcessMessage]:
    pending_options = _pending_parts_last_days_options(state, exclude_fechas=exclude_fechas, days=days)
    if not pending_options:
        return [V3ProcessMessage(text="No quedan partes pendientes de los ultimos 10 dias.")]
    return [V3ProcessMessage(text=_pending_parts_prompt(pending_options, include_question=False))]


def _pending_parts_last_days_options(
    state: ParteDiarioV3State,
    *,
    exclude_fechas: set[str | None] | None = None,
    days: int = 10,
) -> list[ParteDiarioFechaOption]:
    if not state.proyecto_id:
        return []
    excluded = {str(item) for item in (exclude_fechas or set()) if item}
    try:
        options = ParteDiarioSubprocess._build_fecha_options(
            int(state.proyecto_id),
            contacto_id=state.contacto_id,
            days=days,
        )
    except Exception:
        logger.exception("Error consultando partes pendientes")
        return []
    pending_options = sorted(
        (
            option
            for option in options
            if option.estado in {"borrador", "sin cargar"}
            and option.fecha not in excluded
            and not fecha_es_feriado(option.fecha)
        ),
        key=lambda item: item.fecha,
    )
    return [
        ParteDiarioFechaOption(
            opcion=index,
            fecha=option.fecha,
            estado=option.estado,
            parte_id=option.parte_id,
        )
        for index, option in enumerate(pending_options, start=1)
    ]


def _pending_parts_prompt(
    pending_options: list[ParteDiarioFechaOption],
    *,
    prefix: str | None = None,
    include_question: bool = True,
) -> str:
    lines = []
    if prefix:
        lines.append(prefix)
        lines.append("")
    if include_question:
        title = (
            "Te queda 1 parte pendiente de los ultimos 10 dias."
            if len(pending_options) == 1
            else f"Te quedan {len(pending_options)} partes pendientes de los ultimos 10 dias."
        )
        lines.append(title)
        lines.append("Cual queres cargar? Responde con el dia, fecha, numero o SALIR.")
        lines.extend(f"{option.opcion}: {_fecha_humana(option.fecha)}" for option in pending_options)
    else:
        fechas = ", ".join(_fecha_humana(option.fecha) for option in pending_options)
        title = (
            "Te queda pendiente este parte de los ultimos 10 dias: "
            if len(pending_options) == 1
            else "Te quedan pendientes estos partes de los ultimos 10 dias: "
        )
        lines.append(f"{title}{fechas}.")
    return "\n".join(lines)


def _pending_parts_metadata(pending_options: list[ParteDiarioFechaOption]) -> dict | None:
    if not pending_options:
        return None
    return {"pending_options": [option.to_dict() for option in pending_options]}


def _select_pending_option(text: str | None, pending_options: list[ParteDiarioFechaOption]) -> ParteDiarioFechaOption | None:
    command = _normalize_command(text)
    try:
        selected_number = int(command)
    except ValueError:
        selected_number = None
    if selected_number is not None:
        option = next((item for item in pending_options if item.opcion == selected_number), None)
        if option is not None:
            return option

    selected_fecha = _parse_fecha_value(text)
    if selected_fecha:
        option = next((item for item in pending_options if item.fecha == selected_fecha), None)
        if option is not None:
            return option

    weekday = _weekday_only_reference(text)
    if weekday is not None:
        matches = [
            option
            for option in pending_options
            if (_parse_iso_date(option.fecha) is not None and _parse_iso_date(option.fecha).weekday() == weekday)
        ]
        if matches:
            return sorted(matches, key=lambda item: item.fecha)[0]
    return None


async def _emitir_fecha_default_parte_diario(
    emisor: V3MessageEmitter | None,
    state: ParteDiarioV3State,
    fecha: str,
    pending_count: int,
    *,
    today: date | None = None,
) -> None:
    if emisor is None:
        return
    try:
        target_date = date.fromisoformat(fecha)
    except ValueError:
        return

    fecha_label = _fecha_humana(target_date)
    encargado = _resolve_contact_greeting_name(state.contacto_id)
    saludo = f"Hola {encargado}, " if encargado else "Hola, "
    today = today or _today()
    if target_date == dia_operativo_anterior(today):
        apertura = f"quedo pendiente el parte del {fecha_label}. Vamos a cargarlo."
    elif target_date == today:
        apertura = f"vamos a cargar el parte de hoy, {fecha_label}."
    else:
        apertura = f"quedo pendiente el parte del {fecha_label}. Vamos a cargarlo."

    await emisor.emitir(
        f"{saludo}{apertura}",
        metadata={
            "process_name": "parteDiario",
            "status": "default_fecha_selected",
            "fecha": fecha,
            "pending_count": pending_count,
            "remaining_pending_count": max(pending_count - 1, 0),
        },
    )


def _resolve_contact_greeting_name(contacto_id: int | None) -> str | None:
    if not contacto_id:
        return None
    with Session(engine) as session:
        contact = session.get(CRMContacto, int(contacto_id))
    raw_name = str(getattr(contact, "nombre_completo", "") or "").strip()
    if not raw_name:
        return None
    return raw_name.split()[0]


def _seleccionar_obra(state: ParteDiarioV3State) -> str:
    options = "\n".join(f"{option.opcion}: {option.nombre}" for option in state.opciones_obra)
    return f"En que obra queres cargar el parte diario?\n{options}"


def _select_obra_option_from_text(
    text: str | None,
    options: list[ParteDiarioOption],
) -> ParteDiarioOption | None:
    query = _obra_selection_query(text)
    if not query or not options:
        return None
    scored = [
        (project_match_score(query, option.nombre), option)
        for option in options
    ]
    strong = [(score, option) for score, option in scored if score >= 0.75]
    if len(strong) != 1:
        return None
    return strong[0][1]


def _obra_selection_query(text: str | None) -> str:
    tokens = [
        token
        for token in normalize_text(text).split()
        if token
        not in {
            "parte",
            "partes",
            "diario",
            "diarios",
            "cargar",
            "carga",
            "cargo",
            "obra",
            "obras",
            "pendiente",
            "pendientes",
            "de",
            "del",
            "la",
            "el",
            "en",
            "para",
            "por",
            "quiero",
            "necesito",
        }
    ]
    return " ".join(tokens)


def _render_fecha_menu(
    options: list[ParteDiarioFechaOption],
    *,
    prefix: str | None = None,
    obra: str | None = None,
) -> str:
    lines = [_fecha_menu_title(obra)]
    if prefix:
        lines.insert(0, prefix)
    lines.extend(_format_fecha_option(option) for option in options)
    lines.append("Responde con el numero de una fecha o SALIR para volver al menu general.")
    return "\n".join(lines)


def _format_fecha_option(option: ParteDiarioFechaOption) -> str:
    target_date = date.fromisoformat(option.fecha)
    return f"{option.opcion}: {_fecha_humana(target_date)} ({_estado_parte_visible(option.estado)})"


def _date_menu_metadata(
    options: list[ParteDiarioFechaOption],
    *,
    prefix: str | None = None,
    obra: str | None = None,
) -> dict | None:
    body = _fecha_menu_title(obra)
    if prefix:
        body = f"{prefix}\n\n{body}"
    interactive = whatsapp_list(
        body=body,
        button="Ver fechas",
        section_title="Fechas",
        rows=[
            InteractiveListRow(
                id=option.fecha,
                title=_fecha_option_title(option),
                description=_estado_parte_visible(option.estado),
            )
            for option in options
        ],
    )
    return _interactive_metadata(interactive)


def _continue_proposal_reply(fecha: str) -> str:
    try:
        target_date = date.fromisoformat(fecha)
        fecha_label = _fecha_humana(target_date)
    except ValueError:
        fecha_label = fecha
    return f"Hay otro parte pendiente: {fecha_label}.\nQueres cargarlo ahora? Responde SI o NO."


def _fecha_menu_title(obra: str | None = None) -> str:
    obra_label = str(obra or "").strip()
    if obra_label:
        return f"Selecciona la fecha del parte diario:\nObra: {obra_label}"
    return "Selecciona la fecha del parte diario:"


def _fecha_option_title(option: ParteDiarioFechaOption) -> str:
    target_date = date.fromisoformat(option.fecha)
    return _fecha_humana(target_date)


def _weekday_label(value: date) -> str:
    return ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"][value.weekday()]


def _weekday_name_by_index(value: int | None) -> str:
    labels = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    if value is None or value < 0 or value >= len(labels):
        return "ese dia"
    return labels[value]


def _weekday_only_reference(text: str | None) -> int | None:
    command = _normalize_command(text)
    if not command:
        return None
    if re.search(r"\b\d{1,2}\s*(?:/|-)\s*\d{1,2}(?:\s*(?:/|-)\s*\d{2,4})?\b", command):
        return None
    month_names = {
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "setiembre",
        "octubre",
        "noviembre",
        "diciembre",
    }
    tokens = set(command.split())
    if tokens & month_names:
        return None
    if tokens & {"hoy", "ayer", "anteayer", "manana"}:
        return None
    weekdays = {
        "lunes": 0,
        "martes": 1,
        "miercoles": 2,
        "jueves": 3,
        "viernes": 4,
        "sabado": 5,
        "domingo": 6,
    }
    matches = [index for name, index in weekdays.items() if name in tokens]
    if len(matches) != 1:
        return None
    allowed = {
        "abrir",
        "cargar",
        "de",
        "del",
        "diario",
        "el",
        "hacer",
        "la",
        "necesito",
        "para",
        "parte",
        "partes",
        "quiero",
        "ver",
    }
    weekday_tokens = set(weekdays)
    if tokens - allowed - weekday_tokens:
        return None
    return matches[0]


def _resolve_pending_weekday_option(
    proyecto_id: int,
    weekday: int,
    *,
    contacto_id: int | None = None,
) -> tuple[ParteDiarioFechaOption | None, bool]:
    if proyecto_id <= 0:
        return None, False
    options = ParteDiarioSubprocess._build_fecha_options(
        proyecto_id,
        contacto_id=contacto_id,
        days=10,
    )
    matching = [
        option
        for option in options
        if (_parse_iso_date(option.fecha) is not None and _parse_iso_date(option.fecha).weekday() == weekday)
    ]
    pending = sorted(
        (option for option in matching if option.estado in {"borrador", "sin cargar"}),
        key=lambda item: item.fecha,
    )
    if pending:
        return pending[0], bool(matching)
    return None, bool(matching)


def _fecha_humana(value: date | str | None) -> str:
    if isinstance(value, date):
        target_date = value
    else:
        try:
            target_date = date.fromisoformat(str(value or "").strip())
        except ValueError:
            return str(value or "").strip()
    return f"{_weekday_label(target_date)} {target_date.strftime('%d/%m/%Y')}"


def _fecha_referencia_humana(value: date | str | None) -> str:
    target_date = _parse_iso_date(value)
    if target_date is None:
        return str(value or "").strip()
    today = _today()
    delta = (target_date - today).days
    fecha_label = _fecha_humana(target_date)
    if delta == 0:
        return f"hoy, {fecha_label}"
    if delta == -1:
        return f"ayer, {fecha_label}"
    if -7 <= delta < 0:
        return f"{_weekday_label(target_date)} pasado, {target_date.strftime('%d/%m/%Y')}"
    if delta == 1:
        return f"manana, {fecha_label}"
    if 0 < delta <= 7:
        return f"{_weekday_label(target_date)} proximo, {target_date.strftime('%d/%m/%Y')}"
    return fecha_label


def _fecha_referencia_con_de(value: date | str | None) -> str:
    label = _fecha_referencia_humana(value)
    if label.startswith(("hoy", "ayer", "manana")):
        return f"de {label}"
    return f"del {label}"


def _humanize_dates_in_text(text: str) -> str:
    if not text:
        return text

    def replace_del(match: re.Match[str]) -> str:
        return _fecha_referencia_con_de(match.group("fecha"))

    def replace_prefixed(match: re.Match[str]) -> str:
        return f"{match.group('prefix')}{_fecha_referencia_humana(match.group('fecha'))}"

    updated = re.sub(r"\bdel\s+(?P<fecha>20\d{2}-\d{2}-\d{2})\b", replace_del, text)
    updated = re.sub(
        r"(?P<prefix>\b(?:fecha|parte)\s+)(?P<fecha>20\d{2}-\d{2}-\d{2})\b",
        replace_prefixed,
        updated,
    )
    return re.sub(
        r"\b20\d{2}-\d{2}-\d{2}\b",
        lambda match: _fecha_referencia_humana(match.group(0)),
        updated,
    )


def _selected_fecha_reply(draft, status: str, *, obra: str | None = None) -> str:
    obra_line = _obra_summary_line(obra)
    header = f"Fecha: {_fecha_humana(draft.fecha)}{obra_line}"
    if status == "borrador" and draft.parte_id:
        return f"Parte diario recuperado:\n{header}\n\n{renderer.resumen(draft)}"
    return f"Parte diario en carga:\n{header}\n\n{renderer.resumen(draft)}"


def _load_start_reply(draft, status: str, *, obra: str | None = None, prefix: str | None = None) -> str:
    base = _selected_fecha_reply(draft, status, obra=obra)
    if prefix:
        base = f"{prefix}\n\n{base}"
    if _is_empty_draft(draft):
        return f"{base}\n\n{_novedades_question(draft)}"
    return f"{base}\n\nQueres agregar o corregir alguna novedad?"


def _load_followup_reply(reply: str, draft, *, status: str, obra: str | None = None) -> str:
    base = _strip_known_instructions(reply).strip()
    if status == "updated" and not getattr(draft, "pendientes_ambiguos", None):
        context_lines = []
        if draft.fecha:
            context_lines.append(f"Fecha: {_fecha_humana(draft.fecha)}")
        obra_label = str(obra or "").strip()
        if obra_label:
            context_lines.append(f"Obra: {obra_label}")
        context_text = "\n".join(context_lines)
        if context_text:
            base = f"Parte diario actualizado:\n{context_text}\n\n{renderer.resumen(draft)}"
        else:
            base = f"Parte diario actualizado:\n\n{renderer.resumen(draft)}"
    if not base:
        base = renderer.resumen(draft)
    return f"{base}\n\nHay alguna otra novedad?"


def _volver_carga_reply(draft, *, obra: str | None = None) -> str:
    return (
        "Volvemos a la carga del parte diario.\n\n"
        f"{_selected_fecha_reply(draft, _draft_status(draft), obra=obra)}\n\n"
        "Que queres agregar o corregir?"
    )


def _seguir_editando_reply(draft, *, obra: str | None = None) -> str:
    return (
        "Seguimos editando el parte.\n\n"
        f"{_selected_fecha_reply(draft, _draft_status(draft), obra=obra)}\n\n"
        "Que novedad queres agregar o corregir?"
    )


def _review_reply(draft, *, obra: str | None = None, prefix: str | None = None) -> str:
    lines: list[str] = []
    if prefix:
        lines.append(prefix)
        lines.append("")
    lines.append("Resumen del parte")
    if draft.fecha:
        lines.append(f"Fecha: {_fecha_humana(draft.fecha)}")
    obra_label = str(obra or "").strip()
    if obra_label:
        lines.append(f"Obra: {obra_label}")
    lines.append("")
    lines.append(renderer.resumen_revision(draft))
    lines.append("")
    lines.append(_review_menu())
    return "\n".join(lines)


def _obra_summary_line(obra: str | None) -> str:
    obra_label = str(obra or "").strip()
    return f"\nObra: {obra_label}" if obra_label else ""


def _novedades_question(draft) -> str:
    fecha = _parse_iso_date(getattr(draft, "fecha", None))
    if fecha == _today():
        return "Que novedades hubo hoy?"
    return "Que novedades hubo ese dia?"


def _add_obra_to_reply(reply: str, obra: str | None) -> str:
    obra_label = str(obra or "").strip()
    if not obra_label or "\nObra:" in reply:
        return reply
    lines = reply.splitlines()
    for index, line in enumerate(lines):
        if line.startswith("Fecha:"):
            lines.insert(index + 1, f"Obra: {obra_label}")
            return "\n".join(lines)
    return reply


def _draft_status(draft) -> str:
    return "borrador" if draft.parte_id else "sin cargar"


def _llm_for_stage(llm_client, etapa: str):
    if hasattr(llm_client, "for_stage"):
        return llm_client.for_stage(etapa)
    return llm_client


def _comando_invalido() -> str:
    return "No pude interpretar la opcion. Responde con el numero de una obra."


def _status_from_payload(payload: dict) -> str:
    parte_meta = payload.get("parte_diario") or {}
    return str(parte_meta.get("status") or "ok")


def _should_keep_active_after_readonly(state: ParteDiarioV3State, payload: dict) -> bool:
    if not state.has_resolved_obra():
        return False
    if state.etapa not in {"carga", "revision", "cierre"}:
        return False
    return _status_from_payload(payload) in {"shown", "shown_nomina"}


def _map_menu_text(text: str, state: ParteDiarioV3State) -> str:
    command = _normalize_command(text)
    draft = state.draft()
    if draft.esperando == "confirmacion_cambio_fecha":
        if command == "1":
            return "CAMBIAR FECHA"
        if command == "2":
            return "MANTENER FECHA"
        return text
    if _is_waiting_for_resolution(draft):
        return text
    return text


def _format_reply(reply: str, state: ParteDiarioV3State, payload: dict) -> str:
    draft = state.draft()
    reply = _humanize_dates_in_text(reply)
    if draft.esperando == "confirmacion_cambio_fecha":
        return _replace_tail(reply, "Opciones: 1:CAMBIAR FECHA 2:MANTENER FECHA.")
    if draft.esperando == "confirmacion_cierre_validado":
        state.etapa = "cierre"
        return _replace_tail(_add_obra_to_reply(reply, state.nombre_obra), _salida_confirmacion_tail())
    if draft.esperando in {"confirmacion_ambiguos", "resolucion_conflictos"}:
        state.etapa = "carga" if draft.validacion_origen == "carga" else "validacion"
        if draft.esperando == "confirmacion_ambiguos" and draft.pendientes_ambiguos:
            pending = draft.pendientes_ambiguos[0]
            pending.lista_candidatos_mostrada = True
            state.set_draft(draft)
            return _validation_text_menu(pending)
        return reply
    status = _status_from_payload(payload)
    if status == "confirmation_required" or "Parte diario para confirmar:" in reply:
        state.etapa = "revision"
        return _review_reply(state.draft(), obra=state.nombre_obra)
    if status == "cancel_confirmation_required":
        state.etapa = "confirmar_salida"
        return _salida_confirmacion()
    if status == "sin_novedades":
        state.etapa = "revision"
        return _review_reply(state.draft(), obra=state.nombre_obra)
    if status == "clarification":
        state.etapa = "carga"
        return _add_obra_to_reply(reply, state.nombre_obra)
    if status in {"updated", "shown", "shown_nomina", "waiting", "sin_novedades_rejected"}:
        state.etapa = "carga"
        return _load_followup_reply(
            _add_obra_to_reply(reply, state.nombre_obra),
            state.draft(),
            status=status,
            obra=state.nombre_obra,
        )
    return reply


def _reply_interactive_metadata(state: ParteDiarioV3State, reply: str) -> dict | None:
    if state.draft().esperando == "confirmacion_cierre_validado":
        return _confirmation_metadata(reply)
    if state.draft().esperando == "confirmacion_ambiguos":
        return _validation_metadata(state)
    if state.etapa == "revision":
        return _review_metadata(reply)
    if state.etapa == "confirmar_salida":
        return _confirmation_metadata(reply)
    if state.etapa == "validacion":
        return _validation_metadata(state)
    return None


def _should_validate_incrementally(state: ParteDiarioV3State, process_result) -> bool:
    if state.etapa != "carga":
        return False
    payload = dict(getattr(process_result, "payload", None) or {})
    if _status_from_payload(payload) not in {"updated", "waiting", "clarification"}:
        return False
    draft = ParteDiarioDraftState.from_dict(
        getattr(process_result, "process_state", None) or {},
        oportunidad_id=int(state.oportunidad_id or 0),
        idproyecto=state.proyecto_id,
    )
    if draft.esperando:
        return False
    return bool(draft.pendientes_ambiguos or draft.conflictos_novedad)


def _review_metadata(reply: str) -> dict | None:
    interactive = whatsapp_buttons(
        body=reply,
        buttons=[
            InteractiveButton(id="si", title="SI"),
            InteractiveButton(id="no", title="NO"),
        ],
    )
    return _interactive_metadata(interactive)


def _confirmation_metadata(reply: str) -> dict | None:
    body = _strip_known_confirmation_tail(reply)
    interactive = whatsapp_buttons(
        body=body,
        buttons=[
            InteractiveButton(id="ok", title="OK"),
            InteractiveButton(id="volver", title="VOLVER"),
        ],
    )
    return _interactive_metadata(interactive)


def _validation_metadata(state: ParteDiarioV3State) -> dict | None:
    return None


def _validation_rows(pending) -> list[InteractiveListRow]:
    candidates = _validation_candidates(pending)
    rows = [
        InteractiveListRow(
            id=str(index),
            title=_candidate_button_title(candidate, index),
            description=_candidate_button_description(candidate),
        )
        for index, candidate in enumerate(candidates, start=1)
    ]
    return rows


def _validation_text_menu(pending) -> str:
    if pending is None:
        return "Necesito identificar la persona. Escribi el nombre o NINGUNO."
    candidates = _validation_candidates(pending)
    if not candidates:
        return (
            f"No encontre a {_display_person_name(pending.nombre)} en la nomina activa.\n"
            "Volve a ingresar el nombre, responde NINGUNO o informa la nueva novedad."
        )
    if getattr(pending, "mostrando_candidatos_externos", False):
        candidate_labels = _external_candidates_by_project(candidates)
        return (
            f"Otros {pending.nombre}:\n\n"
            f"{candidate_labels}\n\n"
            "Responde con el nombre o NINGUNO."
        )
    candidate_labels = "; ".join(_candidate_conversational_label(candidate) for candidate in candidates)
    options = "Responde con el nombre, NINGUNO"
    if getattr(pending, "candidatos_externos", None):
        options += " u OTROS"
    options += "."
    return (
        f"A cual {pending.nombre} te referis?\n\n"
        f"{candidate_labels}.\n\n"
        f"{options}"
    )


def _validation_candidates(pending) -> list:
    if pending is None:
        return []
    if getattr(pending, "mostrando_candidatos_externos", False) and getattr(pending, "candidatos_externos", None):
        return list(pending.candidatos_externos or [])
    return list(pending.candidatos or pending.candidatos_externos or [])


def _display_person_name(value: str | None) -> str:
    text = str(value or "").strip()
    return text[:1].upper() + text[1:] if text else "esa persona"


def _is_other_candidates_command(text: str | None, pending) -> bool:
    return _normalize_command(text) == "otros" and bool(getattr(pending, "candidatos_externos", None))


def _external_candidates_by_project(candidates: list) -> str:
    grouped: dict[str, list[str]] = {}
    for candidate in candidates:
        project = _project_short_label(getattr(candidate, "nombre_proyecto", None)) or "OTRA"
        grouped.setdefault(project, []).append(_candidate_conversational_label(candidate, include_project=False))
    return "\n".join(
        f"{project}: {'; '.join(labels)}."
        for project, labels in grouped.items()
    )


def _validation_question(pending) -> str:
    if pending is None:
        return "Elegi una opcion."
    if getattr(pending, "mostrando_candidatos_externos", False):
        return f"Otros fuera de la obra para {pending.nombre}:"
    return f"A cual {pending.nombre} te referis?"


def _candidate_conversational_label(candidate, *, include_project: bool = True) -> str:
    label = str(getattr(candidate, "nombre_completo", "") or "").replace(",", "").strip()
    if not label:
        label = _candidate_button_title(candidate, 1)
    nombre_proyecto = getattr(candidate, "nombre_proyecto", None)
    if include_project and getattr(candidate, "fuera_de_proyecto", False) and nombre_proyecto:
        return f"{label} ({_project_short_label(nombre_proyecto)})"
    return label


def _project_short_label(nombre_proyecto: str | None) -> str:
    return str(nombre_proyecto or "").strip()[:6].strip() or "OTRA"


def _candidate_button_title(candidate, index: int) -> str:
    label = str(getattr(candidate, "nombre_completo", "") or "").strip()
    if not label:
        nro_legajo = str(getattr(candidate, "nro_legajo", "") or "").strip()
        label = f"Legajo {nro_legajo}" if nro_legajo else f"Opcion {index}"
    if len(label) <= 24:
        return label
    return label[:24].rstrip(" ,")


def _candidate_button_description(candidate) -> str | None:
    details = []
    nombre_proyecto = getattr(candidate, "nombre_proyecto", None)
    if getattr(candidate, "fuera_de_proyecto", False) and nombre_proyecto:
        details.append(f"asignado a {_project_short_label(nombre_proyecto)}")
    encargado_nombre = getattr(candidate, "encargado_nombre", None)
    if encargado_nombre:
        details.append(f"encargado {encargado_nombre}")
    return ", ".join(details) if details else None


def _interactive_metadata(interactive: dict | None) -> dict | None:
    if not interactive:
        return None
    return {"outbound": {"type": "interactive", "interactive": interactive}}


def _merge_metadata(*items: dict | None) -> dict | None:
    merged: dict = {}
    for item in items:
        if item:
            merged.update(item)
    return merged or None


def _parse_fecha_value(text: str | None) -> str | None:
    raw = str(text or "").strip()
    try:
        return date.fromisoformat(raw).isoformat()
    except ValueError:
        pass
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s|$)", raw)
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    selected_date = f"{year:04d}-{month:02d}-{day:02d}"
    try:
        return date.fromisoformat(selected_date).isoformat()
    except ValueError:
        return None


def _parse_fecha_reference_in_text(text: str | None) -> date | None:
    raw = str(text or "").strip()
    if not raw:
        return None
    iso_match = re.search(r"\b(20\d{2}-\d{1,2}-\d{1,2})\b", raw)
    if iso_match:
        try:
            return date.fromisoformat(iso_match.group(1))
        except ValueError:
            return None
    match = re.search(r"\b(\d{1,2})\s*(?:/|-)\s*(\d{1,2})(?:\s*(?:/|-)\s*(\d{2,4}))?\b", raw)
    if not match:
        return None
    day = int(match.group(1))
    month = int(match.group(2))
    year_text = match.group(3)
    if year_text:
        year = int(year_text)
        if year < 100:
            year += 2000
    else:
        year = _today().year
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _looks_like_internal_query(text: str) -> bool:
    command = _normalize_command(text)
    query_terms = {
        "falto",
        "falta",
        "faltas",
        "ausente",
        "ausencias",
        "novedad",
        "novedades",
        "parte",
        "partes",
        "pendiente",
        "pendientes",
        "borrador",
        "borradores",
        "sin cargar",
        "cargado",
        "cargados",
        "confirmado",
        "confirmados",
        "cerrado",
        "cerrados",
        "hora",
        "horas",
        "extra",
        "extras",
        "trabajo",
        "trabajaron",
        "trabajadas",
        "trabajados",
    }
    return any(term in command for term in query_terms)


def _looks_like_pending_parts_query(text: str) -> bool:
    command = _normalize_command(text)
    if not command:
        return False
    tokens = set(command.split())
    if not tokens & {"parte", "partes", "pendiente", "pendientes", "borrador", "borradores"}:
        return False
    if tokens <= {"parte", "partes", "pendiente", "pendientes", "borrador", "borradores"}:
        return True
    return bool(
        tokens & {"ver", "mostrame", "mostrar", "consulta", "consultar", "listame", "listar", "cuales", "que"}
        and tokens & {"pendiente", "pendientes", "borrador", "borradores"}
    )


def _strip_known_review_tail(reply: str) -> str:
    text = str(reply or "").strip()
    for tail in (_review_menu(),):
        if text.endswith(tail):
            return text[: -len(tail)].strip()
    return text


def _strip_known_confirmation_tail(reply: str) -> str:
    text = str(reply or "").strip()
    for tail in (_salida_confirmacion_tail(),):
        if text.endswith(tail):
            return text[: -len(tail)].strip()
    return text


def _is_empty_draft(draft) -> bool:
    return not (
        draft.novedades
        or draft.pendientes_ambiguos
        or draft.conflictos_novedad
        or draft.sin_novedades_informado
    )


def _draft_date_before_today(draft) -> bool:
    value = _parse_iso_date(getattr(draft, "fecha", None))
    return value is not None and value < _today()


def _draft_date_is_today(draft) -> bool:
    value = _parse_iso_date(getattr(draft, "fecha", None))
    return value is not None and value == _today()


def _parse_iso_date(value) -> date | None:
    try:
        return date.fromisoformat(str(value or "").strip())
    except ValueError:
        return None


def _review_menu() -> str:
    return "Cerrar definitivamente?\nSI cierra el parte. NO lo deja pendiente."


def _general_greeting() -> str:
    return GENERAL_MENU_TEXT


def _return_to_general(context: V3ConversationContext, *, source: str, prefix: str | None = None) -> V3ProcessResult:
    updated = context.copy()
    updated.active_process = "general"
    updated.process_state = {
        "last_text": "salir parteDiario",
        "agent_source": source,
    }
    reply = _general_greeting()
    if prefix:
        reply = f"{prefix.strip()}\n\n{reply}"
    return V3ProcessResult(
        context=updated,
        reply_text=reply,
        metadata={"process_name": "parteDiario", "status": "returned_to_general"},
    )


def _finish_parte_diario_context(context: V3ConversationContext) -> V3ConversationContext:
    updated = context.copy()
    updated.active_process = None
    updated.process_state = {}
    return updated


def _finish_parte_diario_flow(context: V3ConversationContext) -> V3ProcessResult:
    return V3ProcessResult(
        context=_finish_parte_diario_context(context),
        reply_text="Listo, finalizamos la carga de partes diarios.",
        metadata={"process_name": "parteDiario", "status": "finished"},
    )


def _salida_confirmacion() -> str:
    return f"Se perderan los cambios no guardados.\n\n{_salida_confirmacion_tail()}"


def _sin_novedades_confirmacion() -> str:
    return (
        "No informaste novedades para esta fecha. Confirmas cerrar el parte sin novedades?"
        f"\n\n{_salida_confirmacion_tail()}"
    )


def _cierre_validado_confirmacion(draft, *, obra: str | None = None) -> str:
    return (
        f"Parte diario listo para cerrar:\nFecha: {draft.fecha}{_obra_summary_line(obra)}\n\n"
        f"{renderer.resumen(draft)}\n\n"
        f"Confirmas cerrar el parte diario?\n\n{_salida_confirmacion_tail()}"
    )


def _salida_confirmacion_tail() -> str:
    return "Opciones: OK / VOLVER."


def _persistence_debug_message(
    exc: Exception,
    *,
    stage: str,
    draft,
    state: ParteDiarioV3State,
    context: V3ConversationContext,
    message: V3InboundMessage,
    payload: dict | None,
) -> str:
    result = payload or {}
    exception_name = type(exc).__name__
    exception_message = str(exc) or "(sin detalle)"
    draft_novedades = len(getattr(draft, "novedades", []) or [])
    draft_pendientes = len(getattr(draft, "pendientes_ambiguos", []) or [])
    draft_conflictos = len(getattr(draft, "conflictos_novedad", []) or [])
    text_preview = (str(message.text or "").replace("\n", " ").strip())[:180]

    lines = [
        "No pude guardar el parte diario.",
        "",
        "DEBUG persistencia:",
        f"- stage: {stage}",
        f"- exception: {exception_name}",
        f"- exception_message: {exception_message}",
        f"- conversation_id: {context.conversation_id}",
        f"- external_message_id: {message.external_message_id}",
        f"- message_type: {message.message_type}",
        f"- inbound_text: {text_preview or '(vacio)'}",
        f"- etapa: {state.etapa}",
        f"- esperando: {getattr(draft, 'esperando', None)}",
        f"- fecha: {getattr(draft, 'fecha', None)}",
        f"- proyecto_id: {state.proyecto_id}",
        f"- oportunidad_id: {state.oportunidad_id}",
        f"- contacto_id: {state.contacto_id}",
        f"- parte_id_existente: {getattr(draft, 'parte_id', None)}",
        f"- draft_novedades: {draft_novedades}",
        f"- draft_pendientes_ambiguos: {draft_pendientes}",
        f"- draft_conflictos: {draft_conflictos}",
        f"- payload_parte_listo: {result.get('parte_listo')}",
        f"- payload_cerrar_parte: {result.get('cerrar_parte')}",
        f"- payload_confirmar_parte: {result.get('confirmar_parte')}",
        f"- payload_fecha: {result.get('fecha')}",
        f"- payload_idproyecto: {result.get('idproyecto')}",
        f"- payload_contacto_id: {result.get('contacto_id')}",
        f"- payload_parte_id_existente: {result.get('parte_id_existente')}",
    ]
    return "\n".join(lines)


def _save_payload(draft, *, cerrar_parte: bool) -> dict:
    return {
        "type": "parte_diario_reply",
        "reply_to_user": (
            renderer.confirmado(draft, cerrado=True)
            if cerrar_parte
            else _borrador_guardado_reply(draft)
        ),
        "parte_listo": True,
        "cerrar_parte": cerrar_parte,
        "confirmar_parte": cerrar_parte,
        "close_after_materialization": True,
        "cancelado": False,
        "oportunidad_id": draft.oportunidad_id,
        "idproyecto": draft.idproyecto,
        "fecha": draft.fecha,
        "parte_id_existente": draft.parte_id,
        "sin_novedades_informado": draft.sin_novedades_informado,
        "novedades": [item.to_dict() for item in draft.novedades],
        "pendientes_ambiguos": [item.to_dict() for item in draft.pendientes_ambiguos],
        "conflictos_novedad": [item.to_dict() for item in draft.conflictos_novedad],
        "errores": [],
        "parte_diario": {
            "status": "saved" if not cerrar_parte else "confirmed",
            "operations": ["guardar" if not cerrar_parte else "confirmar"],
        },
    }


def _borrador_guardado_reply(draft) -> str:
    fecha = f" {_fecha_referencia_con_de(draft.fecha)}" if draft.fecha else ""
    return f"Carga finalizada para el parte{fecha}."


def _estado_parte_visible(status: str | None) -> str:
    normalized = str(status or "").strip().lower()
    if normalized == "borrador":
        return "en carga"
    if normalized in {"confirmado", "cerrado"}:
        return "finalizado"
    return normalized or "sin estado"


def _draft_summary(draft) -> str:
    lines: list[str] = []
    if draft.fecha:
        lines.append(f"Fecha: {draft.fecha}")
    if draft.sin_novedades_informado and not draft.novedades:
        lines.append("- Sin novedades. Todos presentes.")
    for novelty in draft.novedades:
        state = novelty.estado_codigo or "estado pendiente"
        hours = _summary_hours_text(novelty.estado_codigo, novelty.horas)
        hours_part = f", {hours}" if hours else ""
        lines.append(f"- {novelty.nombre}: {state}{hours_part}")
    for pending in draft.pendientes_ambiguos:
        hours_value = renderer._pending_hours(pending)
        state = pending.estado_codigo or "estado pendiente"
        hours = _summary_hours_text(pending.estado_codigo, hours_value)
        hours_part = f", {hours}" if hours else ""
        lines.append(f"- {pending.nombre} (a validar): {state}{hours_part}")
    return "\n".join(lines)


def _summary_hours_text(estado_codigo: str | None, hours: float | None) -> str:
    if str(estado_codigo or "").upper() == "FAL" and hours in {0, 0.0, None}:
        return ""
    return f"{hours:g}h" if hours is not None else "horas pendientes"


def _asistencia_existing_suffix(existing) -> str:
    if existing is None:
        return ""
    state = existing.estado_codigo or "estado pendiente"
    hours = (
        _summary_hours_text(existing.estado_codigo, existing.horas)
        if str(existing.estado_codigo or "").upper() == "P" or existing.horas not in {0, 0.0}
        else ""
    )
    parts = [state]
    if hours:
        parts.append(hours)
    if existing.descripcion and str(existing.estado_codigo or "").upper() != "P":
        parts.append(f"motivo: {existing.descripcion}")
    return f" - informado: {', '.join(parts)}"


def _replace_tail(reply: str, menu: str) -> str:
    base = _strip_known_instructions(reply).rstrip()
    if not base:
        return menu
    return f"{base}\n\n{menu}"


def _strip_known_instructions(reply: str) -> str:
    lines = reply.splitlines()
    while lines and not lines[-1].strip():
        lines.pop()
    known_prefixes = (
        "Cuando termines, escribi CONFIRMAR.",
        "Para guardarlo, responde CONFIRMAR.",
        "Para resolver las aclaraciones, responde CONFIRMAR.",
        "Novedades registradas. Escribi CONFIRMAR para guardar.",
        "Para descartar el parte diario completo, responde CANCELAR.",
    )
    if len(lines) > 1 and lines[-1].strip() in known_prefixes:
        lines.pop()
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def _is_waiting_for_resolution(draft) -> bool:
    return draft.esperando in {
        "confirmacion_ambiguos",
        "resolucion_conflictos",
        "confirmacion_cambio_fecha",
        "confirmacion_sin_novedades",
        "confirmacion_cierre_validado",
    }


def _is_finish_loading_command(command: str) -> bool:
    return command in {
        "no",
        "nada",
        "nada mas",
        "no nada mas",
        "no hay mas",
        "no hay nada mas",
        "eso es todo",
        "listo",
        "terminamos",
        "termine",
        "finalizar carga",
        "revisar",
        "ver resumen",
        "ok",
    }


def _has_conversational_draft(draft) -> bool:
    return bool(
        draft.parte_id
        or draft.novedades
        or draft.pendientes_ambiguos
        or draft.conflictos_novedad
        or draft.sin_novedades_informado
    )


def _normalize_phone(value: str | None) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def _is_date_menu_command(command: str) -> bool:
    return command in {"parte diario", "parte diarios", "partes diarios"}


def _is_parte_diario_start_command(command: str) -> bool:
    tokens = set(command.split())
    return "parte" in tokens and ("diario" in tokens or "diarios" in tokens)


def _is_pending_parts_command(command: str) -> bool:
    return command in {
        "parte pendiente",
        "parte pendientes",
        "partes pendiente",
        "partes pendientes",
    }


def _is_show_nomina_command(command: str) -> bool:
    tokens = set(command.split())
    return "nomina" in tokens or "personal" in tokens or "empleados" in tokens or "empleado" in tokens


def _extract_apoyos_origin_text(text: str | None) -> str:
    normalized = str(text or "").strip()
    match = re.match(r"^\s*apoyos?\s*(?:de|desde)?\s*(.*?)\s*$", normalized, flags=re.IGNORECASE)
    if not match:
        return ""
    return match.group(1).strip()


def _apoyos_next_steps() -> str:
    return (
        "Volvemos al parte diario. "
        "Para registrar trabajo en otra obra, cargalo como novedad normal. "
        "Para cargar faltas o accidentes, escribi LISTADO. "
        "Para terminar el parte, responde GUARDAR o CERRAR."
    )


def _extract_external_work_project_text(text: str | None) -> str:
    normalized = normalize_text(text)
    if not normalized:
        return ""
    work_tokens = {
        "trabajo",
        "trabaja",
        "trabajando",
        "trabajar",
        "vino",
        "fue",
        "va",
        "apoyo",
        "apoyar",
        "mande",
        "mandaron",
        "envie",
        "enviaron",
    }
    if not (work_tokens & set(normalized.split())) and "otra obra" not in normalized:
        return ""
    matches = list(re.finditer(r"\b(?:en|a|para)\s+(?:la\s+)?(?:obra\s+)?(.+)$", normalized))
    if not matches:
        return ""
    project_text = matches[-1].group(1)
    project_text = re.sub(r"\b\d+(?:\.\d+)?\s*(?:h|hs|hora|horas)\b", " ", project_text)
    project_text = re.sub(r"\b(?:otra|otro)\s+obra\b", " ", project_text)
    project_text = re.sub(r"\s+", " ", project_text).strip()
    return project_text


def _parse_hours_from_text(text: str | None, *, require_unit: bool = False) -> float | None:
    raw = str(text or "").strip().lower().replace(",", ".")
    if not raw:
        return 9.0
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b", raw)
    if not match and not require_unit:
        match = re.search(r"\b(\d+(?:\.\d+)?)\b", raw)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None
