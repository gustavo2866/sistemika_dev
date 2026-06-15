"""Handler minimo de pedidoObra v3."""

from __future__ import annotations

import logging
import re
import time
from decimal import Decimal

from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult
from agente.v3.subprocesses.general_agent import GENERAL_MENU_TEXT
from agente.v3.subprocesses.pedido_obra import renderer
from agente.v3.subprocesses.pedido_obra.interpreter import (
    PedidoObraOperation,
    normalize_command,
    parse_quantity_answer,
)
from agente.v3.subprocesses.pedido_obra.llm_client import PedidoObraCargaLLMClient
from agente.v3.subprocesses.pedido_obra.state import (
    PedidoObraItem,
    PedidoObraOption,
    PedidoObraPedidoOption,
    PedidoObraState,
)
from app.db import engine
from app.models import CRMContacto, CRMOportunidad, Proyecto
from app.models.constructora.pedido import (
    ConstructoraPedido,
    ConstructoraPedidoDetalle,
    PedidoObraDetalleEstado,
    PedidoObraEstado,
)
from app.services.constructora_pedido_service import constructora_pedido_service

logger = logging.getLogger(__name__)


class PedidoObraSubprocess:
    name = "pedidoObra"

    def __init__(self, llm_client: PedidoObraCargaLLMClient | None = None) -> None:
        self._llm = llm_client or PedidoObraCargaLLMClient()

    async def handle(self, message: V3InboundMessage, context: V3ConversationContext) -> V3ProcessResult:
        state = PedidoObraState.from_dict(context.process_state)
        command = normalize_command(message.text)
        is_pedido_menu_command = _is_pedido_menu_command(command)

        if state.etapa == "inicial" and not state.has_resolved_obra():
            initial_result = self._handle_inicial(
                message,
                command,
                context,
                state,
                show_pedido_menu=is_pedido_menu_command,
            )
            if initial_result is not None:
                return initial_result

        if state.pedido_id is not None and state.pedido_estado == PedidoObraEstado.CERRADO.value:
            state.etapa = "pedido_readonly"
            return self._handle_pedido_readonly(command, context, state)

        if state.etapa == "pedido_readonly":
            return self._handle_pedido_readonly(command, context, state)

        if is_pedido_menu_command:
            return self._show_pedido_menu(context, state)

        if state.etapa == "seleccionar_pedido":
            return self._handle_pedido_selection(command, context, state)

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
        *,
        show_pedido_menu: bool,
    ) -> V3ProcessResult | None:
        if state.opciones_obra:
            try:
                selected_option = int(command)
            except ValueError:
                return self._active_result(context, state, renderer.comando_invalido(state.etapa), "invalid_obra_selection")

            for option in state.opciones_obra:
                if option.opcion == selected_option:
                    should_show_pedido_menu = show_pedido_menu or state.pedido_menu_pendiente
                    state.set_obra(option)
                    if should_show_pedido_menu:
                        return self._show_pedido_menu(context, state)
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
            if show_pedido_menu:
                return self._show_pedido_menu(context, state)
            return None

        state.etapa = "inicial"
        state.opciones_obra = options
        state.pedido_menu_pendiente = show_pedido_menu
        return self._active_result(context, state, renderer.seleccionar_obra(state), "obra_selection_required")

    def _show_pedido_menu(
        self,
        context: V3ConversationContext,
        state: PedidoObraState,
        *,
        prefix: str | None = None,
        status: str = "pedido_selection_required",
        extra_metadata: dict | None = None,
    ) -> V3ProcessResult:
        if not state.oportunidad_id:
            return self._closed_result(context, renderer.obra_no_encontrada(), "obra_not_found")
        state.etapa = "seleccionar_pedido"
        state.pedido_menu_pendiente = False
        state.opciones_pedido = self._build_pedido_options(int(state.oportunidad_id))
        return self._active_result(
            context,
            state,
            renderer.menu_pedidos(state.opciones_pedido, prefix=prefix),
            status,
            extra_metadata,
        )

    def _handle_pedido_selection(
        self,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"salir"}:
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text=GENERAL_MENU_TEXT,
                metadata={"process_name": self.name, "status": "returned_to_general"},
            )

        if command in {"nuevo"}:
            state.etapa = "carga"
            state.pedido_id = None
            state.pedido_estado = None
            state.opciones_pedido = []
            state.items = []
            return self._active_result(context, state, renderer.obra_seleccionada(state), "new_order")

        try:
            selected_option = int(command)
        except ValueError:
            return self._active_result(
                context,
                state,
                renderer.menu_pedidos(state.opciones_pedido, prefix="No pude interpretar la opcion."),
                "invalid_pedido_selection",
            )

        selected = next((option for option in state.opciones_pedido if option.opcion == selected_option), None)
        if selected is None:
            return self._active_result(
                context,
                state,
                renderer.menu_pedidos(state.opciones_pedido, prefix="Opcion invalida."),
                "invalid_pedido_selection",
            )

        with Session(engine) as session:
            pedido = session.get(ConstructoraPedido, selected.pedido_id)
            if pedido is None or pedido.deleted_at is not None:
                state.opciones_pedido = self._build_pedido_options(int(state.oportunidad_id or 0))
                return self._active_result(
                    context,
                    state,
                    renderer.menu_pedidos(state.opciones_pedido, prefix="El pedido seleccionado ya no existe."),
                    "pedido_not_found",
                )
            items = self._load_pedido_items(session, int(pedido.id))

        state.pedido_id = int(selected.pedido_id)
        state.pedido_estado = selected.estado
        state.items = items
        state.opciones_pedido = []
        if selected.estado == PedidoObraEstado.BORRADOR.value:
            state.etapa = "carga"
            return self._active_result(
                context,
                state,
                renderer.pedido_borrador_recuperado(state),
                "pedido_loaded",
                {"pedido_obra_id": selected.pedido_id},
            )

        if selected.estado == PedidoObraEstado.CERRADO.value:
            state.etapa = "pedido_readonly"
            return self._active_result(
                context,
                state,
                renderer.consulta_pedido_readonly(selected.pedido_id, selected.estado, items),
                "pedido_readonly",
                {"pedido_obra_id": selected.pedido_id},
            )

        state.etapa = "seleccionar_pedido"
        return self._active_result(
            context,
            state,
            renderer.consulta_pedido(selected.pedido_id, selected.estado, items),
            "pedido_readonly",
            {"pedido_obra_id": selected.pedido_id},
        )

    def _handle_pedido_readonly(
        self,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"salir", "3"}:
            state.pedido_id = None
            state.pedido_estado = None
            state.items = []
            state.opciones_pedido = []
            return self._show_pedido_menu(
                context,
                state,
                status="pedido_readonly_exit_to_menu",
                prefix=None,
            )

        return self._active_result(
            context,
            state,
            renderer.pedido_no_modificable(),
            "pedido_readonly_invalid_command",
            {"pedido_obra_id": state.pedido_id},
        )

    async def _handle_carga(
        self,
        message: V3InboundMessage,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"guardar", "grabar", "1"}:
            state.accion_pendiente = "guardar"
            return self._run_validation(context, state)

        if command in {"cerrar", "fin", "2"}:
            state.accion_pendiente = "cerrar"
            return self._run_validation(context, state)

        if command in {"salir", "3"}:
            if state.pedido_id is not None and state.pedido_estado == PedidoObraEstado.BORRADOR.value:
                state.pedido_id = None
                state.pedido_estado = None
                state.items = []
                state.opciones_pedido = []
                state.accion_pendiente = None
                state.pendiente_item_id = None
                state.pendientes_validacion = []
                return self._show_pedido_menu(
                    context,
                    state,
                    status="pedido_draft_exit_to_menu",
                )
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
        if command in {"ok", "1"}:
            state.etapa = "finalizado"
            updated = context.copy()
            updated.active_process = None
            updated.process_state = {}
            return V3ProcessResult(
                context=updated,
                reply_text=renderer.pedido_descartado(),
                metadata={"process_name": self.name, "status": "discarded"},
            )

        if command in {"volver", "2"}:
            state.etapa = "carga"
            return self._active_result(context, state, renderer.salida_cancelada(state), "exit_cancelled")

        return self._active_result(context, state, renderer.comando_invalido(state.etapa), "invalid_command")

    def _handle_validacion(
        self,
        message: V3InboundMessage,
        command: str,
        context: V3ConversationContext,
        state: PedidoObraState,
    ) -> V3ProcessResult:
        if command in {"salir"}:
            state.etapa = "confirmar_salida"
            return self._active_result(context, state, renderer.pedir_confirmacion_salida(state), "exit_confirmation")

        if command in {"volver"}:
            state.etapa = "carga"
            state.pendiente_item_id = None
            state.pendientes_validacion = []
            state.accion_pendiente = None
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
        if command in {"ok", "confirmar", "1"}:
            cerrar_pedido = state.accion_pendiente != "guardar"
            try:
                pedido = self._crear_pedido_confirmado(message, context, state, cerrar_pedido=cerrar_pedido)
            except Exception:
                logger.exception("Error creando pedido de obra confirmado desde agente v3")
                return self._active_result(context, state, renderer.error_confirmacion(), "persistence_error")

            status = "closed" if cerrar_pedido else "saved"
            confirmation = renderer.confirmado(state, pedido.id, cerrado=cerrar_pedido)
            metadata = {
                "process_name": self.name,
                "status": status,
                "pedido_listo": True,
                "cerrar_pedido": cerrar_pedido,
                "pedido_obra_id": pedido.id,
                "mensaje_origen_id": pedido.mensaje_origen_id,
                "items": [item.to_dict() for item in state.items],
            }
            state.pedido_id = None
            state.pedido_estado = None
            state.items = []
            state.opciones_pedido = []
            state.accion_pendiente = None
            state.pendiente_item_id = None
            state.pendientes_validacion = []
            return self._show_pedido_menu(
                context=context,
                state=state,
                prefix=confirmation,
                status=status,
                extra_metadata=metadata,
            )

        if command in {"volver", "2"}:
            state.etapa = "carga"
            state.pendiente_item_id = None
            state.pendientes_validacion = []
            state.accion_pendiente = None
            return self._active_result(context, state, renderer.salida_cancelada(state), "back_to_load")

        if command in {"salir"}:
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
        if state.accion_pendiente is None:
            state.accion_pendiente = "cerrar"
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

    def _closed_result(self, context: V3ConversationContext, reply: str, status: str) -> V3ProcessResult:
        updated = context.copy()
        updated.active_process = None
        updated.process_state = {}
        return V3ProcessResult(
            context=updated,
            reply_text=reply,
            metadata={"process_name": self.name, "status": status},
        )

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
        *,
        cerrar_pedido: bool,
    ):
        started = time.perf_counter()
        with Session(engine) as session:
            pedido = constructora_pedido_service.create_from_agent_v3_confirmation(
                session,
                pedido_id=state.pedido_id,
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
                cerrar_pedido=cerrar_pedido,
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

    @staticmethod
    def _build_pedido_options(oportunidad_id: int) -> list[PedidoObraPedidoOption]:
        if oportunidad_id <= 0:
            return []
        with Session(engine) as session:
            pedidos = session.exec(
                select(ConstructoraPedido)
                .where(ConstructoraPedido.oportunidad_id == oportunidad_id)
                .where(ConstructoraPedido.deleted_at.is_(None))
                .order_by(ConstructoraPedido.created_at.desc())
                .limit(10)
            ).all()
        return [
            PedidoObraPedidoOption(
                opcion=index,
                pedido_id=int(pedido.id),
                estado=str(pedido.estado.value if hasattr(pedido.estado, "value") else pedido.estado),
                created_at=pedido.created_at.isoformat() if pedido.created_at else None,
            )
            for index, pedido in enumerate(pedidos, start=1)
            if pedido.id is not None
        ]

    @staticmethod
    def _load_pedido_items(session: Session, pedido_id: int) -> list[PedidoObraItem]:
        detalles = session.exec(
            select(ConstructoraPedidoDetalle)
            .where(ConstructoraPedidoDetalle.pedido_id == pedido_id)
            .where(ConstructoraPedidoDetalle.deleted_at.is_(None))
            .where(ConstructoraPedidoDetalle.estado == PedidoObraDetalleEstado.ACTIVA)
            .order_by(ConstructoraPedidoDetalle.orden.asc(), ConstructoraPedidoDetalle.id.asc())
        ).all()
        items: list[PedidoObraItem] = []
        for detalle in detalles:
            descripcion = str(detalle.descripcion or detalle.descripcion_original or "").strip()
            if not descripcion:
                continue
            cantidad = float(detalle.cantidad) if isinstance(detalle.cantidad, Decimal) else float(detalle.cantidad or 0)
            items.append(
                PedidoObraItem(
                    descripcion=descripcion,
                    cantidad=cantidad,
                    unidad=detalle.unidad_medida,
                    item_id=str((detalle.metadata_json or {}).get("agent_item_id") or detalle.id or ""),
                )
            )
        return items


def _normalize_phone(value: str | None) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def _is_pedido_menu_command(command: str) -> bool:
    return command in {"pedido obra", "pedido obras", "pedidos obra", "pedidos de obra"}
