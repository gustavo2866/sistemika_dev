from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session

from agente.v2.core.context_loader import ChatContextLoader
from agente.v2.core.process_registry import ProcessRegistry
from agente.v2.core.runtime import ChatAgentMode, get_chat_agent_mode
from agente.v2.core.state_repository import AgentConversationStateRepository
from agente.v2.core.models import (
    AgentConversationState,
    DeliveryMode,
    ProcessTurnCommand,
    ProcessTurnResult,
    SendResult,
    SendTextCommand,
    TurnTrigger,
    TurnRuntime,
)
from agente.v2.infrastructure.channels.crm_channel_adapter import CRMOutboundChannelAdapter
from app.models import CRMMensaje
from app.models.enums import EstadoMensaje, TipoMensaje


class AgentTurnOrchestrator:
    """Coordina el procesamiento de un turno y su politica de entrega."""

    def __init__(
        self,
        *,
        context_loader: ChatContextLoader,
        agent: Any,
        registry: ProcessRegistry | None = None,
        state_repository: AgentConversationStateRepository | None = None,
        channel_adapter: CRMOutboundChannelAdapter | None = None,
    ) -> None:
        self._context_loader = context_loader
        self._agent = agent
        self._registry = registry or ProcessRegistry([agent])
        self._state_repository = state_repository or getattr(context_loader, "_state_repository", None)
        if self._state_repository is None:
            raise ValueError("El orquestador requiere un repositorio de estado conversacional")
        self._channel_adapter = channel_adapter or CRMOutboundChannelAdapter()

    async def process_turn(
        self,
        session: Session,
        command: ProcessTurnCommand,
    ) -> dict[str, Any]:
        message = session.get(CRMMensaje, command.message_id)
        if not message:
            raise ValueError("Mensaje no encontrado")
        if not message.oportunidad_id:
            raise ValueError("Mensaje sin oportunidad asociada")

        effective_mode = self._resolve_agent_mode(session=session, command=command)
        state = self._state_repository.load(message.oportunidad_id, agent_mode=effective_mode.value)
        runtime = TurnRuntime(
            trigger=command.trigger,
            agent_mode=effective_mode.value,
            delivery_mode=command.delivery_mode,
        )

        try:
            if self._should_defer_webhook_turn(command=command, effective_mode=effective_mode):
                deferred_response, execution_record = self._handle_deferred_webhook_turn(
                    message=message,
                    state=state,
                    command=command,
                    effective_mode=effective_mode,
                    runtime=runtime,
                )
                return self._build_response(
                    result=deferred_response,
                    command=command,
                    delivery={"sent": False, "status": "deferred"},
                    cached=False,
                    process_name=None,
                    execution_audit=execution_record,
                )

            cached = self._load_cached_turn(
                message=message,
                scope_id=message.oportunidad_id,
                command=command,
            )
            if cached is not None:
                if command.delivery_mode == DeliveryMode.PREVIEW_ONLY or cached["delivery"].get("sent"):
                    return self._build_response(
                        result=cached["result"],
                        command=command,
                        delivery=cached["delivery"],
                        cached=True,
                        process_name=cached.get("process_name"),
                        execution_audit=cached.get("execution"),
                    )

                delivery = await self._deliver_result(
                    session=session,
                    message=message,
                    result=cached["result"],
                )
                persisted_state = self._persist_delivery_state(
                    state=state,
                    message=message,
                    effective_mode=effective_mode,
                    delivery=delivery,
                )
                self._mark_inbound_as_processed(session, message)
                execution_record = self._merge_execution_record(
                    cached.get("execution"),
                    delivery=delivery.to_dict(),
                    state=persisted_state,
                )
                self._state_repository.save_turn_execution(message.oportunidad_id, message.id, execution_record)
                self._save_turn_result(
                    session=session,
                    message=message,
                    result=cached["result"],
                    command=command,
                    delivery=delivery.to_dict(),
                    execution_record=execution_record,
                    process_name=cached.get("process_name"),
                )
                return self._build_response(
                    result=cached["result"],
                    command=command,
                    delivery=delivery.to_dict(),
                    cached=True,
                    process_name=cached.get("process_name"),
                    execution_audit=execution_record,
                )

            context = self._context_loader.load_for_message(
                session,
                command.message_id,
                agent_state=state,
                runtime=runtime,
            )
            try:
                handler, activation = self._registry.resolve(
                    context,
                    requested_process=command.requested_process,
                )
            except ValueError as exc:
                no_process_response, persisted_state, execution_record = self._handle_no_process_match(
                    message=message,
                    state=state,
                    command=command,
                    effective_mode=effective_mode,
                    reason=str(exc),
                )
                self._save_turn_result(
                    session=session,
                    message=message,
                    result=no_process_response,
                    command=command,
                    delivery={"sent": False, "status": "skipped"},
                    execution_record=execution_record,
                    process_name=None,
                )
                return self._build_response(
                    result=no_process_response,
                    command=command,
                    delivery={"sent": False, "status": "skipped"},
                    cached=False,
                    process_name=None,
                    execution_audit=execution_record,
                )
            process_result = handler.handle_turn(context)

            persisted_state = self._persist_process_state(
                state=state,
                message=message,
                process_result=process_result,
                effective_mode=effective_mode,
                activation=activation.to_dict(),
                runtime=runtime.to_dict(),
            )

            delivery = SendResult(sent=False, status="preview")
            if command.delivery_mode == DeliveryMode.AUTO_SEND:
                delivery = await self._deliver_result(
                    session=session,
                    message=message,
                    result=process_result.response_payload,
                )
                persisted_state = self._persist_delivery_state(
                    state=persisted_state,
                    message=message,
                    effective_mode=effective_mode,
                    delivery=delivery,
                )
                self._mark_inbound_as_processed(session, message)

            execution_record = self._build_execution_record(
                command=command,
                process_result=process_result,
                state=persisted_state,
                activation=activation.to_dict(),
                runtime=runtime.to_dict(),
                delivery=delivery.to_dict(),
            )
            self._state_repository.save_turn_execution(message.oportunidad_id, message.id, execution_record)
            self._save_turn_result(
                session=session,
                message=message,
                result=process_result.response_payload,
                command=command,
                delivery=delivery.to_dict(),
                execution_record=execution_record,
                process_name=process_result.process_name,
            )

            return self._build_response(
                result=process_result.response_payload,
                command=command,
                delivery=delivery.to_dict(),
                cached=False,
                process_name=process_result.process_name,
                execution_audit=execution_record,
            )
        except Exception as exc:
            self._state_repository.save_turn_execution(
                message.oportunidad_id,
                message.id,
                {
                    "status": "failed",
                    "process_name": state.active_process or command.requested_process,
                    "error": str(exc),
                    "trigger": command.trigger.value,
                    "delivery_mode": command.delivery_mode.value,
                    "finished_at": datetime.now(UTC).isoformat(),
                },
            )
            raise

    @staticmethod
    def _should_defer_webhook_turn(
        *,
        command: ProcessTurnCommand,
        effective_mode: ChatAgentMode,
    ) -> bool:
        return command.trigger == TurnTrigger.WEBHOOK and effective_mode == ChatAgentMode.MANUAL

    def _handle_deferred_webhook_turn(
        self,
        *,
        message: CRMMensaje,
        state: AgentConversationState,
        command: ProcessTurnCommand,
        effective_mode: ChatAgentMode,
        runtime: TurnRuntime,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        persisted_state = state.clone()
        persisted_state.agent_mode = effective_mode.value
        if message.tipo == TipoMensaje.ENTRADA.value:
            persisted_state.last_inbound_message_id = message.id
        persisted_state.metadata["last_deferred_turn"] = {
            "message_id": message.id,
            "reason": "modalidad_manual_en_webhook",
            "trigger": command.trigger.value,
            "delivery_mode": command.delivery_mode.value,
            "runtime": runtime.to_dict(),
            "deferred_at": datetime.now(UTC).isoformat(),
        }
        persisted_state = self._state_repository.save(
            persisted_state,
            expected_version=state.version,
        )

        response_payload = {
            "type": "agent_deferred",
            "skipped": True,
            "reason": "modalidad_manual_en_webhook",
            "agent_mode": effective_mode.value,
        }
        execution_record = {
            "status": "deferred",
            "process_name": None,
            "trigger": command.trigger.value,
            "delivery_mode": command.delivery_mode.value,
            "requested_mode": command.requested_mode,
            "requested_process": command.requested_process,
            "runtime": runtime.to_dict(),
            "audit": {
                "reason": "modalidad_manual_en_webhook",
            },
            "response_payload": response_payload,
            "delivery": {"sent": False, "status": "deferred"},
            "state": persisted_state.to_state_dict(),
            "finished_at": datetime.now(UTC).isoformat(),
        }
        return response_payload, execution_record

    def _handle_no_process_match(
        self,
        *,
        message: CRMMensaje,
        state: AgentConversationState,
        command: ProcessTurnCommand,
        effective_mode: ChatAgentMode,
        reason: str,
    ) -> tuple[dict[str, Any], AgentConversationState, dict[str, Any]]:
        persisted_state = state.clone()
        persisted_state.agent_mode = effective_mode.value
        persisted_state.last_processed_message_id = message.id
        if message.tipo == TipoMensaje.ENTRADA.value:
            persisted_state.last_inbound_message_id = message.id
        persisted_state.metadata["last_no_process_reason"] = reason
        persisted_state = self._state_repository.save(
            persisted_state,
            expected_version=state.version,
        )

        response_payload = {
            "type": "no_process",
            "skipped": True,
            "reason": reason,
        }
        execution_record = {
            "status": "skipped",
            "process_name": None,
            "trigger": command.trigger.value,
            "delivery_mode": command.delivery_mode.value,
            "requested_mode": command.requested_mode,
            "requested_process": command.requested_process,
            "audit": {
                "reason": reason,
            },
            "response_payload": response_payload,
            "delivery": {"sent": False, "status": "skipped"},
            "state": persisted_state.to_state_dict(),
            "finished_at": datetime.now(UTC).isoformat(),
        }
        self._state_repository.save_turn_execution(message.oportunidad_id, message.id, execution_record)
        return response_payload, persisted_state, execution_record

    def _load_cached_turn(
        self,
        *,
        message: CRMMensaje,
        scope_id: int,
        command: ProcessTurnCommand,
    ) -> dict[str, Any] | None:
        if command.force_reprocess:
            return None

        execution_record = self._state_repository.get_turn_execution(scope_id, message.id)
        if execution_record is not None:
            result = execution_record.get("response_payload")
            if isinstance(result, dict):
                delivery = execution_record.get("delivery")
                if not isinstance(delivery, dict):
                    delivery = {"sent": False, "status": "preview"}
                return {
                    "result": result,
                    "delivery": delivery,
                    "execution": execution_record,
                    "process_name": execution_record.get("process_name"),
                }

        metadata = message.metadata_json or {}
        agent_meta = metadata.get("agent_v2")
        if not isinstance(agent_meta, dict):
            return None

        stored_result = agent_meta.get("turn_result")
        if not isinstance(stored_result, dict):
            return None

        stored_delivery = agent_meta.get("delivery")
        if not isinstance(stored_delivery, dict):
            stored_delivery = {"sent": False, "status": "preview"}

        return {
            "result": stored_result,
            "delivery": stored_delivery,
            "execution": agent_meta.get("execution"),
            "process_name": agent_meta.get("process_name"),
        }

    async def _deliver_result(
        self,
        *,
        session: Session,
        message: CRMMensaje,
        result: dict[str, Any],
    ) -> SendResult:
        reply_text = self._extract_reply_text(result)
        if not reply_text:
            return SendResult(sent=False, status="no_reply")

        if not message.contacto_id:
            return SendResult(sent=False, status="missing_contact")
        if not message.oportunidad_id:
            return SendResult(sent=False, status="missing_oportunidad")

        return await self._channel_adapter.send_text(
            session,
            SendTextCommand(
                contenido=reply_text,
                contacto_id=message.contacto_id,
                oportunidad_id=message.oportunidad_id,
                responsable_id=message.responsable_id or (message.oportunidad.responsable_id if message.oportunidad else None),
                contacto_referencia=message.contacto_referencia,
                canal=message.canal,
                metadata={"source_message_id": message.id},
            ),
        )

    @staticmethod
    def _extract_reply_text(result: dict[str, Any]) -> str:
        raw_value = result.get("respuesta")
        if raw_value is None:
            raw_value = result.get("reply")
        if raw_value is None:
            raw_value = result.get("mensaje")
        if raw_value is None:
            raw_value = result.get("texto")
        return str(raw_value or "").strip()

    @staticmethod
    def _mark_inbound_as_processed(session: Session, message: CRMMensaje) -> None:
        if message.tipo != TipoMensaje.ENTRADA.value:
            return
        if message.estado == EstadoMensaje.NUEVO.value:
            message.estado = EstadoMensaje.RECIBIDO.value
            message.fecha_estado = datetime.now(UTC)
            session.add(message)
            session.commit()
            session.refresh(message)

    def _persist_process_state(
        self,
        *,
        state: AgentConversationState,
        message: CRMMensaje,
        process_result: ProcessTurnResult,
        effective_mode: ChatAgentMode,
        activation: dict[str, Any],
        runtime: dict[str, Any],
    ) -> AgentConversationState:
        new_state = state.clone()
        new_state.agent_mode = effective_mode.value
        new_state.last_processed_message_id = message.id
        if message.tipo == TipoMensaje.ENTRADA.value:
            new_state.last_inbound_message_id = message.id

        if process_result.updated_process_state is not None:
            new_state.process_states[process_result.process_name] = dict(process_result.updated_process_state)

        if process_result.keep_process_active:
            new_state.active_process = process_result.process_name
            new_state.active_substate = process_result.next_substate
        elif new_state.active_process == process_result.process_name or new_state.active_process is None:
            new_state.active_process = None
            new_state.active_substate = None

        new_state.metadata.update(
            {
                "last_activation": activation,
                "last_runtime": runtime,
                "last_process_result": process_result.to_audit_dict(),
            }
        )
        return self._state_repository.save(
            new_state,
            expected_version=state.version,
        )

    def _persist_delivery_state(
        self,
        *,
        state: AgentConversationState,
        message: CRMMensaje,
        effective_mode: ChatAgentMode,
        delivery: SendResult,
    ) -> AgentConversationState:
        new_state = state.clone()
        new_state.agent_mode = effective_mode.value
        new_state.last_processed_message_id = message.id
        if message.tipo == TipoMensaje.ENTRADA.value:
            new_state.last_inbound_message_id = message.id
        if delivery.outbound_message_id is not None:
            new_state.last_outbound_message_id = delivery.outbound_message_id
        new_state.metadata["last_delivery"] = delivery.to_dict()
        return self._state_repository.save(
            new_state,
            expected_version=state.version,
        )

    def _build_execution_record(
        self,
        *,
        command: ProcessTurnCommand,
        process_result: ProcessTurnResult,
        state: AgentConversationState,
        activation: dict[str, Any],
        runtime: dict[str, Any],
        delivery: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "status": "completed",
            "process_name": process_result.process_name,
            "trigger": command.trigger.value,
            "delivery_mode": command.delivery_mode.value,
            "requested_mode": command.requested_mode,
            "requested_process": command.requested_process,
            "activation": activation,
            "runtime": runtime,
            "audit": process_result.to_audit_dict(),
            "response_payload": process_result.response_payload,
            "delivery": delivery,
            "state": state.to_state_dict(),
            "finished_at": datetime.now(UTC).isoformat(),
        }

    def _merge_execution_record(
        self,
        execution_record: dict[str, Any] | None,
        *,
        delivery: dict[str, Any],
        state: AgentConversationState,
    ) -> dict[str, Any]:
        merged = dict(execution_record or {})
        merged["status"] = "completed"
        merged["delivery"] = delivery
        merged["state"] = state.to_state_dict()
        merged["finished_at"] = datetime.now(UTC).isoformat()
        return merged

    def _save_turn_result(
        self,
        session: Session,
        message: CRMMensaje,
        *,
        result: dict[str, Any],
        command: ProcessTurnCommand,
        delivery: dict[str, Any] | None = None,
        execution_record: dict[str, Any] | None = None,
        process_name: str | None = None,
    ) -> None:
        metadata = dict(message.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        agent_meta.update(
            {
                "turn_result": result,
                "message_id": message.id,
                "trigger": command.trigger.value,
                "delivery_mode": command.delivery_mode.value,
                "requested_mode": command.requested_mode,
                "requested_process": command.requested_process,
                "processed_at": datetime.now(UTC).isoformat(),
                "process_name": process_name,
            }
        )
        if delivery is not None:
            agent_meta["delivery"] = delivery
        if execution_record is not None:
            agent_meta["execution"] = execution_record
        metadata["agent_v2"] = agent_meta
        message.metadata_json = metadata
        session.add(message)
        session.commit()
        session.refresh(message)

    @staticmethod
    def _build_response(
        *,
        result: dict[str, Any],
        command: ProcessTurnCommand,
        delivery: dict[str, Any],
        cached: bool,
        process_name: str | None,
        execution_audit: dict[str, Any] | None,
    ) -> dict[str, Any]:
        payload = {
            **result,
            "message_id": command.message_id,
            "trigger": command.trigger.value,
            "delivery_mode": command.delivery_mode.value,
            "delivery": delivery,
            "cached": cached,
        }
        if process_name:
            payload["process_name"] = process_name
        if execution_audit is not None:
            payload["execution"] = execution_audit
        return payload

    @staticmethod
    def _resolve_agent_mode(*, session: Session, command: ProcessTurnCommand) -> ChatAgentMode:
        if command.requested_mode:
            normalized = str(command.requested_mode).strip().lower()
            try:
                return ChatAgentMode(normalized)
            except ValueError as exc:
                raise ValueError(f"Modo de agente no valido: {command.requested_mode}") from exc
        return get_chat_agent_mode(session)
