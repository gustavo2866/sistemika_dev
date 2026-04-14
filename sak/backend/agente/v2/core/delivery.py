"""Tipos de envio saliente y servicio de entrega de respuestas."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlmodel import Session

from agente.v2.infrastructure.channels.crm_channel_adapter import CRMOutboundChannelAdapter
from app.models import CRMMensaje
from app.models.enums import TipoMensaje


# ---------------------------------------------------------------------------
# Tipos de canal saliente
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class SendTextCommand:
    """Describe el comando minimo para enviar un mensaje saliente por canal."""

    contenido: str
    contacto_id: int
    oportunidad_id: int
    responsable_id: int | None = None
    contacto_referencia: str | None = None
    canal: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass(slots=True)
class SendResult:
    """Resultado de una entrega saliente."""

    sent: bool
    status: str
    outbound_message_id: int | None = None
    meta_message_id: str | None = None
    error_message: str | None = None

    def to_dict(self) -> dict:
        return {
            "sent": self.sent,
            "status": self.status,
            "outbound_message_id": self.outbound_message_id,
            "meta_message_id": self.meta_message_id,
            "error_message": self.error_message,
        }

    @classmethod
    def from_dict(cls, payload: dict | None) -> "SendResult":
        raw = payload or {}
        return cls(
            sent=bool(raw.get("sent")),
            status=str(raw.get("status") or "preview").strip(),
            outbound_message_id=raw.get("outbound_message_id"),
            meta_message_id=str(raw.get("meta_message_id") or "").strip() or None,
            error_message=str(raw.get("error_message") or "").strip() or None,
        )


# ---------------------------------------------------------------------------
# Servicio de entrega
# ---------------------------------------------------------------------------

class TurnDeliveryService:
    """Entrega la respuesta del agente al canal saliente."""

    def __init__(self, channel_adapter: CRMOutboundChannelAdapter | None = None) -> None:
        self._channel_adapter = channel_adapter or CRMOutboundChannelAdapter()

    async def deliver_result(
        self,
        *,
        session: Session,
        message: CRMMensaje,
        result: dict,
    ) -> SendResult:
        reply_text = self.extract_reply_text(result)
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
                responsable_id=message.responsable_id
                or (message.oportunidad.responsable_id if message.oportunidad else None),
                contacto_referencia=message.contacto_referencia,
                canal=message.canal,
                metadata={"source_message_id": message.id},
            ),
        )

    @staticmethod
    def extract_reply_text(result: dict) -> str:
        for key in ("respuesta", "reply", "mensaje", "texto"):
            val = result.get(key)
            if val:
                return str(val).strip()
        return ""

    @staticmethod
    def mark_inbound_as_processed(session: Session, message: CRMMensaje) -> None:
        if message.tipo != TipoMensaje.ENTRADA.value:
            return

        # "Procesado por agente" no equivale a "leido por usuario".
        # El estado del inbox debe seguir en `nuevo` hasta que la UI
        # llame explicitamente a /acciones/marcar-leidos.
        metadata = dict(message.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        agent_meta["delivery_processed_at"] = datetime.now(UTC).isoformat()
        metadata["agent_v2"] = agent_meta
        message.metadata_json = metadata
        session.add(message)
        session.commit()
        session.refresh(message)


