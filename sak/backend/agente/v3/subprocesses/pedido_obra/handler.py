"""Handler minimo de pedidoObra v3."""

from __future__ import annotations

import logging
import re
import time

from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult
from agente.v3.orchestrator.process_selector import PROCESS_PEDIDO_OBRA
from agente.v3.subprocesses.pedido_obra import renderer
from agente.v3.subprocesses.pedido_obra.interpreter import (
    PedidoObraOperation,
    normalize_command,
    parse_quantity_answer,
)
from agente.v3.subprocesses.pedido_obra.llm_client import PedidoObraCargaLLMClient
from agente.v3.subprocesses.pedido_obra.state import PedidoObraItem, PedidoObraOption, PedidoObraState
from app.db import engine
from app.models import CRMContacto, CRMOportunidad, Proyecto
from app.services.constructora_pedido_service import constructora_pedido_service

logger = logging.getLogger(__name__)


class PedidoObraSubprocess:
    name = PROCESS_PEDIDO_OBRA

    def __init__(self, llm_client: PedidoObraCargaLLMClient | None = None) -> None:
        self._llm = llm_client or PedidoObraCargaLLMClient()

    async def handle(self, message: V3InboundMessage, context: V3ConversationContext) -> V3ProcessResult:
        state = PedidoObraState.from_dict(context.process_state)
        command = normalize_command(message.text)

        if state.etapa == "inicial" and not state.has_resolved_obra():
            initial_result = self._handle_inicial(message, command, context, state)
            if initial_result is not None:
                return initial_result

        if state.etapa == "confirmar_salida":
            return self._handle_confirmar_salida(command, context, state)

        if state.etapa == "validacion":
            return self._handle_validacion(message, command, context, state)

        if state.etapa == "cierre":
            return await self._handle_cierre(message, command, context, state)

        return await self._handle_carga(message, command, context, state)

    def _handle_inicial(
        self,
        message: V3InboundMessage,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult | None:
        if state.opciones_obra:
            try:
                selected_option = int(command)
            except ValueError:
                return self._active_result(context, state, renderer.comando_invalido(state.etapa), "invalid_obra_selection")

            for option in state.opciones_obra:
                if option.opcion == selected_option:
                    state.set_obra(option)
                    return self._active_result(context, state, renderer.obra_seleccionada(state), "obra_selected")
            return self._active_result(context, state, renderer.comando_invalido(state.etapa), "invalid_obra_selection")

        options = self._resolve_obra_options(message.from_address)
        if not options:
            state.etapa = "finalizado"
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text=renderer.obra_no_encontrada(),
                metadata={"process_name": self.name, "status": "obra_not_found"},
            )

        if len(options) == 1:
            state.set_obra(options[0])
            return None

        state.etapa = "inicial"
        state.opciones_obra = options
        return self._active_result(context, state, renderer.seleccionar_obra(state), "obra_selection_required")

    async def _handle_carga(
        self,
        message: V3InboundMessage,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"fin", "1"}:
            return self._run_validation(context, state)

        if command in {"salir", "2"}:
            state.etapa = "confirmar_salida"
            return self._active_result(context, state, renderer.pedir_confirmacion_salida(state), "exit_confirmation")

        operations, interpreter_metadata = await self._interpret_carga(message, state)
        if not operations:
            return self._active_result(
                context,
                state,
                renderer.carga_sin_cambios(),
                "no_operations",
                interpreter_metadata,
            )

        applied = self._apply_operations(state, operations)
        if not applied:
            return self._active_result(
                context,
                state,
                renderer.carga_sin_cambios(),
                "no_operations",
                interpreter_metadata,
            )

        state.etapa = "carga"
        state.pendiente_item_id = None
        state.pendientes_validacion = []
        return self._active_result(
            context,
            state,
            renderer.carga_actualizada(state),
            "updated",
            {"operations": applied, **interpreter_metadata},
        )

    async def _interpret_carga(
        self,
        message: V3InboundMessage,
        state: PedidoObraState,
    ) -> tuple[list[PedidoObraOperation], dict]:
        operations, llm_ms = await self._llm.interpret_carga(message.text, state)
        logger.info(
            "v3_pedido_obra_llm_timing external_message_id=%s etapa=carga operations=%s llm_ms=%s",
            message.external_message_id,
            len(operations),
            llm_ms,
        )
        return operations, {"interpreter": "llm", "llm_ms": llm_ms}

    def _handle_confirmar_salida(
        self,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"volver", "1"}:
            state.etapa = "carga"
            return self._active_result(context, state, renderer.salida_cancelada(state), "exit_cancelled")

        if command in {"confirmar", "2"}:
            state.etapa = "finalizado"
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text=renderer.pedido_descartado(),
                metadata={"process_name": self.name, "status": "discarded"},
            )

        return self._active_result(context, state, renderer.comando_invalido(state.etapa), "invalid_command")

    def _handle_validacion(
        self,
        message: V3InboundMessage,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"salir", "2"}:
            state.etapa = "confirmar_salida"
            return self._active_result(context, state, renderer.pedir_confirmacion_salida(state), "exit_confirmation")

        if command in {"volver", "1"}:
            state.etapa = "carga"
            state.pendiente_item_id = None
            state.pendientes_validacion = []
            return self._active_result(context, state, renderer.salida_cancelada(state), "back_to_load")

        pending_validation = state.current_validation_pending()
        pending = state.find_item(pending_validation.item_id if pending_validation else state.pendiente_item_id)
        quantity = parse_quantity_answer(message.text)
        if pending_validation is not None and pending is not None and quantity is not None:
            pending.cantidad = quantity.cantidad
            if quantity.unidad:
                pending.unidad = quantity.unidad
            state.complete_current_validation()
            return self._continue_validation(context, state)

        return self._active_result(context, state, renderer.comando_invalido(state.etapa), "invalid_validation_reply")

    async def _handle_cierre(
        self,
        message: V3InboundMessage,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"confirmar", "1"}:
            try:
                pedido = self._crear_pedido_confirmado(message, context, state)
            except Exception:
                logger.exception("Error creando pedido de obra confirmado desde agente v3")
                return self._active_result(context, state, renderer.error_confirmacion(), "persistence_error")

            state.etapa = "finalizado"
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text=renderer.confirmado(state, pedido.id),
                metadata={
                    "process_name": self.name,
                    "status": "confirmed",
                    "pedido_listo": True,
                    "pedido_obra_id": pedido.id,
                    "mensaje_origen_id": pedido.mensaje_origen_id,
                    "items": [item.to_dict() for item in state.items],
                },
            )

        if command in {"volver", "2"}:
            state.etapa = "carga"
            state.pendiente_item_id = None
            state.pendientes_validacion = []
            return self._active_result(context, state, renderer.salida_cancelada(state), "back_to_load")

        if command in {"salir", "3"}:
            state.etapa = "confirmar_salida"
            return self._active_result(context, state, renderer.pedir_confirmacion_salida(state), "exit_confirmation")

        operations, interpreter_metadata = await self._interpret_cierre(message, state)
        if not operations:
            return self._active_result(
                context,
                state,
                renderer.comando_invalido(state.etapa),
                "invalid_close_reply",
                interpreter_metadata,
            )

        applied = self._apply_operations(state, operations)
        if not applied:
            return self._active_result(
                context,
                state,
                renderer.comando_invalido(state.etapa),
                "invalid_close_reply",
                interpreter_metadata,
            )

        if applied == ["show"]:
            return self._active_result(
                context,
                state,
                renderer.cierre_pedido(state),
                "shown",
                {"operations": applied, **interpreter_metadata},
            )

        return self._run_validation(context, state)

    async def _interpret_cierre(
        self,
        message: V3InboundMessage,
        state: PedidoObraState,
    ) -> tuple[list[PedidoObraOperation], dict]:
        operations, llm_ms = await self._llm.interpret_cierre(message.text, state)
        logger.info(
            "v3_pedido_obra_llm_timing external_message_id=%s etapa=cierre operations=%s llm_ms=%s",
            message.external_message_id,
            len(operations),
            llm_ms,
        )
        return operations, {"interpreter": "llm", "llm_ms": llm_ms}

    def _run_validation(self, context: V3ConversationContext, state: PedidoObraState) -> V3ProcessResult:
        if not state.items:
            state.etapa = "carga"
            return self._active_result(context, state, renderer.pedido_vacio(), "empty_order")

        state.rebuild_validation_pendings()
        return self._continue_validation(context, state)

    def _continue_validation(self, context: V3ConversationContext, state: PedidoObraState) -> V3ProcessResult:
        pending_validation = state.current_validation_pending()
        if pending_validation is not None:
            missing = state.find_item(pending_validation.item_id)
            if missing is None:
                state.complete_current_validation()
                return self._continue_validation(context, state)
            state.etapa = "validacion"
            return self._active_result(context, state, renderer.pedir_cantidad(missing), "missing_required")

        state.etapa = "cierre"
        state.pendiente_item_id = None
        state.pendientes_validacion = []
        return self._active_result(context, state, renderer.cierre_pedido(state), "ready_to_confirm")

    def _active_result(
        self,
        context: V3ConversationContext,
        state: PedidoObraState,
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

    def _apply_operations(self, state: PedidoObraState, operations: list[PedidoObraOperation]) -> list[str]:
        applied: list[str] = []
        for operation in operations:
            if operation.type == "insert" and operation.descripcion:
                state.items.append(
                    PedidoObraItem(
                        descripcion=operation.descripcion,
                        cantidad=operation.cantidad,
                        unidad=operation.unidad,
                    )
                )
                applied.append("insert")
            elif operation.type == "delete" and operation.target:
                if self._delete_item(state, operation.target):
                    applied.append("delete")
            elif operation.type == "update" and operation.target:
                if self._update_item(state, operation):
                    applied.append("update")
            elif operation.type == "clear":
                state.items.clear()
                applied.append("clear")
            elif operation.type == "show":
                applied.append("show")
        return applied

    @staticmethod
    def _crear_pedido_confirmado(
        message: V3InboundMessage,
        context: V3ConversationContext,
        state: PedidoObraState,
    ):
        started = time.perf_counter()
        with Session(engine) as session:
            pedido = constructora_pedido_service.create_from_agent_v3_confirmation(
                session,
                contacto_id=int(state.contacto_id or 0),
                oportunidad_id=int(state.oportunidad_id or 0),
                proyecto_id=state.proyecto_id,
                items=[item.to_dict() for item in state.items],
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
        logger.info(
            "v3_pedido_obra_persist_timing external_message_id=%s pedido_obra_id=%s items=%s persist_ms=%s",
            message.external_message_id,
            pedido.id,
            len(state.items),
            round((time.perf_counter() - started) * 1000, 3),
        )
        return pedido

    @staticmethod
    def _delete_item(state: PedidoObraState, target: str) -> bool:
        normalized = normalize_command(target)
        for index, item in enumerate(state.items):
            if normalized and normalized in normalize_command(item.descripcion):
                state.items.pop(index)
                return True
        return False

    @staticmethod
    def _update_item(state: PedidoObraState, operation: PedidoObraOperation) -> bool:
        normalized = normalize_command(operation.target)
        for item in state.items:
            if normalized and normalized in normalize_command(item.descripcion):
                if operation.descripcion:
                    item.descripcion = operation.descripcion
                if operation.cantidad is not None:
                    item.cantidad = operation.cantidad
                if operation.unidad:
                    item.unidad = operation.unidad
                return True
        return False

    @staticmethod
    def _resolve_obra_options(phone: str) -> list[PedidoObraOption]:
        started = time.perf_counter()
        normalized_phone = _normalize_phone(phone)
        if not normalized_phone:
            logger.info("v3_pedido_obra_resolve_obra_timing phone_empty=true total_ms=%s", 0)
            return []
        with Session(engine) as session:
            t_session = time.perf_counter()
            contacts = session.exec(select(CRMContacto)).all()
            t_contacts = time.perf_counter()
            matched_contacts = [
                contact
                for contact in contacts
                if any(_normalize_phone(value) == normalized_phone for value in (contact.telefonos or []))
            ]
            t_match = time.perf_counter()
            options: list[PedidoObraOption] = []
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
                        PedidoObraOption(
                            opcion=len(options) + 1,
                            nombre=proyecto.nombre or oportunidad.titulo or f"Obra {proyecto.id}",
                            contacto_id=int(contact.id),
                            oportunidad_id=int(oportunidad.id),
                            proyecto_id=int(proyecto.id),
                        )
                    )
            finished = time.perf_counter()
            logger.info(
                "v3_pedido_obra_resolve_obra_timing phone=%s contacts=%s matched_contacts=%s options=%s "
                "session_ms=%s contacts_query_ms=%s match_ms=%s options_ms=%s total_ms=%s",
                normalized_phone,
                len(contacts),
                len(matched_contacts),
                len(options),
                round((t_session - started) * 1000, 3),
                round((t_contacts - t_session) * 1000, 3),
                round((t_match - t_contacts) * 1000, 3),
                round((finished - t_match) * 1000, 3),
                round((finished - started) * 1000, 3),
            )
            return options


def _normalize_phone(value: str | None) -> str:
    return re.sub(r"\D+", "", str(value or ""))
