from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import uuid4

from agente.v2.core.context import TurnContext
from agente.v2.core.state import utc_now_iso


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


@dataclass(slots=True)
class FamilyAttributeDefinition:
    nombre: str
    descripcion: str = ""
    default: Any = None
    obligatorio: bool = False
    tipo_dato: Literal["numero", "enum", "string"] | None = None
    valores_posibles: list[str] = field(default_factory=list)

    def prompt_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "nombre": self.nombre,
            "obligatorio": self.obligatorio,
        }
        if self.descripcion:
            payload["descripcion"] = self.descripcion
        if self.default is not None:
            payload["default"] = self.default
        if self.tipo_dato:
            payload["tipo_dato"] = self.tipo_dato
        if self.valores_posibles:
            payload["valores_posibles"] = self.valores_posibles
        return payload


@dataclass(slots=True)
class FamilyDefinition:
    codigo: str
    nombre: str
    estado: str = "confirmada"
    descripcion: str = ""
    tags: list[str] = field(default_factory=list)
    atributos: list[FamilyAttributeDefinition] = field(default_factory=list)

    def prompt_dict(self) -> dict[str, Any]:
        return {
            "codigo": self.codigo,
            "nombre": self.nombre,
            "tags": self.tags,
            "atributos": [attribute.prompt_dict() for attribute in self.atributos],
        }

    def find_attribute(self, attribute_name: str | None) -> FamilyAttributeDefinition | None:
        target = _clean_text(attribute_name)
        if not target:
            return None
        lowered = target.lower()
        for attribute in self.atributos:
            if attribute.nombre.lower() == lowered:
                return attribute
        return None


@dataclass(slots=True)
class MaterialItem:
    item_id: str = field(default_factory=lambda: str(uuid4()))
    descripcion: str | None = None
    cantidad: float | int | None = None
    unidad: str | None = None
    familia: str | None = None
    atributos: dict[str, Any] = field(default_factory=dict)
    faltantes: list[str] = field(default_factory=list)
    consulta: str | None = None
    consulta_atributo: str | None = None
    consulta_intentos: int = 0

    def clone(self) -> "MaterialItem":
        return MaterialItem(
            item_id=self.item_id,
            descripcion=self.descripcion,
            cantidad=self.cantidad,
            unidad=self.unidad,
            familia=self.familia,
            atributos=dict(self.atributos),
            faltantes=list(self.faltantes),
            consulta=self.consulta,
            consulta_atributo=self.consulta_atributo,
            consulta_intentos=self.consulta_intentos,
        )

    def to_state_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "descripcion": self.descripcion,
            "cantidad": self.cantidad,
            "unidad": self.unidad,
            "familia": self.familia,
            "atributos": self.atributos,
            "faltantes": self.faltantes,
            "consulta": self.consulta,
            "consulta_atributo": self.consulta_atributo,
            "consulta_intentos": self.consulta_intentos,
        }

    def to_analysis_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "descripcion_original": self.descripcion,
            "descripcion_actual": self.descripcion,
            "descripcion_normalizada": self.descripcion,
            "cantidad": self.cantidad,
            "unidad": self.unidad,
            "familia": self.familia,
            "atributos": self.atributos,
            "faltantes": self.faltantes,
            "consulta": self.consulta,
            "consulta_atributo": self.consulta_atributo,
            "consulta_intentos": self.consulta_intentos,
        }

    @classmethod
    def from_state_dict(cls, payload: dict[str, Any]) -> "MaterialItem":
        return cls(
            item_id=str(payload.get("item_id") or uuid4()),
            descripcion=_clean_text(payload.get("descripcion")),
            cantidad=payload.get("cantidad"),
            unidad=_clean_text(payload.get("unidad")),
            familia=_clean_text(payload.get("familia")),
            atributos=dict(payload.get("atributos") or {}),
            faltantes=[str(item).strip() for item in payload.get("faltantes") or [] if str(item).strip()],
            consulta=_clean_text(payload.get("consulta")),
            consulta_atributo=_clean_text(payload.get("consulta_atributo")),
            consulta_intentos=int(payload.get("consulta_intentos") or 0),
        )


@dataclass(slots=True)
class ItemOperation:
    action: Literal["add", "update", "remove", "clear_request", "confirm_request", "show_request"]
    target_item_id: str | None = None
    descripcion: str | None = None
    familia: str | None = None
    cantidad: float | int | None = None
    unidad: str | None = None
    atributos: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class NormalTurnDecision:
    decision_type: Literal["smalltalk", "request_operation", "no_op"]
    reply_to_user: str | None = None
    operations: list[ItemOperation] = field(default_factory=list)
    confidence: float | None = None
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class PendingTurnDecision:
    decision_type: Literal["answer_attempt", "independent_message", "ambiguous"]
    reply_to_user: str | None = None
    confidence: float | None = None
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class DirectAttributeMatch:
    applied: bool
    attribute_name: str | None = None
    value: Any = None
    reason: str | None = None


@dataclass(slots=True)
class MaterialRequestTurnContext:
    """
    Contexto interno del proceso solicitud_materiales.

    Adapta el TurnContext del core a la interfaz que usan el handler y el LLM client
    internamente. Los shims mantienen los nombres anteriores para no tener que
    reescribir el handler ni los prompts.
    """

    base_context: TurnContext
    request_state: "MaterialRequestState | None" = None
    prompt_families: list[dict[str, Any]] = field(default_factory=list)

    # --- Shims que adaptan TurnContext a la interfaz interna del handler ---

    @property
    def oportunidad_id(self) -> int:
        return self.base_context.oportunidad_id

    @property
    def contacto_id(self) -> int | None:
        return self.base_context.contacto_id

    @property
    def canal(self) -> str | None:
        return self.base_context.canal

    @property
    def mensaje_objetivo(self):
        """Devuelve el MessageInfo del turno — mismo contrato que TurnMessage (to_prompt_dict, id, contenido, etc.)."""
        return self.base_context.message

    @property
    def recent_messages(self):
        return self.base_context.history

    @property
    def active_process_state(self) -> dict[str, Any]:
        return self.base_context.process_state

    @property
    def definitions(self) -> dict[str, Any]:
        return {"opportunity_kind": "project" if self.base_context.is_project else "generic"}

    @property
    def conversation(self) -> "_ConversationShim":
        return _ConversationShim(is_project_opportunity=self.base_context.is_project)

    @property
    def agent_state(self) -> "_AgentStateShim":
        return _AgentStateShim(self.base_context)

    @property
    def runtime(self) -> "_RuntimeShim":
        return _RuntimeShim(trigger=self.base_context.trigger)


@dataclass(slots=True)
class _ConversationShim:
    is_project_opportunity: bool


@dataclass(slots=True)
class _AgentStateShim:
    _ctx: TurnContext

    @property
    def active_process(self) -> str | None:
        return self._ctx.active_process

    def to_state_dict(self) -> dict[str, Any]:
        return self._ctx.conversation_state.to_dict()


@dataclass(slots=True)
class _RuntimeShim:
    trigger: str

    def to_dict(self) -> dict[str, Any]:
        return {"trigger": self.trigger}


@dataclass(slots=True)
class MaterialRequestState:
    oportunidad_id: int
    activa: bool = True
    estado_solicitud: str = "draft"
    version: int = 1
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)
    ultimo_mensaje_id: int | None = None
    items: list[MaterialItem] = field(default_factory=list)
    observaciones: list[str] = field(default_factory=list)

    def active_query_item(self) -> MaterialItem | None:
        for item in self.items:
            if item.consulta:
                return item
        return None

    def to_state_dict(self) -> dict[str, Any]:
        return {
            "oportunidad_id": self.oportunidad_id,
            "activa": self.activa,
            "estado_solicitud": self.estado_solicitud,
            "version": self.version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "ultimo_mensaje_id": self.ultimo_mensaje_id,
            "items": [item.to_state_dict() for item in self.items],
            "observaciones": list(self.observaciones),
        }

    def to_analysis_dict(self) -> dict[str, Any]:
        return {
            "status": self.estado_solicitud,
            "items": [item.to_analysis_dict() for item in self.items],
            "observaciones": list(self.observaciones),
        }

    @classmethod
    def empty(cls, oportunidad_id: int, ultimo_mensaje_id: int | None = None) -> MaterialRequestState:
        return cls(
            oportunidad_id=oportunidad_id,
            activa=True,
            estado_solicitud="draft",
            version=1,
            ultimo_mensaje_id=ultimo_mensaje_id,
        )

    @classmethod
    def from_state_dict(cls, payload: dict[str, Any], oportunidad_id: int) -> MaterialRequestState:
        return cls(
            oportunidad_id=oportunidad_id,
            activa=bool(payload.get("activa", True)),
            estado_solicitud=str(payload.get("estado_solicitud") or "draft").strip(),
            version=int(payload.get("version") or 1),
            created_at=str(payload.get("created_at") or utc_now_iso()),
            updated_at=str(payload.get("updated_at") or utc_now_iso()),
            ultimo_mensaje_id=payload.get("ultimo_mensaje_id"),
            items=[
                MaterialItem.from_state_dict(item)
                for item in payload.get("items") or []
                if isinstance(item, dict)
            ],
            observaciones=[str(item).strip() for item in payload.get("observaciones") or [] if str(item).strip()],
        )


@dataclass(slots=True)
class MaterialRequestProcessState:
    status: str = "draft"
    items: list[dict[str, Any]] = field(default_factory=list)
    observaciones: list[str] = field(default_factory=list)
    pending_query: dict[str, Any] | None = None
    last_user_intent: str | None = None
    last_agent_prompt: str | None = None
    awaiting_user_decision: str | None = None
    ready_for_confirmation: bool = False
    last_operation_summary: str | None = None
    last_request_action: str | None = None
    updated_at: str = field(default_factory=utc_now_iso)

    @classmethod
    def from_request_state(
        cls,
        request_state: MaterialRequestState,
        *,
        pending_query: dict[str, Any] | None = None,
        last_user_intent: str | None = None,
        last_agent_prompt: str | None = None,
        awaiting_user_decision: str | None = None,
        ready_for_confirmation: bool | None = None,
        last_operation_summary: str | None = None,
        last_request_action: str | None = None,
    ) -> "MaterialRequestProcessState":
        active_query_item = request_state.active_query_item()
        resolved_pending_query = pending_query
        if resolved_pending_query is None and active_query_item is not None:
            resolved_pending_query = {
                "item_id": active_query_item.item_id,
                "attribute_name": active_query_item.consulta_atributo,
                "question_text": active_query_item.consulta,
                "attempt_count": active_query_item.consulta_intentos,
                "source_message_id": request_state.ultimo_mensaje_id,
                "asked_at": request_state.updated_at,
            }

        resolved_ready_for_confirmation = bool(ready_for_confirmation)
        if ready_for_confirmation is None:
            resolved_ready_for_confirmation = bool(
                request_state.items
                and request_state.estado_solicitud == "ready"
                and active_query_item is None
            )

        resolved_awaiting_user_decision = awaiting_user_decision
        if resolved_awaiting_user_decision is None and resolved_ready_for_confirmation:
            resolved_awaiting_user_decision = "continue_or_close"

        return cls(
            status=request_state.estado_solicitud,
            items=[item.to_state_dict() for item in request_state.items],
            observaciones=list(request_state.observaciones),
            pending_query=dict(resolved_pending_query) if isinstance(resolved_pending_query, dict) else None,
            last_user_intent=_clean_text(last_user_intent),
            last_agent_prompt=_clean_text(last_agent_prompt),
            awaiting_user_decision=_clean_text(resolved_awaiting_user_decision),
            ready_for_confirmation=resolved_ready_for_confirmation,
            last_operation_summary=_clean_text(last_operation_summary),
            last_request_action=_clean_text(last_request_action),
            updated_at=str(request_state.updated_at or utc_now_iso()),
        )

    def to_state_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "items": [dict(item) for item in self.items],
            "observaciones": list(self.observaciones),
            "pending_query": dict(self.pending_query) if isinstance(self.pending_query, dict) else None,
            "last_user_intent": self.last_user_intent,
            "last_agent_prompt": self.last_agent_prompt,
            "awaiting_user_decision": self.awaiting_user_decision,
            "ready_for_confirmation": self.ready_for_confirmation,
            "last_operation_summary": self.last_operation_summary,
            "last_request_action": self.last_request_action,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_state_dict(cls, payload: dict[str, Any] | None) -> "MaterialRequestProcessState":
        raw_payload = payload or {}
        raw_items = raw_payload.get("items") or []
        items = [dict(item) for item in raw_items if isinstance(item, dict)]
        observaciones = [str(item).strip() for item in raw_payload.get("observaciones") or [] if str(item).strip()]
        pending_query = raw_payload.get("pending_query")
        if not isinstance(pending_query, dict):
            pending_query = None

        return cls(
            status=str(raw_payload.get("status") or "draft").strip(),
            items=items,
            observaciones=observaciones,
            pending_query=dict(pending_query) if pending_query else None,
            last_user_intent=_clean_text(raw_payload.get("last_user_intent")),
            last_agent_prompt=_clean_text(raw_payload.get("last_agent_prompt")),
            awaiting_user_decision=_clean_text(raw_payload.get("awaiting_user_decision")),
            ready_for_confirmation=bool(raw_payload.get("ready_for_confirmation")),
            last_operation_summary=_clean_text(raw_payload.get("last_operation_summary")),
            last_request_action=_clean_text(raw_payload.get("last_request_action")),
            updated_at=str(raw_payload.get("updated_at") or utc_now_iso()),
        )
