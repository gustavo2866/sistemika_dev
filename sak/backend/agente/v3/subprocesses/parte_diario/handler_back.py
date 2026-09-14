"""Handler de parteDiario v3."""

from __future__ import annotations

import logging
import re
from datetime import date

from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessMessage, V3ProcessResult
from agente.v3.emisor import V3MessageEmitter
from agente.v3.subprocesses.general_agent import GENERAL_MENU_TEXT
from agente.v3.subprocesses.parte_diario.adapters.carga_agent import ParteDiarioCargaAgentClient
from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.adapters.query_agent import ParteDiarioQueryAgentClient
from agente.v3.subprocesses.parte_diario.adapters.whatsapp import (
    InteractiveButton,
    InteractiveListRow,
    whatsapp_buttons,
    whatsapp_list,
)
from agente.v3.subprocesses.parte_diario.domain import obras as obras_domain
from agente.v3.subprocesses.parte_diario.domain import parte_diario as parte_diario_domain
from agente.v3.subprocesses.parte_diario.flows.apoyos import ParteDiarioApoyosFlowMixin
from agente.v3.subprocesses.parte_diario.flows.carga import ParteDiarioCargaFlowMixin
from agente.v3.subprocesses.parte_diario.flows.fecha import ParteDiarioFechaFlowMixin
from agente.v3.subprocesses.parte_diario.flows.listado import ParteDiarioListadoFlowMixin
from agente.v3.subprocesses.parte_diario.flows.validacion_carga import ParteDiarioValidacionCargaFlowMixin
from agente.v3.subprocesses.parte_diario.utils.calendario import (
    dia_operativo_anterior,
    es_dia_laborable,
    es_feriado,
)
from agente.v3.subprocesses.parte_diario.utils import renderer
from agente.v3.subprocesses.parte_diario.models import (
    ParteDiarioState as ParteDiarioDraftState,
)
from agente.v3.subprocesses.parte_diario.domain.parte_diario import (
    _has_explicit_date_reference,
    _normalize_command,
    _today,
)
from agente.v3.subprocesses.parte_diario.domain.empleados import (
    normalize_text,
    project_match_score,
)
from agente.v3.subprocesses.parte_diario.state import (
    ParteDiarioFechaOption,
    ParteDiarioOption,
    ParteDiarioV3State,
)
from app.db import engine
from app.models import CRMContacto

logger = logging.getLogger(__name__)

ASISTENCIA_PAGE_SIZE = 8
_VALIDATION_WAITING_STATES = {"confirmacion_ambiguos", "resolucion_conflictos"}
_VALIDATION_ORIGIN_STAGES = {"carga", "novedades"}


class ParteDiarioSubprocess(
    ParteDiarioValidacionCargaFlowMixin,
    ParteDiarioFechaFlowMixin,
    ParteDiarioCargaFlowMixin,
    ParteDiarioListadoFlowMixin,
    ParteDiarioApoyosFlowMixin,
):
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
            draft = state.draft()
            if _draft_has_carga_validation(draft):
                _activate_carga_validation(state, origin="novedades")
                return await self._handle_validacion(message, context, state)
            return await self._handle_asistencia(message, context, state)

        if state.etapa == "apoyos":
            return self._apoyos_disabled_result(context, state)

        if state.etapa == "confirmar_salida":
            return self._handle_confirmar_salida(message, context, state)

        if state.etapa == "revision":
            return await self._handle_revision(message, context, state)

        if state.etapa == "cierre":
            return await self._handle_cierre(message, context, state)

        if state.etapa in {"validacion", "validacion_carga"}:
            if state.etapa == "validacion":
                state.etapa = "validacion_carga"
            return await self._handle_validacion(message, context, state)

        if state.etapa == "carga":
            draft = state.draft()
            if _draft_has_carga_validation(draft):
                _activate_carga_validation(state, origin="carga")
                return await self._handle_validacion(message, context, state)
            return await self._handle_carga(message, context, state)

        if state.etapa == "menu":
            return self._handle_menu(message, context, state)

        return await self._handle_inicial(message, context, state, emisor=emisor)

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
        return obras_domain.resolver_obras_por_telefono(phone)

    @staticmethod
    def _build_fecha_options(
        proyecto_id: int,
        *,
        contacto_id: int | None = None,
        today: date | None = None,
        days: int = 7,
    ) -> list[ParteDiarioFechaOption]:
        return parte_diario_domain.build_fecha_options(
            proyecto_id,
            contacto_id=contacto_id,
            today=today,
            days=days,
        )


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
    options = ParteDiarioSubprocess._build_fecha_options(
        proyecto_id,
        contacto_id=contacto_id,
        today=today,
    )
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
    return parte_diario_domain.pending_parts_last_days_options(
        state,
        exclude_fechas=exclude_fechas,
        days=days,
    )


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


def _draft_has_carga_validation(draft) -> bool:
    return (
        draft.esperando in _VALIDATION_WAITING_STATES
        or bool(draft.pendientes_ambiguos)
        or bool(draft.conflictos_novedad)
    )


def _activate_carga_validation(
    state: ParteDiarioV3State,
    *,
    origin: str | None = None,
) -> None:
    draft = state.draft()
    resolved_origin = _validation_origin(state, draft, default=origin or "carga")
    if resolved_origin not in _VALIDATION_ORIGIN_STAGES:
        resolved_origin = origin or "carga"
    if draft.esperando not in _VALIDATION_WAITING_STATES:
        if draft.conflictos_novedad:
            draft.esperando = "resolucion_conflictos"
        elif draft.pendientes_ambiguos:
            draft.esperando = "confirmacion_ambiguos"
    draft.validacion_origen = resolved_origin
    state.set_draft(draft)
    state.validacion_origen = resolved_origin
    state.validacion_tipo = _validation_type_from_draft(draft)
    state.etapa = "validacion_carga"


def _clear_carga_validation(state: ParteDiarioV3State, *, next_stage: str | None = None) -> None:
    state.validacion_tipo = None
    state.validacion_origen = None
    if next_stage:
        state.etapa = next_stage  # type: ignore[assignment]


def _validation_origin(state: ParteDiarioV3State, draft, *, default: str = "carga") -> str:
    origin = str(state.validacion_origen or draft.validacion_origen or default or "carga").strip()
    return origin or "carga"


def _validation_return_stage(state: ParteDiarioV3State, draft) -> str:
    origin = _validation_origin(state, draft)
    return "novedades" if origin == "novedades" else "carga"


def _validation_type_from_draft(draft) -> str | None:
    if draft.esperando == "resolucion_conflictos" or draft.conflictos_novedad:
        return "conflicto"
    if not draft.pendientes_ambiguos:
        return None
    pending = draft.pendientes_ambiguos[0]
    if getattr(pending, "obra_destino_pendiente", False):
        return "obra_destino"
    if getattr(pending, "encargado_destino_pendiente", False):
        return "encargado_destino"
    if getattr(pending, "estado_pendiente", False):
        return "estado"
    return "persona"


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
    if state.etapa in {"validacion", "validacion_carga"}:
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
    if getattr(pending, "obra_destino_pendiente", False):
        options = "\n".join(
            f"{option.opcion}. {_destination_option_label(option.nombre)}"
            for option in getattr(pending, "opciones_proyecto_destino", None) or []
        )
        suffix = f"\n\n{options}" if options else ""
        return f"A que obra fue {_display_person_name(pending.nombre)}?{suffix}"
    if getattr(pending, "encargado_destino_pendiente", False):
        options = "; ".join(
            f"{option.opcion}. {option.nombre}"
            for option in getattr(pending, "opciones_encargado_destino", None) or []
        )
        obra = str(getattr(pending, "nombre_proyecto", None) or "").strip()
        obra_text = f" de {obra}" if obra else ""
        suffix = f"\n\n{options}" if options else ""
        return f"A que encargado{obra_text} corresponde {_display_person_name(pending.nombre)}?{suffix}"
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
    text = str(nombre_proyecto or "").strip()
    if text.lower().startswith("obra "):
        return text[5:].strip()[:4].strip().upper() or "OTRA"
    return text[:6].strip() or "OTRA"


def _destination_option_label(value: str | None) -> str:
    text = str(value or "").strip()
    return text[:20].rstrip()


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
