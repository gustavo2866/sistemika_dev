from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from agente.v2.core.state_repository import AgentConversationStateRepository
from agente.v2.core.models import (
    AgentConversationState,
    ChatTurnContext,
    ConversationRef,
    MaterialRequestState,
    TurnMessage,
    TurnRuntime,
)
from agente.v2.processes.solicitud_materiales.family_catalog import FamilyCatalog
from agente.v2.processes.solicitud_materiales.request_store import RequestStore
from agente.v2.processes.solicitud_materiales.request_validation import RequestValidator
from app.models import CRMContacto, CRMMensaje, CRMOportunidad, Proyecto
from app.models.crm.catalogos import CRMTipoOperacion
from app.models.base import serialize_datetime


class ChatContextLoader:
    """Construye el contexto completo de turno para el agente v2."""

    def __init__(
        self,
        request_store: RequestStore,
        family_catalog: FamilyCatalog,
        state_repository: AgentConversationStateRepository,
        *,
        history_limit: int = 6,
    ) -> None:
        self._request_store = request_store
        self._family_catalog = family_catalog
        self._request_validator = RequestValidator(family_catalog)
        self._state_repository = state_repository
        self._history_limit = history_limit

    @staticmethod
    def _fecha_mensaje_ref():
        return func.coalesce(CRMMensaje.fecha_mensaje, CRMMensaje.created_at)

    @staticmethod
    def _to_turn_message(message: CRMMensaje) -> TurnMessage:
        return TurnMessage(
            id=message.id,
            tipo=message.tipo,
            estado=message.estado,
            canal=message.canal,
            contenido=message.contenido or "",
            fecha=serialize_datetime(message.fecha_mensaje or message.created_at),
        )

    def _load_recent_messages(self, session: Session, oportunidad_id: int) -> list[TurnMessage]:
        fecha_mensaje_ref = self._fecha_mensaje_ref()
        rows = session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .order_by(fecha_mensaje_ref.desc(), CRMMensaje.id.desc())
            .limit(self._history_limit)
        ).all()
        return [self._to_turn_message(message) for message in reversed(rows)]

    def _build_turn_context(
        self,
        *,
        session: Session,
        oportunidad: CRMOportunidad,
        contacto: CRMContacto | None,
        message: CRMMensaje,
        agent_state: AgentConversationState,
        runtime: TurnRuntime,
    ) -> ChatTurnContext:
        active_process_state = None
        if agent_state.active_process:
            active_process_state = dict(agent_state.process_states.get(agent_state.active_process) or {})

        solicitud_actual = self._load_request_state(oportunidad.id, active_only=True)
        if active_process_state is None and solicitud_actual is not None:
            active_process_state = solicitud_actual.to_state_dict()

        is_project_opportunity = self._is_project_opportunity(session, oportunidad)

        return ChatTurnContext(
            conversation=ConversationRef(
                oportunidad_id=oportunidad.id,
                contacto_id=contacto.id if contacto else None,
                canal=message.canal,
                is_project_opportunity=is_project_opportunity,
            ),
            mensaje_objetivo=self._to_turn_message(message),
            agent_state=agent_state,
            active_process_state=active_process_state,
            recent_messages=self._load_recent_messages(session, oportunidad.id),
            definitions={
                "familias": self._family_catalog.list_prompt_families(),
                "opportunity_kind": "project" if is_project_opportunity else "generic",
            },
            runtime=runtime,
            solicitud_actual=solicitud_actual,
        )

    def _load_request_state(
        self,
        oportunidad_id: int,
        *,
        active_only: bool,
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

    def load_request_state(self, oportunidad_id: int) -> MaterialRequestState | None:
        return self._load_request_state(oportunidad_id, active_only=False)

    @staticmethod
    def _is_project_opportunity(session: Session, oportunidad: CRMOportunidad) -> bool:
        linked_project_id = session.exec(
            select(Proyecto.id)
            .where(Proyecto.oportunidad_id == oportunidad.id)
            .limit(1)
        ).first()
        if linked_project_id is not None:
            return True

        if oportunidad.tipo_operacion_id:
            tipo_operacion = session.get(CRMTipoOperacion, oportunidad.tipo_operacion_id)
            if tipo_operacion:
                codigo = str(tipo_operacion.codigo or "").strip().lower()
                nombre = str(tipo_operacion.nombre or "").strip().lower()
                if codigo == "proyecto" or nombre == "proyecto":
                    return True

        return False

    def resolve_latest_message_id(self, session: Session, oportunidad_id: int) -> int:
        oportunidad = session.get(CRMOportunidad, oportunidad_id)
        if not oportunidad:
            raise HTTPException(status_code=404, detail="Oportunidad no encontrada")

        fecha_mensaje_ref = self._fecha_mensaje_ref()
        latest_inbound = session.exec(
            select(CRMMensaje.id)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .where(CRMMensaje.tipo == "entrada")
            .order_by(fecha_mensaje_ref.desc(), CRMMensaje.id.desc())
            .limit(1)
        ).first()
        if latest_inbound:
            return int(latest_inbound)

        latest_message = session.exec(
            select(CRMMensaje.id)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .order_by(fecha_mensaje_ref.desc(), CRMMensaje.id.desc())
            .limit(1)
        ).first()
        if latest_message is None:
            raise HTTPException(status_code=404, detail="No hay mensajes para la oportunidad")
        return int(latest_message)

    def load(self, session: Session, oportunidad_id: int) -> ChatTurnContext:
        message_id = self.resolve_latest_message_id(session, oportunidad_id)
        return self.load_for_message(session, message_id)

    def load_for_message(
        self,
        session: Session,
        message_id: int,
        *,
        agent_state: AgentConversationState | None = None,
        runtime: TurnRuntime | None = None,
    ) -> ChatTurnContext:
        message = session.get(CRMMensaje, message_id)
        if not message or message.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Mensaje no encontrado")
        if not message.oportunidad_id:
            raise HTTPException(status_code=400, detail="Mensaje sin oportunidad asociada")

        oportunidad = session.get(CRMOportunidad, message.oportunidad_id)
        if not oportunidad:
            raise HTTPException(status_code=404, detail="Oportunidad no encontrada")

        contacto = session.get(CRMContacto, message.contacto_id) if message.contacto_id else None
        resolved_runtime = runtime or TurnRuntime()
        resolved_agent_state = agent_state or self._state_repository.load(
            oportunidad.id,
            agent_mode=resolved_runtime.agent_mode,
        )

        return self._build_turn_context(
            session=session,
            oportunidad=oportunidad,
            contacto=contacto,
            message=message,
            agent_state=resolved_agent_state,
            runtime=resolved_runtime,
        )
