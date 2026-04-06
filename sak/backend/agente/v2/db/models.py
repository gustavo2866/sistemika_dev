"""Modelos SQLModel para el estado persistente del agente v2 en base de datos."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Optional

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


class AgentProcessRequest(SQLModel, table=True):
    """
    Solicitud genérica de proceso del agente, una por (oportunidad, proceso).

    El campo `payload` contiene el estado específico del proceso:
    - solicitud_materiales: {items: [...], observaciones: [...]}
    - otros procesos futuros: lo que corresponda
    """

    __tablename__ = "agente_process_requests"
    __table_args__ = (
        UniqueConstraint("oportunidad_id", "proceso", name="uq_agente_request_oportunidad_proceso"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    oportunidad_id: int = Field(index=True, foreign_key="crm_oportunidades.id")
    proceso: str = Field(max_length=100, index=True)
    activa: bool = Field(default=True)
    estado: str = Field(default="draft", max_length=50)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    version: int = Field(default=1)
    ultimo_mensaje_id: Optional[int] = Field(default=None, foreign_key="crm_mensajes.id")
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)


class AgentConversationState(SQLModel, table=True):
    """
    Estado conversacional del agente por oportunidad.
    Una fila por oportunidad; se actualiza en cada turno.
    """

    __tablename__ = "agente_conversation_states"

    oportunidad_id: int = Field(primary_key=True, foreign_key="crm_oportunidades.id")
    active_process: Optional[str] = Field(default=None, max_length=100)
    process_state: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    last_message_id: Optional[int] = Field(default=None, foreign_key="crm_mensajes.id")
    last_outbound_message_id: Optional[int] = Field(default=None)
    version: int = Field(default=1)
    updated_at: datetime = Field(default_factory=_utc_now)
