"""Handler de parteDiario v3."""

from __future__ import annotations

import logging
import re
import time
from datetime import date, timedelta
from types import SimpleNamespace

from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult
from agente.v3.interactive import InteractiveButton, InteractiveListRow, whatsapp_buttons, whatsapp_list
from agente.v3.subprocesses.general_agent import GENERAL_MENU_TEXT
from agente.v3.subprocesses.parte_diario.llm_client import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.query_agent import ParteDiarioQueryAgentClient
from agente.v3.subprocesses.parte_diario import renderer
from agente.v3.subprocesses.parte_diario.process import ParteDiarioProcess, _normalize_command, _today
from agente.v3.subprocesses.parte_diario.state import (
    ParteDiarioFechaOption,
    ParteDiarioOption,
    ParteDiarioV3State,
)
from app.db import engine
from app.models import CRMContacto, CRMOportunidad, EstadoParteDiario, Nomina, ParteDiario, Proyecto, ProyectoEncargado
from app.services.parte_diario_service import parte_diario_service

logger = logging.getLogger(__name__)

_CANDIDATE_LIST_MAX_ROWS = 10
_CANDIDATE_LIST_PAGE_SIZE = 9
_MORE_CANDIDATES_ID = "mostrar mas candidatos"


class ParteDiarioSubprocess:
    name = "parteDiario"

    def __init__(
        self,
        llm_client: ParteDiarioLLMClient | None = None,
        query_agent_client: ParteDiarioQueryAgentClient | None = None,
    ) -> None:
        self._llm = llm_client or ParteDiarioLLMClient()
        self._query_agent = query_agent_client or ParteDiarioQueryAgentClient()

    async def handle(self, message: V3InboundMessage, context: V3ConversationContext) -> V3ProcessResult:
        state = ParteDiarioV3State.from_dict(context.process_state)
        selected_fecha = _parse_fecha_value(message.text)
        command = _normalize_command(message.text)
        is_date_menu_command = _is_date_menu_command(command)
        resolved_obra_from_current_message = False

        if not state.has_resolved_obra():
            initial_result = self._handle_inicial(
                message,
                command,
                context,
                state,
                show_date_menu=is_date_menu_command,
            )
            if initial_result is not None:
                return initial_result
            resolved_obra_from_current_message = True

        if selected_fecha and state.has_resolved_obra():
            return self._handle_fecha_value(selected_fecha, context, state)

        if is_date_menu_command:
            return self._show_date_menu(context, state)

        if state.etapa == "seleccionar_fecha":
            return await self._handle_fecha_selection(command, message, context, state)

        if state.etapa == "cargar_fecha":
            if resolved_obra_from_current_message:
                await self._infer_initial_date(message, state)
            prepared = self._handle_cargar_fecha(
                context,
                state,
                reply_on_success=not resolved_obra_from_current_message,
            )
            if prepared is not None:
                return prepared

        if state.etapa == "confirmar_salida":
            return self._handle_confirmar_salida(command, context, state)

        if state.draft().esperando == "confirmacion_sin_novedades":
            return await self._handle_confirmar_sin_novedades(command, message, context, state)

        if state.draft().esperando == "confirmacion_cierre_validado":
            return await self._handle_confirmar_cierre_validado(command, message, context, state)

        if state.draft().esperando == "confirmacion_ambiguos":
            if command == "volver":
                return self._back_to_load_from_validation(context, state)
            draft = state.draft()
            pending = draft.pendientes_ambiguos[0] if draft.pendientes_ambiguos else None
            if command in {"elegir opcion", "ver opciones", "opciones"}:
                return self._show_validation_options(context, state, reset_page=True)
            if pending and _is_validation_back_command(command, pending):
                return self._back_to_load_from_validation(context, state)
            if pending and _is_validation_unvalidated_command(command, pending):
                return await self._handle_parte_diario(
                    message,
                    context,
                    state,
                    forced_text="registrar sin validar",
                )
            if pending and _is_more_candidate_command(command, pending):
                return self._show_more_validation_options(context, state)

        if state.etapa == "menu":
            if command in {"3", "salir"}:
                return _return_to_general(context, source="parte_diario_legacy_menu")
            return self._show_date_menu(context, state)

        local_result = await self._handle_local_menu_command(command, message, context, state)
        if local_result is not None:
            return local_result

        return await self._handle_parte_diario(message, context, state)

    async def _infer_initial_date(self, message: V3InboundMessage, state: ParteDiarioV3State) -> None:
        draft = state.draft()
        if draft.fecha:
            return
        with Session(engine) as session:
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, "carga"))
            estados = process._load_estados()
            nominas_proyecto, _ = process._load_nominas(
                int(state.proyecto_id or 0),
                contacto_id=state.contacto_id,
            )
            try:
                plan = await _llm_for_stage(self._llm, "carga").interpret_turn(
                    message.text or "",
                    draft,
                    nominas_proyecto,
                    estados,
                )
            except Exception:
                logger.exception("No se pudo inferir fecha inicial de parteDiario")
                return
        date_operations = [operation for operation in plan.operations if operation.type == "set_fecha"]
        if not date_operations:
            return
        try:
            target_date = date.fromisoformat(str(date_operations[-1].fecha or "").strip())
        except ValueError:
            return
        if target_date > _today():
            return
        draft.fecha = target_date.isoformat()
        state.set_draft(draft)

    def _handle_inicial(
        self,
        message: V3InboundMessage,
        command: str,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        show_date_menu: bool,
    ) -> V3ProcessResult | None:
        if state.opciones_obra:
            try:
                selected_option = int(command)
            except ValueError:
                return self._active_result(context, state, _comando_invalido(), "invalid_obra_selection")

            for option in state.opciones_obra:
                if option.opcion == selected_option:
                    should_show_date_menu = show_date_menu or state.fecha_menu_pendiente
                    state.set_obra(option)
                    state.fecha_menu_pendiente = False
                    if should_show_date_menu:
                        return self._show_date_menu(context, state)
                    return self._handle_cargar_fecha(context, state)
            return self._active_result(context, state, _comando_invalido(), "invalid_obra_selection")

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
            if show_date_menu:
                return self._show_date_menu(context, state)
            return None

        state.etapa = "inicial"
        state.opciones_obra = options
        state.fecha_menu_pendiente = show_date_menu
        return self._active_result(context, state, _seleccionar_obra(state), "obra_selection_required")

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
        command: str,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        if command in {"salir"}:
            return _return_to_general(context, source="parte_diario_fecha_menu")
        if _is_show_nomina_command(command):
            return self._show_nomina_on_date_menu(context, state)

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

        return self._apply_fecha_selection(selected, context, state)

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

    def _show_nomina_on_date_menu(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        if not state.proyecto_id:
            return self._closed_result(
                context,
                "No encontre una obra asociada para cargar el parte diario.",
                "obra_not_found",
            )
        with Session(engine) as session:
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, state.etapa))
            nominas_proyecto, _ = process._load_nominas(
                int(state.proyecto_id),
                contacto_id=state.contacto_id,
            )
        return self._show_date_menu(
            context,
            state,
            prefix=renderer.mostrar_nomina(nominas_proyecto),
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

    def _handle_fecha_value(
        self,
        fecha: str,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
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

        return self._apply_fecha_selection(selected, context, state)

    def _apply_fecha_selection(
        self,
        selected: ParteDiarioFechaOption,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
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
        draft.retomado = False
        state.set_draft(draft)
        state.opciones_fecha = []
        state.etapa = "cargar_fecha"
        if selected.estado in {"confirmado", "cerrado"}:
            error = self._prepare_cargar_fecha(state, allow_closed=True)
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

        return self._handle_cargar_fecha(context, state)

    def _handle_cargar_fecha(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        reply_on_success: bool = True,
    ) -> V3ProcessResult | None:
        error = self._prepare_cargar_fecha(state)
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
        if not reply_on_success:
            return None
        draft = state.draft()
        reply = _with_load_menu(_selected_fecha_reply(draft, _draft_status(draft), obra=state.nombre_obra), draft)
        return self._active_result(
            context,
            state,
            reply,
            "date_loaded",
            _merge_metadata(
                {"fecha": draft.fecha, "parte_id": draft.parte_id},
                _main_menu_metadata(reply),
            ),
        )

    def _prepare_cargar_fecha(self, state: ParteDiarioV3State, *, allow_closed: bool = False) -> str | None:
        draft = state.draft()
        if not draft.fecha:
            draft.fecha = _today().isoformat()
        with Session(engine) as session:
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, state.etapa))
            estados = process._load_estados()
            error = process._apply_date(draft, draft.fecha, estados, allow_closed=allow_closed)
        if error:
            return error
        state.set_draft(draft)
        state.etapa = "carga"
        return None

    def _handle_confirmar_salida(
        self,
        command: str,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        if command in {"ok", "1"}:
            return self._post_action_result(
                context,
                state,
                "Parte diario descartado.",
                "discarded",
            )

        if command in {"volver", "2"}:
            state.etapa = "carga"
            reply = _volver_carga_reply(state.draft(), obra=state.nombre_obra)
            return self._active_result(
                context,
                state,
                reply,
                "exit_cancelled",
                _main_menu_metadata(reply),
            )

        return self._active_result(
            context,
            state,
            _salida_confirmacion(),
            "invalid_exit_confirmation",
            _confirmation_metadata(_salida_confirmacion()),
        )

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
            state.set_draft(draft)
            state.etapa = "carga"
            reply = _volver_carga_reply(draft, obra=state.nombre_obra)
            return self._active_result(
                context,
                state,
                reply,
                "empty_close_cancelled",
                _main_menu_metadata(reply),
            )

        reply = _sin_novedades_confirmacion()
        return self._active_result(
            context,
            state,
            reply,
            "invalid_empty_close_confirmation",
            _confirmation_metadata(reply),
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
            state.set_draft(draft)
            state.etapa = "carga"
            reply = _volver_carga_reply(draft, obra=state.nombre_obra)
            return self._active_result(
                context,
                state,
                reply,
                "validated_close_cancelled",
                _main_menu_metadata(reply),
            )

        reply = _cierre_validado_confirmacion(draft, obra=state.nombre_obra)
        return self._active_result(
            context,
            state,
            reply,
            "invalid_validated_close_confirmation",
            _confirmation_metadata(reply),
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
            _validation_action_buttons_metadata(pending, reply),
        )

    def _back_to_load_from_validation(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        draft.esperando = None
        state.set_draft(draft)
        state.etapa = "carga"
        reply = _with_load_menu(_selected_fecha_reply(draft, _draft_status(draft), obra=state.nombre_obra), draft)
        return self._active_result(
            context,
            state,
            reply,
            "validation_back_to_load",
            _main_menu_metadata(reply),
        )

    def _show_more_validation_options(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        pending = draft.pendientes_ambiguos[0] if draft.pendientes_ambiguos else None
        if pending is not None:
            candidates = pending.candidatos or []
            if _candidate_page_has_more(candidates, pending.pagina_candidatos):
                pending.pagina_candidatos += 1
                pending.lista_candidatos_mostrada = True
                state.set_draft(draft)
            elif not pending.mostrando_candidatos_externos and pending.candidatos_externos:
                pending.candidatos = pending.candidatos_externos
                pending.mostrando_candidatos_externos = True
                pending.pagina_candidatos = 0
                pending.lista_candidatos_mostrada = True
                state.set_draft(draft)
        reply = _validation_text_menu(pending) if pending else "Elegi una opcion."
        return self._active_result(
            context,
            state,
            reply,
            "validation_options",
            _validation_action_buttons_metadata(pending, reply),
        )

    async def _handle_local_menu_command(
        self,
        command: str,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult | None:
        draft = state.draft()
        if _is_waiting_for_resolution(draft):
            return None

        if command in {"guardar", "1"}:
            return await self._guardar_borrador(message, context, state)

        if command in {"cerrar", "2"}:
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

        if command in {"salir", "3"}:
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
                _main_menu_metadata(reply),
            )

        return None

    async def _guardar_borrador(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        draft = state.draft()
        if not draft.fecha:
            return self._active_result(
                context,
                state,
                _with_load_menu("No hay una fecha cargada para guardar el parte.", draft),
                "missing_date",
                _main_menu_metadata(_with_load_menu("No hay una fecha cargada para guardar el parte.", draft)),
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
                return self._active_result(
                    context,
                    state,
                    _with_load_menu(error_reply, draft),
                    "persistence_error",
                    _main_menu_metadata(_with_load_menu(error_reply, draft)),
                )

        payload["parte_diario_id"] = parte.id
        logger.info(
            "v3_parte_diario_save_draft_timing external_message_id=%s parte_diario_id=%s persist_total_ms=%s",
            message.external_message_id,
            parte.id,
            round((time.perf_counter() - started) * 1000, 3),
        )
        return self._post_action_result(
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

    async def _handle_parte_diario(
        self,
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        *,
        forced_text: str | None = None,
    ) -> V3ProcessResult:
        if not state.contacto_id or not state.oportunidad_id or not state.proyecto_id:
            return self._closed_result(
                context,
                "No encontre una obra asociada para cargar el parte diario.",
                "obra_not_found",
            )

        started = time.perf_counter()
        with Session(engine) as session:
            mapped_text = forced_text or _map_menu_text(message.text or "", state)
            process_context = SimpleNamespace(
                oportunidad_id=state.oportunidad_id,
                contacto_id=state.contacto_id,
                is_project=True,
                active_process="parte_diario",
                process_state=state.parte_state,
                message=SimpleNamespace(contenido=mapped_text),
            )
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, state.etapa))
            process_result = await process.handle(process_context)
            payload = dict(process_result.payload or {})
            if state.contacto_id:
                payload["contacto_id"] = int(state.contacto_id)

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
                return self._post_action_result(
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
                    },
                )

        if (process_result.keep_active or _should_keep_active_after_readonly(state, payload)) and not payload.get("cancelado"):
            state.parte_state = dict(process_result.process_state or {})
            reply = _format_reply(payload.get("reply_to_user") or "", state, payload)
            return self._active_result(
                context,
                state,
                reply,
                _status_from_payload(payload),
                _merge_metadata({"result": payload}, _reply_interactive_metadata(state, reply)),
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
            },
        )

    def _post_action_result(
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
        return self._show_date_menu(
            context,
            state,
            prefix=reply,
            status=status,
            extra_metadata=metadata,
        )

    def _active_result(
        self,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
        reply: str,
        status: str,
        extra_metadata: dict | None = None,
    ) -> V3ProcessResult:
        updated = context.copy()
        updated.active_process = self.name
        updated.process_state = state.to_dict()
        metadata = {"process_name": self.name, "status": status, "etapa": state.etapa}
        if extra_metadata:
            metadata.update(extra_metadata)
        return V3ProcessResult(context=updated, reply_text=reply, metadata=metadata)

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
    ) -> list[ParteDiarioFechaOption]:
        today = _today()
        dates = [today - timedelta(days=offset) for offset in range(7)]
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


def _seleccionar_obra(state: ParteDiarioV3State) -> str:
    options = "\n".join(f"{option.opcion}: {option.nombre}" for option in state.opciones_obra)
    return f"En que obra queres cargar el parte diario?\n{options}"


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
    return f"{option.opcion}: {target_date.strftime('%d/%m/%Y')} {_weekday_label(target_date)} ({option.estado})"


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
                description=option.estado,
            )
            for option in options
        ],
    )
    return _interactive_metadata(interactive)


def _fecha_menu_title(obra: str | None = None) -> str:
    obra_label = str(obra or "").strip()
    if obra_label:
        return f"Selecciona la fecha del parte diario:\nObra: {obra_label}"
    return "Selecciona la fecha del parte diario:"


def _fecha_option_title(option: ParteDiarioFechaOption) -> str:
    target_date = date.fromisoformat(option.fecha)
    return f"{target_date.strftime('%d/%m/%Y')} {_weekday_label(target_date)}"


def _weekday_label(value: date) -> str:
    return ["lun", "mar", "mie", "jue", "vie", "sab", "dom"][value.weekday()]


def _selected_fecha_reply(draft, status: str, *, obra: str | None = None) -> str:
    obra_line = _obra_summary_line(obra)
    header = f"Fecha: {draft.fecha}{obra_line}"
    if status == "borrador" and draft.parte_id:
        return f"Parte diario borrador recuperado:\n{header}\n\n{renderer.resumen(draft)}"
    return f"Parte diario en carga:\n{header}\n\n{renderer.resumen(draft)}"


def _volver_carga_reply(draft, *, obra: str | None = None) -> str:
    return _with_load_menu(
        f"Volvemos a la carga del parte diario.\n\n{_selected_fecha_reply(draft, _draft_status(draft), obra=obra)}",
        draft,
    )


def _obra_summary_line(obra: str | None) -> str:
    obra_label = str(obra or "").strip()
    return f"\nObra: {obra_label}" if obra_label else ""


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
    if state.etapa not in {"carga", "cierre"}:
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
    if draft.esperando == "confirmacion_cambio_fecha":
        return _replace_tail(reply, "Opciones: 1:CAMBIAR FECHA 2:MANTENER FECHA.")
    if draft.esperando == "confirmacion_cierre_validado":
        state.etapa = "cierre"
        return _replace_tail(_add_obra_to_reply(reply, state.nombre_obra), _salida_confirmacion_tail())
    if draft.esperando in {"confirmacion_ambiguos", "resolucion_conflictos"}:
        state.etapa = "validacion"
        if draft.esperando == "confirmacion_ambiguos" and draft.pendientes_ambiguos:
            pending = draft.pendientes_ambiguos[0]
            pending.lista_candidatos_mostrada = True
            state.set_draft(draft)
            return _validation_text_menu(pending)
        return reply
    status = _status_from_payload(payload)
    if status == "confirmation_required" or "Parte diario para confirmar:" in reply:
        state.etapa = "cierre"
        return _replace_tail(_add_obra_to_reply(reply, state.nombre_obra), _close_menu())
    if status == "cancel_confirmation_required":
        state.etapa = "confirmar_salida"
        return _salida_confirmacion()
    if status in {"updated", "sin_novedades", "shown", "shown_nomina", "clarification", "waiting"}:
        state.etapa = "carga"
        return _with_load_menu(_add_obra_to_reply(reply, state.nombre_obra), state.draft())
    return reply


def _with_load_menu(reply: str, draft=None) -> str:
    return _replace_tail(reply, _main_menu())


def _reply_interactive_metadata(state: ParteDiarioV3State, reply: str) -> dict | None:
    if state.draft().esperando == "confirmacion_cierre_validado":
        return _confirmation_metadata(reply)
    if state.etapa in {"carga", "cierre"}:
        return _main_menu_metadata(reply)
    if state.etapa == "confirmar_salida":
        return _confirmation_metadata(reply)
    if state.etapa == "validacion":
        return _validation_metadata(state)
    return None


def _main_menu_metadata(reply: str) -> dict | None:
    body = _strip_known_menu_tail(reply)
    interactive = whatsapp_buttons(
        body=body,
        buttons=[
            InteractiveButton(id="guardar", title="GUARDAR"),
            InteractiveButton(id="cerrar", title="CERRAR"),
            InteractiveButton(id="salir", title="SALIR"),
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
    draft = state.draft()
    if draft.esperando != "confirmacion_ambiguos" or not draft.pendientes_ambiguos:
        return None
    pending = draft.pendientes_ambiguos[0]
    if not pending.nombre_pendiente:
        return None
    return _validation_action_buttons_metadata(pending, _validation_text_menu(pending))


def _validation_action_buttons_metadata(pending, reply: str) -> dict | None:
    if pending is None:
        return None
    buttons: list[InteractiveButton] = []
    if _validation_action_position(pending, "mostrar mas") is not None:
        buttons.append(InteractiveButton(id=_MORE_CANDIDATES_ID, title="VER MAS"))
    buttons.append(InteractiveButton(id="registrar sin validar", title="SIN VALIDAR"))
    buttons.append(InteractiveButton(id="volver", title="VOLVER"))
    interactive = whatsapp_buttons(body=reply, buttons=buttons)
    return _interactive_metadata(interactive)


def _validation_list_metadata(state: ParteDiarioV3State) -> dict | None:
    draft = state.draft()
    if draft.esperando != "confirmacion_ambiguos" or not draft.pendientes_ambiguos:
        return None
    pending = draft.pendientes_ambiguos[0]
    if not pending.nombre_pendiente:
        return None
    rows = _validation_rows(pending)
    if not rows:
        return None
    interactive = whatsapp_list(
        body=_validation_question(pending),
        button="Elegir opcion",
        section_title="Opciones",
        rows=rows,
    )
    return _interactive_metadata(interactive)


def _validation_rows(pending) -> list[InteractiveListRow]:
    candidates = pending.candidatos or []
    visible_candidates, has_more = _candidate_page(candidates, pending.pagina_candidatos)
    has_more = has_more or (
        not pending.mostrando_candidatos_externos and bool(pending.candidatos_externos)
    )
    rows = [
        InteractiveListRow(
            id=str(index),
            title=_candidate_button_title(candidate, index),
            description=_candidate_button_description(candidate),
        )
        for index, candidate in enumerate(visible_candidates, start=1)
    ]
    return rows


def _validation_text_menu(pending) -> str:
    rows = _validation_rows(pending)
    lines = [_validation_question(pending), "Opciones:"]
    for index, row in enumerate(rows, start=1):
        detail = f" ({row.description})" if row.description else ""
        lines.append(f"{index}: {row.title}{detail}")
    return "\n".join(lines)


def _candidate_page(candidates: list, page: int) -> tuple[list, bool]:
    if len(candidates) <= _CANDIDATE_LIST_MAX_ROWS:
        return candidates, False
    offset = max(0, page) * _CANDIDATE_LIST_PAGE_SIZE
    remaining = max(0, len(candidates) - offset)
    if remaining <= _CANDIDATE_LIST_MAX_ROWS:
        return candidates[offset:], False
    return candidates[offset : offset + _CANDIDATE_LIST_PAGE_SIZE], True


def _candidate_page_has_more(candidates: list, page: int) -> bool:
    if len(candidates) <= _CANDIDATE_LIST_MAX_ROWS:
        return False
    offset = max(0, page) * _CANDIDATE_LIST_PAGE_SIZE
    return len(candidates) - offset > _CANDIDATE_LIST_MAX_ROWS


def _is_more_candidate_command(command: str, pending) -> bool:
    candidates = pending.candidatos or []
    visible_candidates, has_more = _candidate_page(candidates, pending.pagina_candidatos)
    has_more = has_more or (
        not pending.mostrando_candidatos_externos and bool(pending.candidatos_externos)
    )
    if not has_more:
        return False
    if command in {_MORE_CANDIDATES_ID, "ver mas", "mostrar mas", "mas"}:
        return True
    return False


def _is_validation_unvalidated_command(command: str, pending) -> bool:
    if command in {"registrar sin validar", "sin validar", "aceptar sin validar"}:
        return True
    return False


def _is_validation_back_command(command: str, pending) -> bool:
    if command == "volver":
        return True
    return False


def _validation_action_position(pending, action: str) -> int | None:
    candidates = pending.candidatos or []
    visible_candidates, has_more = _candidate_page(candidates, pending.pagina_candidatos)
    has_more = has_more or (
        not pending.mostrando_candidatos_externos and bool(pending.candidatos_externos)
    )
    row_count = len(visible_candidates)
    if has_more:
        row_count += 1
    register_position = row_count + 1 if row_count < _CANDIDATE_LIST_MAX_ROWS else None
    back_position = (
        register_position + 1
        if register_position is not None and register_position < _CANDIDATE_LIST_MAX_ROWS
        else None
    )
    if action == "registrar sin validar":
        return register_position
    if action == "volver":
        return back_position
    if action == "mostrar mas":
        return row_count if has_more else None
    return None


def _validation_question(pending) -> str:
    if pending is None:
        return "Elegi una opcion."
    if getattr(pending, "mostrando_candidatos_externos", False):
        return f"Otros fuera de la obra para {pending.nombre}:"
    return f"A cual {pending.nombre} te referis?"


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
    nro_legajo = getattr(candidate, "nro_legajo", None)
    if nro_legajo:
        details.append(f"legajo {nro_legajo}")
    nombre_proyecto = getattr(candidate, "nombre_proyecto", None)
    if getattr(candidate, "fuera_de_proyecto", False) and nombre_proyecto:
        details.append(f"asignado a {nombre_proyecto}")
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


def _strip_known_menu_tail(reply: str) -> str:
    text = str(reply or "").strip()
    for tail in (_main_menu(),):
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


def _close_menu() -> str:
    return _main_menu()


def _main_menu() -> str:
    return "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR."


def _general_greeting() -> str:
    return GENERAL_MENU_TEXT


def _return_to_general(context: V3ConversationContext, *, source: str) -> V3ProcessResult:
    updated = context.copy()
    updated.active_process = "general"
    updated.process_state = {
        "last_text": "salir parteDiario",
        "agent_source": source,
    }
    return V3ProcessResult(
        context=updated,
        reply_text=_general_greeting(),
        metadata={"process_name": "parteDiario", "status": "returned_to_general"},
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
    fecha = f" para {draft.fecha}" if draft.fecha else ""
    return f"Parte diario guardado como borrador{fecha}."


def _draft_summary(draft) -> str:
    lines: list[str] = []
    if draft.fecha:
        lines.append(f"Fecha: {draft.fecha}")
    if draft.sin_novedades_informado and not draft.novedades:
        lines.append("- Sin novedades. Todos presentes.")
    for novelty in draft.novedades:
        hours = f"{novelty.horas:g}h" if novelty.horas is not None else "horas pendientes"
        state = novelty.estado_codigo or "estado pendiente"
        lines.append(f"- {novelty.nombre}: {state}, {hours}")
    for pending in draft.pendientes_ambiguos:
        hours_value = renderer._pending_hours(pending)
        hours = f"{hours_value:g}h" if hours_value is not None else "horas pendientes"
        state = pending.estado_codigo or "estado pendiente"
        lines.append(f"- {pending.nombre} (a validar): {state}, {hours}")
    return "\n".join(lines)


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
        "Asistencia completa registrada. Escribi CONFIRMAR para guardar.",
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


def _is_show_nomina_command(command: str) -> bool:
    tokens = set(command.split())
    return "nomina" in tokens or "personal" in tokens or "empleados" in tokens or "empleado" in tokens
