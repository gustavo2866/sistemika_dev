"""Contexto que el core entrega a cada proceso para procesar un turno."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from agente.v2.core.state import ConversationState


@dataclass(slots=True)
class MessageInfo:
    """Modelo liviano de un mensaje — lo minimo que un proceso necesita."""

    id: int
    contenido: str
    tipo: str               # "entrada" | "salida"
    canal: str | None = None
    estado: str | None = None
    fecha: str | None = None

    def to_prompt_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tipo": self.tipo,
            "estado": self.estado,
            "canal": self.canal,
            "contenido": self.contenido,
            "fecha": self.fecha,
        }


@dataclass(slots=True)
class TurnContext:
    """Contexto completo de un turno — lo que el orquestador entrega a cada proceso."""

    oportunidad_id: int
    contacto_id: int | None
    canal: str | None
    trigger: str                        # "webhook" | "manual_button"
    message: MessageInfo
    history: list[MessageInfo]
    conversation_state: ConversationState
    is_project: bool = False

    @property
    def active_process(self) -> str | None:
        return self.conversation_state.active_process

    @property
    def process_state(self) -> dict[str, Any]:
        return self.conversation_state.process_state
