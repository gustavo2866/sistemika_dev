"""Stores de persistencia en base de datos para el agente v2."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlmodel import Session

from agente.v2.core.state import ConversationState
from agente.v2.db.models import AgentConversationState, AgentProcessRequest
from agente.v2.processes.solicitud_materiales.models import MaterialRequestState


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


# ---------------------------------------------------------------------------
# DbConversationStateStore
# ---------------------------------------------------------------------------

class DbConversationStateStore:
    """
    Reemplaza JsonConversationStateStore.
    Persiste ConversationState en agente_conversation_states.
    Usa SELECT FOR UPDATE para serializar acceso por oportunidad.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def load(self, oportunidad_id: int) -> ConversationState:
        row = self._session.get(AgentConversationState, oportunidad_id)
        if row is None:
            return ConversationState.empty(oportunidad_id)
        return ConversationState(
            oportunidad_id=row.oportunidad_id,
            active_process=row.active_process,
            process_state=dict(row.process_state or {}),
            last_message_id=row.last_message_id,
            last_outbound_message_id=row.last_outbound_message_id,
            version=row.version,
        )

    def load_for_update(self, oportunidad_id: int) -> ConversationState:
        """Carga con SELECT FOR UPDATE — serializa turnos concurrentes del mismo contacto."""
        stmt = (
            select(AgentConversationState)
            .where(AgentConversationState.oportunidad_id == oportunidad_id)
            .with_for_update()
        )
        row = self._session.exec(stmt).first()
        if row is None:
            return ConversationState.empty(oportunidad_id)
        return ConversationState(
            oportunidad_id=row.oportunidad_id,
            active_process=row.active_process,
            process_state=dict(row.process_state or {}),
            last_message_id=row.last_message_id,
            last_outbound_message_id=row.last_outbound_message_id,
            version=row.version,
        )

    def save(self, state: ConversationState) -> ConversationState:
        row = self._session.get(AgentConversationState, state.oportunidad_id)
        now = datetime.now(UTC)
        if row is None:
            row = AgentConversationState(
                oportunidad_id=state.oportunidad_id,
                active_process=state.active_process,
                process_state=dict(state.process_state),
                last_message_id=state.last_message_id,
                last_outbound_message_id=state.last_outbound_message_id,
                version=1,
                updated_at=now,
            )
            state.version = 1
        else:
            row.active_process = state.active_process
            row.process_state = dict(state.process_state)
            row.last_message_id = state.last_message_id
            row.last_outbound_message_id = state.last_outbound_message_id
            row.version = row.version + 1
            row.updated_at = now
            state.version = row.version
        self._session.add(row)
        # No hace commit — el caller (orchestrator) lo hace al final del turno
        return state


# ---------------------------------------------------------------------------
# DbProcessRequestStore
# ---------------------------------------------------------------------------

class DbProcessRequestStore:
    """
    Reemplaza RequestStore.
    Persiste MaterialRequestState en agente_process_requests.
    """

    PROCESO = "solicitud_materiales"

    def __init__(self, session: Session) -> None:
        self._session = session

    def _get_row(self, oportunidad_id: int) -> AgentProcessRequest | None:
        stmt = (
            select(AgentProcessRequest)
            .where(
                AgentProcessRequest.oportunidad_id == oportunidad_id,
                AgentProcessRequest.proceso == self.PROCESO,
            )
        )
        return self._session.exec(stmt).first()

    def load(self, oportunidad_id: int) -> MaterialRequestState | None:
        row = self._get_row(oportunidad_id)
        if row is None:
            return None
        return self._row_to_state(row, oportunidad_id)

    def load_active(self, oportunidad_id: int) -> MaterialRequestState | None:
        state = self.load(oportunidad_id)
        if state is None or not state.activa:
            return None
        return state

    def save(self, request_state: MaterialRequestState, ultimo_mensaje_id: int | None) -> MaterialRequestState:
        row = self._get_row(request_state.oportunidad_id)
        now = datetime.now(UTC)
        payload = self._state_to_payload(request_state)

        if row is None:
            row = AgentProcessRequest(
                oportunidad_id=request_state.oportunidad_id,
                proceso=self.PROCESO,
                activa=request_state.activa,
                estado=request_state.estado_solicitud,
                payload=payload,
                version=1,
                ultimo_mensaje_id=ultimo_mensaje_id,
                created_at=now,
                updated_at=now,
            )
            request_state.version = 1
            request_state.created_at = now.isoformat()
        else:
            row.activa = request_state.activa
            row.estado = request_state.estado_solicitud
            row.payload = payload
            row.version = row.version + 1
            row.ultimo_mensaje_id = ultimo_mensaje_id
            row.updated_at = now
            request_state.version = row.version
            request_state.created_at = row.created_at.isoformat()

        request_state.updated_at = now.isoformat()
        request_state.ultimo_mensaje_id = ultimo_mensaje_id

        self._session.add(row)
        # No hace commit — el caller lo hace
        return request_state

    @staticmethod
    def _state_to_payload(state: MaterialRequestState) -> dict[str, Any]:
        d = state.to_state_dict()
        # Extraemos solo el contenido variable; oportunidad_id y metadatos de estado
        # están en columnas propias de la tabla
        return {
            "items": d.get("items", []),
            "observaciones": d.get("observaciones", []),
        }

    @staticmethod
    def _row_to_state(row: AgentProcessRequest, oportunidad_id: int) -> MaterialRequestState:
        payload = dict(row.payload or {})
        state_dict = {
            "oportunidad_id": oportunidad_id,
            "activa": row.activa,
            "estado_solicitud": row.estado,
            "version": row.version,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
            "ultimo_mensaje_id": row.ultimo_mensaje_id,
            "items": payload.get("items", []),
            "observaciones": payload.get("observaciones", []),
        }
        return MaterialRequestState.from_state_dict(state_dict, oportunidad_id)
