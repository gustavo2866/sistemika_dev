from __future__ import annotations

import re
from dataclasses import replace
from pathlib import Path
from typing import Any

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.core.processes import (
    BusinessAction,
    ProcessActivationDecision,
    ProcessHandoff,
    ProcessTurnResult,
    ProcessUserReply,
)
from agente.v2.core.state import JsonConversationStateStore
from agente.v2.processes.solicitud_materiales.attribute_mapping import DirectAttributeMapper
from agente.v2.processes.solicitud_materiales.family_catalog import FamilyCatalog
from agente.v2.processes.solicitud_materiales.llm_client import OpenAIConversationAgentClientV2
from agente.v2.processes.solicitud_materiales.models import (
    MaterialItem,
    MaterialRequestProcessState,
    MaterialRequestState,
    MaterialRequestTurnContext,
)
from agente.v2.processes.solicitud_materiales.operation_execution import RequestOperationExecutor
from agente.v2.processes.solicitud_materiales.request_store import RequestStore
from agente.v2.processes.solicitud_materiales.request_validation import RequestValidator


_MATERIAL_VERBS = (
    "necesito",
    "manda",
    "mandame",
    "agrega",
    "suma",
    "saca",
    "quita",
    "cambia",
    "corrige",
    "deja solo",
    "limpia",
    "borra",
    "reinicia",
    "confirmo",
)
_MATERIAL_PATTERN = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(bolsas?|barras?|m3|metros?|mts?|unidades?|rollos?|kg)\b",
    flags=re.IGNORECASE,
)
_LEADING_MEASUREMENT_PATTERN = re.compile(
    r"^\s*\d+(?:[.,]\d+)?\s*(?:bolsas?|barras?|m3|metros?|mts?|unidades?|rollos?|kg)\s*(?:de\s+)?",
    flags=re.IGNORECASE,
)


def _format_quantity_value(value: float | int | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _build_request_summary_line(item: MaterialItem) -> str:
    quantity = _format_quantity_value(item.cantidad)
    unit = str(item.unidad or "").strip() or None
    description = str(item.descripcion or "").strip() or None
    product_from_description = None
    if description:
        product_from_description = _LEADING_MEASUREMENT_PATTERN.sub("", description).strip() or None
    product = product_from_description or description or "item"

    specs = ", ".join(
        f"{key}: {value}"
        for key, value in (item.atributos or {}).items()
        if value not in {None, ""}
    )
    main_text = " ".join(part for part in (quantity, unit, product) if part)
    if not main_text:
        main_text = description or product
    return f"{main_text} ({specs})" if specs else main_text


def _humanize_attribute_label(attribute_name: str | None) -> str:
    normalized = str(attribute_name or "").strip().lower().replace("_", " ")
    known_labels = {
        "tipo": "tipo",
        "peso kg": "peso en kg",
        "diametro mm": "diametro en mm",
        "largo m": "largo en metros",
        "cantidad": "cantidad",
        "unidad": "unidad",
    }
    return known_labels.get(normalized, normalized or "dato")


def build_request_summary_text(request_state: MaterialRequestState) -> str:
    summary_lines: list[str] = []
    for item in request_state.items:
        summary_line = _build_request_summary_line(item).strip()
        if summary_line:
            summary_lines.append(summary_line)
    if not summary_lines:
        return ""
    return "Te detallo la solicitud:\n- " + "\n- ".join(summary_lines)


def build_request_reply_text(request_state: MaterialRequestState) -> str:
    consultas = [str(item.consulta).strip() for item in request_state.items if str(item.consulta or "").strip()]
    if consultas:
        if len(consultas) == 1:
            return consultas[0]
        return "Para completar la solicitud necesito confirmar lo siguiente:\n- " + "\n- ".join(consultas[:3])

    summary_text = build_request_summary_text(request_state)
    if not summary_text:
        return ""

    return summary_text + "\n\nSi queres, puedo agregar mas materiales o cerrar la solicitud."


class ConversationAgentV2:
    """Proceso `solicitud_materiales` implementado sobre el contrato del agente v2."""

    # Nombre usado por el core para identificar el proceso (AgentProcess.name)
    name = "solicitud_materiales"
    process_name = name  # alias de compatibilidad

    def __init__(
        self,
        family_catalog: FamilyCatalog,
        request_store: RequestStore,
        llm_client: OpenAIConversationAgentClientV2,
    ) -> None:
        self._family_catalog = family_catalog
        self._request_store = request_store
        self._llm_client = llm_client
        self._request_validator = RequestValidator(family_catalog)
        self._direct_mapper = DirectAttributeMapper()
        self._operation_executor = RequestOperationExecutor()

    # ------------------------------------------------------------------
    # Contrato AgentProcess (core v2 simplificado)
    # ------------------------------------------------------------------

    def priority(self, ctx: TurnContext) -> int | None:
        """Prioridad para manejar este turno. None = no puede manejar."""
        if not ctx.is_project:
            return None

        if ctx.active_process == self.name:
            return 100  # proceso activo — registry suma +1000 adicional

        if self.load_request_state(ctx.oportunidad_id, active_only=True) is not None:
            return 90  # solicitud activa sin proceso marcado

        if self._looks_like_material_request(ctx.message.contenido):
            return 80  # detecta pedido de materiales

        return 10  # fallback conversacional para proyectos

    def handle(self, ctx: TurnContext) -> TurnResult:
        """Ejecuta el turno y devuelve TurnResult para el orquestador."""
        material_context = self._build_turn_context(ctx)
        old_result = self.handle_turn(material_context)
        return TurnResult(
            payload=old_result.response_payload,
            keep_active=old_result.keep_process_active,
            process_state=old_result.updated_process_state or {},
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def load_request_state(
        self,
        oportunidad_id: int,
        *,
        active_only: bool = False,
    ) -> MaterialRequestState | None:
        request_state = self._request_store.load(oportunidad_id)
        if request_state is None:
            return None

        snapshot = request_state.to_state_dict()
        refreshed_state = self._request_validator.refresh(request_state)
        if refreshed_state.to_state_dict() != snapshot:
            refreshed_state = self._request_store.save(
                refreshed_state,
                refreshed_state.ultimo_mensaje_id,
            )

        if active_only and not refreshed_state.activa:
            return None
        return refreshed_state

    def list_prompt_families(self) -> list[dict[str, Any]]:
        return self._family_catalog.list_prompt_families()

    def _build_turn_context(self, context: TurnContext) -> MaterialRequestTurnContext:
        return MaterialRequestTurnContext(
            base_context=context,
            request_state=self.load_request_state(context.oportunidad_id, active_only=True),
            prompt_families=self.list_prompt_families(),
        )

    def can_activate(self, context) -> ProcessActivationDecision:
        """Compatibilidad con codigo anterior — internamante llama a priority()."""
        ctx_is_project = getattr(getattr(context, "conversation", None), "is_project_opportunity", False)
        if not ctx_is_project:
            return ProcessActivationDecision(
                can_activate=False,
                priority=0,
                reason="oportunidad_no_proyecto",
                process_name=self.process_name,
            )

        if context.agent_state.active_process == self.process_name:
            return ProcessActivationDecision(
                can_activate=True,
                priority=100,
                reason="continua proceso activo",
                process_name=self.process_name,
            )

        if self.load_request_state(context.oportunidad_id, active_only=True) is not None:
            return ProcessActivationDecision(
                can_activate=True,
                priority=90,
                reason="existe solicitud activa",
                process_name=self.process_name,
            )

        if self._looks_like_material_request(context.mensaje_objetivo.contenido):
            return ProcessActivationDecision(
                can_activate=True,
                priority=80,
                reason="detecta pedido de materiales",
                process_name=self.process_name,
            )

        return ProcessActivationDecision(
            can_activate=True,
            priority=10,
            reason="fallback_conversacional_proyecto",
            process_name=self.process_name,
        )

    def process_turn(self, context: TurnContext) -> dict[str, Any]:
        return self.handle(context).payload

    def handle_turn(self, context: MaterialRequestTurnContext) -> ProcessTurnResult:
        material_context = context
        request_state = material_context.request_state
        process_state = self._load_process_state(material_context, request_state)
        active_query_item = request_state.active_query_item() if request_state else None
        if request_state and active_query_item:
            response = self._process_pending_query_turn(material_context, request_state, process_state)
            if response is not None:
                return response

        normal_decision = self._llm_client.interpret_normal_turn(
            material_context,
            material_context.prompt_families,
        )
        return self._process_normal_decision(
            material_context,
            normal_decision,
            process_state=process_state,
            prompts_used=["normal_turn"],
        )

    def _load_process_state(
        self,
        context: MaterialRequestTurnContext,
        request_state: MaterialRequestState | None,
    ) -> MaterialRequestProcessState:
        raw_payload = context.active_process_state if isinstance(context.active_process_state, dict) else None
        if isinstance(raw_payload, dict) and (
            "pending_query" in raw_payload
            or "last_user_intent" in raw_payload
            or "awaiting_user_decision" in raw_payload
            or "ready_for_confirmation" in raw_payload
        ):
            return MaterialRequestProcessState.from_state_dict(raw_payload)
        if request_state is not None:
            return MaterialRequestProcessState.from_request_state(request_state)
        return MaterialRequestProcessState()

    def _process_pending_query_turn(
        self,
        context: MaterialRequestTurnContext,
        request_state: MaterialRequestState,
        process_state: MaterialRequestProcessState,
    ) -> ProcessTurnResult | None:
        active_query_item = request_state.active_query_item()
        if not active_query_item or not active_query_item.consulta_atributo:
            return None

        attribute = self._request_validator.get_attribute_definition(
            active_query_item,
            active_query_item.consulta_atributo,
        )
        direct_match = self._direct_mapper.try_map(attribute, context.mensaje_objetivo.contenido)
        if direct_match.applied and direct_match.attribute_name:
            if direct_match.attribute_name == "unidad":
                active_query_item.unidad = str(direct_match.value).strip()
            elif direct_match.attribute_name == "cantidad":
                active_query_item.cantidad = direct_match.value
            else:
                active_query_item.atributos[direct_match.attribute_name] = direct_match.value
            active_query_item.consulta = None
            active_query_item.consulta_atributo = None
            active_query_item.consulta_intentos = 0

            refreshed_request = self._request_validator.refresh(request_state)
            saved_request = self._request_store.save(refreshed_request, context.mensaje_objetivo.id)
            actions = [
                BusinessAction(
                    "update_item",
                    {
                        "item_id": active_query_item.item_id,
                        "attribute_name": direct_match.attribute_name,
                        "value": direct_match.value,
                    },
                ),
                BusinessAction("clear_pending_query", {"item_id": active_query_item.item_id}),
            ]
            next_query = saved_request.active_query_item()
            if next_query:
                actions.append(BusinessAction("set_pending_query", self._pending_query_payload(saved_request)))
            elif not self._should_keep_process_active(saved_request):
                actions.append(BusinessAction("close_process", {"reason": "solicitud_sin_pendientes"}))
            operation_summary = self._build_attribute_mapping_summary(
                item=active_query_item,
                attribute_name=direct_match.attribute_name,
                value=direct_match.value,
            )
            reply_to_user = self._build_material_dialogue_reply(
                saved_request,
                request_action="update",
                operation_summary=operation_summary,
            )
            return self._build_material_process_result(
                saved_request,
                request_action="update",
                reply_to_user=reply_to_user,
                warnings=[],
                actions=actions,
                prompts_used=[],
                user_intent="answer_pending_query",
                operation_summary=operation_summary,
            )

        pending_decision = self._llm_client.classify_pending_turn(
            context,
            active_query_item,
            pending_attribute=(attribute.prompt_dict() if attribute else {}),
        )
        if pending_decision.decision_type == "independent_message":
            normal_decision = self._llm_client.interpret_normal_turn(
                context,
                context.prompt_families,
            )
            if normal_decision.decision_type == "request_operation":
                # Operacion sobre la solicitud (agregar item, cambiar cantidad, etc.)
                # Se procesa normalmente; el validador retomara las preguntas pendientes.
                return self._process_normal_decision(
                    context,
                    normal_decision,
                    process_state=process_state,
                    prompts_used=["pending_attribute_turn", "normal_turn"],
                )
            # Smalltalk o no_op: responder el mensaje y retomar la repregunta pendiente
            reply_to_user = self._llm_client.reply_independent_during_pending(
                context,
                active_query_item,
                pending_attribute=(attribute.prompt_dict() if attribute else {}),
            )
            saved_request = self._request_store.save(request_state, context.mensaje_objetivo.id)
            return self._build_material_process_result(
                saved_request,
                request_action="show",
                reply_to_user=reply_to_user,
                warnings=[],
                actions=[
                    BusinessAction("set_pending_query", self._pending_query_payload(saved_request)),
                    BusinessAction("send_reply", {"text": reply_to_user}),
                ],
                prompts_used=["pending_attribute_turn", "normal_turn", "independent_during_pending"],
                user_intent="independent_message_during_pending",
            )

        active_query_item.consulta_intentos += 1
        saved_request = self._request_store.save(request_state, context.mensaje_objetivo.id)
        reply_to_user = pending_decision.reply_to_user or active_query_item.consulta or ""
        actions = [
            BusinessAction("set_pending_query", self._pending_query_payload(saved_request)),
            BusinessAction(
                "send_reply",
                {
                    "text": reply_to_user,
                },
            ),
        ]
        return self._build_material_process_result(
            saved_request,
            request_action="show",
            reply_to_user=reply_to_user,
            warnings=pending_decision.warnings,
            actions=actions,
            prompts_used=["pending_attribute_turn"],
            user_intent="pending_query_answer_attempt",
        )

    def _process_normal_decision(
        self,
        context: MaterialRequestTurnContext,
        normal_decision: Any,
        *,
        process_state: MaterialRequestProcessState,
        prompts_used: list[str],
        handoff: ProcessHandoff | None = None,
    ) -> ProcessTurnResult:
        if normal_decision.decision_type == "smalltalk":
            reply_to_user = self._build_contextual_chat_reply(
                request_state=context.request_state,
                process_state=process_state,
                base_reply=normal_decision.reply_to_user or "Entendido.",
            )
            return self._build_chat_process_result(
                reply_to_user=reply_to_user,
                warnings=normal_decision.warnings,
                request_state=context.request_state,
                actions=[
                    BusinessAction(
                        "send_reply",
                        {
                            "text": reply_to_user,
                        },
                    )
                ],
                prompts_used=prompts_used,
                handoff=handoff,
                user_intent="smalltalk",
            )

        if normal_decision.decision_type == "no_op":
            reply_to_user = self._build_contextual_chat_reply(
                request_state=context.request_state,
                process_state=process_state,
                base_reply=normal_decision.reply_to_user or "Entendido.",
            )
            return self._build_chat_process_result(
                reply_to_user=reply_to_user,
                warnings=normal_decision.warnings,
                request_state=context.request_state,
                actions=[
                    BusinessAction(
                        "send_reply",
                        {
                            "text": reply_to_user,
                        },
                    )
                ],
                prompts_used=prompts_used,
                handoff=handoff,
                user_intent="no_op",
            )

        previous_request = context.request_state
        request_state = previous_request or MaterialRequestState.empty(
            context.oportunidad_id,
            ultimo_mensaje_id=context.mensaje_objetivo.id,
        )
        request_state = replace(
            request_state,
            items=[item.clone() for item in request_state.items],
            observaciones=list(request_state.observaciones),
        )
        warnings = self._operation_executor.apply(request_state, normal_decision.operations)
        request_state = self._request_validator.refresh(request_state)
        saved_request = self._request_store.save(request_state, context.mensaje_objetivo.id)
        request_action = self._resolve_request_action(normal_decision.operations)
        user_intent = self._resolve_user_intent(normal_decision)
        operation_summary = self._build_operation_summary_text(
            previous_request=previous_request,
            saved_request=saved_request,
            operations=normal_decision.operations,
        )
        reply_to_user = self._build_material_dialogue_reply(
            saved_request,
            request_action=request_action,
            operation_summary=operation_summary,
            llm_reply=normal_decision.reply_to_user,
        )

        return self._build_material_process_result(
            saved_request,
            request_action=request_action,
            reply_to_user=reply_to_user,
            warnings=[*normal_decision.warnings, *warnings],
            actions=self._build_actions_from_operations(
                previous_request=previous_request,
                saved_request=saved_request,
                operations=normal_decision.operations,
                reply_to_user=reply_to_user,
            ),
            prompts_used=prompts_used,
            handoff=handoff,
            user_intent=user_intent,
            operation_summary=operation_summary,
        )

    def _build_attribute_mapping_summary(
        self,
        *,
        item: MaterialItem,
        attribute_name: str | None,
        value: Any,
    ) -> str:
        item_name = item.descripcion or item.familia or "el item"
        label = _humanize_attribute_label(attribute_name)
        return f"Perfecto, registre {label}: {value} para {item_name}."

    def _build_operation_summary_text(
        self,
        *,
        previous_request: MaterialRequestState | None,
        saved_request: MaterialRequestState,
        operations: list[Any],
    ) -> str | None:
        if not operations:
            return None

        previous_items = {
            item.item_id: item
            for item in (previous_request.items if previous_request is not None else [])
        }
        current_items = {item.item_id: item for item in saved_request.items}
        summaries: list[str] = []

        for operation in operations:
            if operation.action == "show_request":
                continue
            if operation.action == "confirm_request":
                summaries.append("Perfecto, dejo la solicitud confirmada.")
                continue
            if operation.action == "clear_request":
                summaries.append("Limpie la solicitud.")
                continue
            if operation.action == "add":
                quantity = _format_quantity_value(operation.cantidad)
                item_name = operation.descripcion or operation.familia or "el item"
                main_text = " ".join(
                    part for part in (quantity, operation.unidad, item_name) if part
                )
                summaries.append(f"Agregue {main_text or item_name}.")
                continue
            if operation.action == "remove":
                target_item = previous_items.get(operation.target_item_id or "")
                item_name = operation.descripcion or (target_item.descripcion if target_item else None) or "el item indicado"
                summaries.append(f"Quite {item_name}.")
                continue
            if operation.action == "update":
                target_item = current_items.get(operation.target_item_id or "") or previous_items.get(operation.target_item_id or "")
                item_name = operation.descripcion or (target_item.descripcion if target_item else None) or "la solicitud"
                summaries.append(f"Actualice {item_name}.")

        if not summaries:
            return None
        if len(summaries) == 1:
            return summaries[0]
        return "Realice estos cambios:\n- " + "\n- ".join(summaries)

    def _build_material_dialogue_reply(
        self,
        request_state: MaterialRequestState,
        *,
        request_action: str,
        operation_summary: str | None = None,
        llm_reply: str | None = None,
    ) -> str | None:
        if request_state.estado_solicitud == "confirmed":
            return llm_reply or operation_summary or "Solicitud confirmada."

        follow_up_question = self._get_follow_up_question(request_state)
        if follow_up_question:
            guidance = f"Para seguir con la solicitud necesito esto: {follow_up_question}"
            if operation_summary:
                return f"{operation_summary}\n\n{guidance}"
            if llm_reply and llm_reply.strip() and llm_reply.strip() != follow_up_question:
                return f"{llm_reply}\n\n{guidance}"
            return follow_up_question

        if not request_state.items:
            base_text = operation_summary or llm_reply or "La solicitud quedo vacia."
            if base_text == "La solicitud quedo vacia.":
                return base_text + " Si queres, podes indicarme nuevos materiales."
            return f"{base_text}\n\nSi queres, podes indicarme nuevos materiales."

        summary_text = build_request_summary_text(request_state)
        close_prompt = "Si queres, puedo agregar mas materiales o cerrar la solicitud."

        if request_action == "show":
            if llm_reply and llm_reply.strip():
                return f"{llm_reply}\n\n{summary_text}\n\n{close_prompt}"
            return f"{summary_text}\n\n{close_prompt}"
        if operation_summary:
            return f"{operation_summary}\n\n{summary_text}\n\n{close_prompt}"
        if llm_reply and llm_reply.strip():
            return f"{llm_reply}\n\n{summary_text}\n\n{close_prompt}"
        return f"{summary_text}\n\n{close_prompt}" if summary_text else None

    def _build_contextual_chat_reply(
        self,
        *,
        request_state: MaterialRequestState | None,
        process_state: MaterialRequestProcessState,
        base_reply: str,
    ) -> str:
        if request_state is None:
            return base_reply

        follow_up_question = self._get_follow_up_question(request_state)
        if follow_up_question:
            return f"{base_reply}\n\nPara seguir con la solicitud necesito esto: {follow_up_question}"

        if process_state.awaiting_user_decision == "continue_or_close" or (
            request_state.estado_solicitud == "ready" and bool(request_state.items)
        ):
            return (
                f"{base_reply}\n\n"
                "La solicitud sigue abierta. Si queres, puedo agregar mas materiales o cerrar la solicitud."
            )
        return base_reply

    def _build_process_state_payload(
        self,
        request_state: MaterialRequestState | None,
        *,
        user_intent: str | None,
        reply_to_user: str | None,
        request_action: str | None = None,
        operation_summary: str | None = None,
    ) -> dict[str, Any] | None:
        if request_state is None:
            return None
        process_state = MaterialRequestProcessState.from_request_state(
            request_state,
            pending_query=(self._pending_query_payload(request_state) or None),
            last_user_intent=user_intent,
            last_agent_prompt=reply_to_user,
            last_operation_summary=operation_summary,
            last_request_action=request_action,
        )
        return process_state.to_state_dict()

    @staticmethod
    def _resolve_user_intent(normal_decision: Any) -> str:
        if normal_decision.decision_type != "request_operation":
            return str(normal_decision.decision_type)
        operations = list(normal_decision.operations or [])
        if not operations:
            return "show_request"
        if len(operations) == 1:
            return str(operations[0].action)
        return "batch_request_update"

    def _build_actions_from_operations(
        self,
        *,
        previous_request: MaterialRequestState | None,
        saved_request: MaterialRequestState,
        operations: list[Any],
        reply_to_user: str | None,
    ) -> list[BusinessAction]:
        actions: list[BusinessAction] = []
        action_map = {
            "add": "add_item",
            "update": "update_item",
            "remove": "remove_item",
            "clear_request": "clear_request",
            "confirm_request": "confirm_request",
            "show_request": "show_request",
        }

        for operation in operations:
            actions.append(
                BusinessAction(
                    action_map.get(operation.action, operation.action),
                    {
                        "target_item_id": operation.target_item_id,
                        "descripcion": operation.descripcion,
                        "familia": operation.familia,
                        "cantidad": operation.cantidad,
                        "unidad": operation.unidad,
                        "atributos": dict(operation.atributos),
                    },
                )
            )

        previous_query = previous_request.active_query_item() if previous_request else None
        current_query = saved_request.active_query_item()
        if previous_query and (
            current_query is None
            or current_query.item_id != previous_query.item_id
            or current_query.consulta_atributo != previous_query.consulta_atributo
        ):
            actions.append(BusinessAction("clear_pending_query", {"item_id": previous_query.item_id}))
        if current_query:
            actions.append(BusinessAction("set_pending_query", self._pending_query_payload(saved_request)))

        if saved_request.estado_solicitud == "confirmed" or not self._should_keep_process_active(saved_request):
            actions.append(
                BusinessAction(
                    "close_process",
                    {
                        "reason": saved_request.estado_solicitud,
                    },
                )
            )

        if reply_to_user:
            actions.append(
                BusinessAction(
                    "send_reply",
                    {
                        "text": reply_to_user,
                    },
                )
            )
        return actions

    @staticmethod
    def _resolve_request_action(operations: list[Any]) -> str:
        if not operations:
            return "show"
        actions = {operation.action for operation in operations}
        if actions == {"clear_request"}:
            return "clear"
        if actions == {"show_request"}:
            return "show"
        if actions == {"confirm_request"}:
            return "confirm"
        return "update"

    @staticmethod
    def _get_follow_up_question(request_state: MaterialRequestState) -> str | None:
        active_query_item = request_state.active_query_item()
        return active_query_item.consulta if active_query_item else None

    def _build_chat_process_result(
        self,
        *,
        reply_to_user: str,
        warnings: list[str],
        request_state: MaterialRequestState | None,
        actions: list[BusinessAction],
        prompts_used: list[str],
        handoff: ProcessHandoff | None = None,
        user_intent: str | None = None,
    ) -> ProcessTurnResult:
        process_state_payload = self._build_process_state_payload(
            request_state,
            user_intent=user_intent,
            reply_to_user=reply_to_user,
        )
        return ProcessTurnResult(
            process_name=self.process_name,
            consumed_turn=True,
            keep_process_active=self._should_keep_process_active(request_state),
            next_substate=self._resolve_substate(request_state),
            updated_process_state=process_state_payload,
            actions=actions,
            user_reply=ProcessUserReply(reply_to_user),
            handoff=handoff,
            warnings=warnings,
            response_payload={
                "type": "chat_reply",
                "respuesta": reply_to_user,
                "modelo": "agente-v2",
                "warnings": warnings,
                "workflow": self._build_workflow_metadata(request_state, process_state_payload),
                "solicitud": request_state.to_state_dict() if request_state else None,
            },
            debug={
                "prompts_used": prompts_used,
            },
        )

    def _build_material_process_result(
        self,
        request_state: MaterialRequestState,
        *,
        request_action: str,
        reply_to_user: str | None,
        warnings: list[str],
        actions: list[BusinessAction],
        prompts_used: list[str],
        handoff: ProcessHandoff | None = None,
        user_intent: str | None = None,
        operation_summary: str | None = None,
    ) -> ProcessTurnResult:
        user_reply = ProcessUserReply(reply_to_user) if reply_to_user else None
        process_state_payload = self._build_process_state_payload(
            request_state,
            user_intent=user_intent,
            reply_to_user=reply_to_user,
            request_action=request_action,
            operation_summary=operation_summary,
        )
        return ProcessTurnResult(
            process_name=self.process_name,
            consumed_turn=True,
            keep_process_active=self._should_keep_process_active(request_state),
            next_substate=self._resolve_substate(request_state),
            updated_process_state=process_state_payload,
            actions=actions,
            user_reply=user_reply,
            handoff=handoff,
            warnings=warnings,
            response_payload={
                "type": "material_request",
                "request_action": request_action,
                "respuesta": reply_to_user,
                "analysis": request_state.to_analysis_dict(),
                "solicitud": request_state.to_state_dict(),
                "modelo": "agente-v2",
                "warnings": warnings,
                "workflow": self._build_workflow_metadata(request_state, process_state_payload),
            },
            debug={
                "prompts_used": prompts_used,
            },
        )

    @staticmethod
    def _build_workflow_metadata(
        request_state: MaterialRequestState | None,
        process_state_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        active_query_item = request_state.active_query_item() if request_state else None
        ready_for_confirmation = bool((process_state_payload or {}).get("ready_for_confirmation"))
        awaiting_user_decision = (process_state_payload or {}).get("awaiting_user_decision")
        if active_query_item:
            mode = "completa_atributos"
        elif ready_for_confirmation:
            mode = "revision"
        else:
            mode = "normal"
        return {
            "mode": mode,
            "active_query": (
                {
                    "item_id": active_query_item.item_id,
                    "consulta": active_query_item.consulta,
                    "consulta_atributo": active_query_item.consulta_atributo,
                    "consulta_intentos": active_query_item.consulta_intentos,
                }
                if active_query_item
                else None
            ),
            "awaiting_user_decision": awaiting_user_decision,
            "ready_for_confirmation": ready_for_confirmation,
        }

    @staticmethod
    def _resolve_substate(request_state: MaterialRequestState | None) -> str | None:
        active_query_item = request_state.active_query_item() if request_state else None
        if active_query_item:
            return "completa_atributos"
        if request_state and request_state.estado_solicitud == "ready" and request_state.items:
            return "revision"
        return None

    @staticmethod
    def _should_keep_process_active(request_state: MaterialRequestState | None) -> bool:
        if request_state is None:
            return False
        if request_state.estado_solicitud == "confirmed":
            return False
        if request_state.active_query_item() is not None:
            return True
        return bool(request_state.items)

    @staticmethod
    def _looks_like_material_request(message: str | None) -> bool:
        normalized_message = str(message or "").strip().lower()
        if not normalized_message:
            return False
        if any(verb in normalized_message for verb in _MATERIAL_VERBS):
            return True
        return _MATERIAL_PATTERN.search(normalized_message) is not None

    @staticmethod
    def _pending_query_payload(request_state: MaterialRequestState) -> dict[str, Any]:
        active_query_item = request_state.active_query_item()
        if active_query_item is None:
            return {}
        return {
            "item_id": active_query_item.item_id,
            "attribute_name": active_query_item.consulta_atributo,
            "question_text": active_query_item.consulta,
            "attempt_count": active_query_item.consulta_intentos,
            "source_message_id": request_state.ultimo_mensaje_id,
            "asked_at": request_state.updated_at,
        }


def build_v2_dependencies(
    *,
    session=None,
    families_path: Path | None = None,
    requests_root: Path | None = None,
    state_root: Path | None = None,
    executions_dir: Path | None = None,
):
    """Construye las dependencias del agente v2.

    Si se pasa `session` (SQLModel Session) usa stores en DB con SELECT FOR UPDATE.
    En caso contrario usa stores JSON en disco (compatibilidad hacia atras / tests).
    """
    family_catalog = FamilyCatalog(families_path)

    if session is not None:
        from agente.v2.db.stores import DbConversationStateStore, DbProcessRequestStore
        request_store = DbProcessRequestStore(session)
        state_store = DbConversationStateStore(session)
    else:
        from agente.v2.core.state import DEFAULT_STATE_DIR
        request_store = RequestStore(requests_root)
        resolved_state_root = state_root
        if requests_root is not None:
            resolved_state_root = resolved_state_root or requests_root / "conversation_state"
        state_store = JsonConversationStateStore(root_dir=resolved_state_root)

    llm_client = OpenAIConversationAgentClientV2()
    agent = ConversationAgentV2(
        family_catalog=family_catalog,
        request_store=request_store,
        llm_client=llm_client,
    )
    return state_store, agent
