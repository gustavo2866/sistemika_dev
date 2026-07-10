"""Contratos livianos para el pipeline experimental v3."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(slots=True)
class V3InboundMessage:
    """Mensaje recibido desde un channel y listo para inbox."""

    id: str
    provider: str
    channel_type: str
    account_ref: str
    conversation_id: str
    external_message_id: str
    from_address: str
    to_address: str
    text: str | None
    message_type: str
    raw_payload: dict[str, Any]
    normalized_payload: dict[str, Any]
    received_at: datetime = field(default_factory=utc_now)
    enqueued_at: datetime | None = None
    queue_name: str | None = None


@dataclass(slots=True)
class V3OrchestratorResult:
    """Respuesta minima del orquestador v3."""

    status: str
    reply_text: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class V3ConversationContext:
    """Estado conversacional v3 en memoria."""

    conversation_id: str
    active_process: str | None = None
    process_state: dict[str, Any] = field(default_factory=dict)
    debug_timings: dict[str, Any] = field(default_factory=dict)
    last_inbound_message_id: str | None = None
    last_outbound_message_id: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def copy(self) -> "V3ConversationContext":
        return V3ConversationContext(
            conversation_id=self.conversation_id,
            active_process=self.active_process,
            process_state=dict(self.process_state),
            debug_timings=dict(self.debug_timings),
            last_inbound_message_id=self.last_inbound_message_id,
            last_outbound_message_id=self.last_outbound_message_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


@dataclass(slots=True)
class V3ProcessMessage:
    """Mensaje saliente adicional generado por un subproceso."""

    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class V3ProcessResult:
    """Resultado de subproceso: contexto actualizado y respuesta opcional."""

    context: V3ConversationContext
    reply_text: str | None = None
    status: str = "ok"
    metadata: dict[str, Any] = field(default_factory=dict)
    additional_messages: list[V3ProcessMessage] = field(default_factory=list)


@dataclass(slots=True)
class V3OutboundMessage:
    """Respuesta pendiente o enviada por outbox."""

    id: str
    provider: str
    channel_type: str
    account_ref: str
    to_address: str
    text: str
    source_message_id: str
    source_external_message_id: str | None = None
    payload_type: Literal["text", "interactive"] = "text"
    interactive: dict[str, Any] | None = None
    queue_name: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    enqueued_at: datetime | None = None
    sent_at: datetime | None = None
    external_message_id: str | None = None
    raw_response: dict[str, Any] = field(default_factory=dict)
    status: str = "pending"

    @classmethod
    def recorded_meta_reply(
        cls,
        *,
        source: V3InboundMessage,
        text: str,
        interactive: dict[str, Any] | None = None,
    ) -> "V3OutboundMessage":
        return cls(
            id=str(uuid4()),
            provider="meta",
            channel_type="whatsapp",
            account_ref=source.account_ref,
            to_address=source.from_address,
            text=text,
            source_message_id=source.id,
            source_external_message_id=source.external_message_id,
            payload_type="interactive" if interactive else "text",
            interactive=interactive,
            queue_name=source.queue_name,
        )


@dataclass(slots=True)
class V3ProcessedMessage:
    """Resultado de procesar un mensaje de inbox."""

    inbound: V3InboundMessage
    orchestrator_result: V3OrchestratorResult
    outbound_message_id: str
    started_at: datetime
    finished_at: datetime
    timings_ms: dict[str, float]

    def as_dict(self) -> dict[str, Any]:
        return {
            "message_id": self.inbound.id,
            "conversation_id": self.inbound.conversation_id,
            "external_message_id": self.inbound.external_message_id,
            "queue": self.inbound.queue_name,
            "from_address": self.inbound.from_address,
            "to_address": self.inbound.to_address,
            "orchestrator": {
                "status": self.orchestrator_result.status,
                "reply_text": self.orchestrator_result.reply_text,
                "metadata": self.orchestrator_result.metadata,
            },
            "outbox": {
                "message_id": self.outbound_message_id,
                "status": "queued" if self.outbound_message_id else "not_queued",
            },
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat(),
            "timings_ms": self.timings_ms,
        }


def message_from_normalized_meta_payload(payload: dict[str, Any]) -> V3InboundMessage:
    msg = payload["mensaje"]
    return V3InboundMessage(
        id=str(uuid4()),
        provider="meta",
        channel_type="whatsapp",
        account_ref=str((msg.get("celular") or {}).get("id") or msg.get("to_phone") or ""),
        conversation_id=f"meta:{str((msg.get('celular') or {}).get('id') or msg.get('to_phone') or '')}:{str(msg['from_phone'])}",
        external_message_id=str(msg["meta_message_id"]),
        from_address=str(msg["from_phone"]),
        to_address=str(msg["to_phone"]),
        text=msg.get("texto"),
        message_type=str(msg.get("tipo") or "unknown"),
        raw_payload=dict(payload.get("raw_meta_payload") or payload),
        normalized_payload=payload,
        queue_name=payload.get("queue_name"),
    )
