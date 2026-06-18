"""Handler de parteDiario v3."""

from __future__ import annotations

import logging
import re
import time
from datetime import date, timedelta
from types import SimpleNamespace

from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult
from agente.v3.subprocesses.general_agent import GENERAL_MENU_TEXT
from agente.v3.subprocesses.parte_diario.llm_client import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario import renderer
from agente.v3.subprocesses.parte_diario.process import ParteDiarioProcess, _normalize_command, _today
from agente.v3.subprocesses.parte_diario.state import (
    ParteDiarioFechaOption,
    ParteDiarioOption,
    ParteDiarioV3State,
)
from app.db import engine
from app.models import CRMContacto, CRMOportunidad, EstadoParteDiario, ParteDiario, Proyecto
from app.services.parte_diario_service import parte_diario_service

logger = logging.getLogger(__name__)


class ParteDiarioSubprocess:
    name = "parteDiario"

    def __init__(self, llm_client: ParteDiarioLLMClient | None = None) -> None:
        self._llm = llm_client or ParteDiarioLLMClient()

    async def handle(self, message: V3InboundMessage, context: V3ConversationContext) -> V3ProcessResult:
        state = ParteDiarioV3State.from_dict(context.process_state)
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

        if is_date_menu_command:
            return self._show_date_menu(context, state)

        if state.etapa == "seleccionar_fecha":
            return self._handle_fecha_selection(command, context, state)

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
            nominas_proyecto, _ = process._load_nominas(int(state.proyecto_id or 0))
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
        state.opciones_fecha = self._build_fecha_options(int(state.proyecto_id))
        return self._active_result(
            context,
            state,
            _render_fecha_menu(state.opciones_fecha, prefix=prefix),
            status,
            extra_metadata,
        )

    def _handle_fecha_selection(
        self,
        command: str,
        context: V3ConversationContext,
        state: ParteDiarioV3State,
    ) -> V3ProcessResult:
        if command in {"salir"}:
            return _return_to_general(context, source="parte_diario_fecha_menu")

        try:
            selected_option = int(command)
        except ValueError:
            return self._active_result(
                context,
                state,
                _render_fecha_menu(state.opciones_fecha, prefix="No pude interpretar la opcion."),
                "invalid_date_selection",
            )

        selected = next((option for option in state.opciones_fecha if option.opcion == selected_option), None)
        if selected is None:
            return self._active_result(
                context,
                state,
                _render_fecha_menu(state.opciones_fecha, prefix="Opcion invalida."),
                "invalid_date_selection",
            )

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
        if selected.estado == "cerrado":
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
            state.opciones_fecha = self._build_fecha_options(int(state.proyecto_id or 0)) if state.proyecto_id else []
            return self._active_result(
                context,
                state,
                _render_fecha_menu(state.opciones_fecha, prefix=error),
                "date_not_editable",
            )
        if not reply_on_success:
            return None
        draft = state.draft()
        return self._active_result(
            context,
            state,
            _with_load_menu(_selected_fecha_reply(draft, _draft_status(draft)), draft),
            "date_loaded",
            {"fecha": draft.fecha, "parte_id": draft.parte_id},
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
            return self._active_result(
                context,
                state,
                _with_load_menu("Volvemos a la carga del parte diario.", state.draft()),
                "exit_cancelled",
            )

        return self._active_result(
            context,
            state,
            _salida_confirmacion(),
            "invalid_exit_confirmation",
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
                draft.sin_novedades_informado = True
                state.set_draft(draft)
            return await self._handle_parte_diario(message, context, state, forced_text="CERRAR")

        if command in {"salir", "3"}:
            state.etapa = "confirmar_salida"
            return self._active_result(
                context,
                state,
                _salida_confirmacion(),
                "exit_confirmation",
            )

        if command in {"volver"}:
            state.etapa = "carga"
            return self._active_result(
                context,
                state,
                _with_load_menu("Volvemos a la carga del parte diario. Indica nuevas novedades o modificaciones.", draft),
                "back_to_load",
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
            )

        payload = _save_payload(draft, cerrar_parte=False)
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
            except Exception:
                logger.exception("Error guardando borrador de parte diario desde agente v3")
                return self._active_result(
                    context,
                    state,
                    _with_load_menu("No pude guardar el parte diario. Proba nuevamente.", draft),
                    "persistence_error",
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
                is_project=True,
                active_process="parte_diario",
                process_state=state.parte_state,
                message=SimpleNamespace(contenido=mapped_text),
            )
            process = ParteDiarioProcess(session=session, llm_client=_llm_for_stage(self._llm, state.etapa))
            process_result = await process.handle(process_context)
            payload = dict(process_result.payload or {})

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
                except Exception:
                    logger.exception("Error creando parte diario confirmado desde agente v3")
                    return self._active_result(
                        context,
                        state,
                        "No pude guardar el parte diario. Proba nuevamente.",
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
                    payload.get("reply_to_user") or f"Parte diario registrado #{parte.id}.",
                    "confirmed",
                    {
                        "process_name": self.name,
                        "parte_listo": True,
                        "parte_diario_id": parte.id,
                        "mensaje_origen_id": parte.mensaje_origen_id,
                        "result": payload,
                    },
                )

        if process_result.keep_active and not payload.get("cancelado"):
            state.parte_state = dict(process_result.process_state or {})
            return self._active_result(
                context,
                state,
                _format_reply(payload.get("reply_to_user") or "", state, payload),
                _status_from_payload(payload),
                {"result": payload},
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
                oportunidades = session.exec(
                    select(CRMOportunidad).where(CRMOportunidad.contacto_id == contact.id)
                ).all()
                for oportunidad in oportunidades:
                    proyecto = session.exec(
                        select(Proyecto).where(Proyecto.oportunidad_id == oportunidad.id).limit(1)
                    ).first()
                    if proyecto is None or proyecto.id is None or oportunidad.id is None or contact.id is None:
                        continue
                    options.append(
                        ParteDiarioOption(
                            opcion=len(options) + 1,
                            nombre=proyecto.nombre or oportunidad.titulo or f"Obra {proyecto.id}",
                            contacto_id=int(contact.id),
                            oportunidad_id=int(oportunidad.id),
                            proyecto_id=int(proyecto.id),
                        )
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
    def _build_fecha_options(proyecto_id: int) -> list[ParteDiarioFechaOption]:
        today = _today()
        dates = [today - timedelta(days=offset) for offset in range(7)]
        with Session(engine) as session:
            partes = session.exec(
                select(ParteDiario)
                .where(ParteDiario.idproyecto == proyecto_id)
                .where(ParteDiario.fecha.in_(dates))
                .where(ParteDiario.deleted_at.is_(None))
            ).all()
        by_date = {parte.fecha: parte for parte in partes}
        options: list[ParteDiarioFechaOption] = []
        for index, target_date in enumerate(dates, start=1):
            parte = by_date.get(target_date)
            if parte is None:
                status = "sin cargar"
                parte_id = None
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


def _render_fecha_menu(options: list[ParteDiarioFechaOption], *, prefix: str | None = None) -> str:
    lines = ["Selecciona la fecha del parte diario:"]
    if prefix:
        lines.insert(0, prefix)
    lines.extend(_format_fecha_option(option) for option in options)
    lines.append("Responde con el numero de una fecha o SALIR para volver al menu general.")
    return "\n".join(lines)


def _format_fecha_option(option: ParteDiarioFechaOption) -> str:
    target_date = date.fromisoformat(option.fecha)
    return f"{option.opcion}: {target_date.strftime('%d/%m/%Y')} {_weekday_label(target_date)} ({option.estado})"


def _weekday_label(value: date) -> str:
    return ["lun", "mar", "mie", "jue", "vie", "sab", "dom"][value.weekday()]


def _selected_fecha_reply(draft, status: str) -> str:
    if status == "borrador" and draft.parte_id:
        return f"Parte diario borrador recuperado:\nFecha: {draft.fecha}\n\n{renderer.resumen(draft)}"
    return f"Parte diario en carga:\nFecha: {draft.fecha}\n\n{renderer.resumen(draft)}"


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
    if draft.esperando in {"confirmacion_ambiguos", "resolucion_conflictos"}:
        state.etapa = "validacion"
        return reply
    status = _status_from_payload(payload)
    if status == "confirmation_required" or "Parte diario para confirmar:" in reply:
        state.etapa = "cierre"
        return _replace_tail(reply, _close_menu())
    if status == "cancel_confirmation_required":
        state.etapa = "confirmar_salida"
        return _salida_confirmacion()
    if status in {"updated", "sin_novedades", "shown", "shown_nomina", "clarification", "waiting"}:
        state.etapa = "carga"
        return _with_load_menu(reply, state.draft())
    return reply


def _with_load_menu(reply: str, draft=None) -> str:
    return _replace_tail(reply, _main_menu())


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
    return "Se perderan los cambios no guardados.\n\nOpciones: 1:OK 2:VOLVER."


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
            "operations": ["guardar" if not cerrar_parte else "cerrar"],
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
    return draft.esperando in {"confirmacion_ambiguos", "resolucion_conflictos", "confirmacion_cambio_fecha"}


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
