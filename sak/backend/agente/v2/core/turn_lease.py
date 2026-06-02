"""Lease durable para serializar turnos del agente por oportunidad."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
import os
from uuid import uuid4

from sqlalchemy import or_, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from agente.v2.db.models import AgentConversationState


class AgentTurnLeaseBusy(RuntimeError):
    """Indica que otra ejecucion ya procesa la misma oportunidad."""


class AgentTurnLeaseService:
    """Adquiere un lease persistido sin mantener transacciones abiertas durante el LLM."""

    @staticmethod
    def _lease_seconds() -> int:
        raw = os.getenv("AGENT_TURN_LEASE_SECONDS", "600")
        try:
            return max(int(raw), 30)
        except ValueError:
            return 600

    @classmethod
    def acquire(cls, session: Session, oportunidad_id: int) -> str:
        token = uuid4().hex
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=cls._lease_seconds())

        if cls._try_update(session, oportunidad_id, token, now, expires_at):
            return token

        try:
            session.add(
                AgentConversationState(
                    oportunidad_id=oportunidad_id,
                    lease_token=token,
                    lease_expires_at=expires_at,
                    updated_at=now,
                )
            )
            session.commit()
            return token
        except IntegrityError:
            session.rollback()

        if cls._try_update(session, oportunidad_id, token, now, expires_at):
            return token

        raise AgentTurnLeaseBusy(f"Oportunidad {oportunidad_id} con turno en curso")

    @staticmethod
    def _try_update(
        session: Session,
        oportunidad_id: int,
        token: str,
        now: datetime,
        expires_at: datetime,
    ) -> bool:
        result = session.execute(
            update(AgentConversationState)
            .where(AgentConversationState.oportunidad_id == oportunidad_id)
            .where(
                or_(
                    AgentConversationState.lease_token.is_(None),
                    AgentConversationState.lease_expires_at.is_(None),
                    AgentConversationState.lease_expires_at <= now,
                )
            )
            .values(
                lease_token=token,
                lease_expires_at=expires_at,
                updated_at=now,
            )
        )
        session.commit()
        return result.rowcount == 1

    @staticmethod
    def release(session: Session, oportunidad_id: int, token: str) -> None:
        session.execute(
            update(AgentConversationState)
            .where(AgentConversationState.oportunidad_id == oportunidad_id)
            .where(AgentConversationState.lease_token == token)
            .values(
                lease_token=None,
                lease_expires_at=None,
                updated_at=datetime.now(UTC),
            )
        )
        session.commit()
