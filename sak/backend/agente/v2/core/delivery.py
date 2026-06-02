"""Tipos de envio saliente y servicio de entrega de respuestas."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
import os

from sqlmodel import Session

from agente.v2.infrastructure.channels.crm_channel_adapter import CRMOutboundChannelAdapter
from app.models import CRMMensaje
from app.models.enums import TipoMensaje


DEFAULT_AGENT_REPLY_VERSION_BANNER = "sak-agent 2026-06-01.1"


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

    TERMINAL_WITHOUT_SEND_STATUSES = {
        "no_reply",
        "missing_contact",
        "missing_oportunidad",
    }

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
        reply_text = self.with_version_banner(reply_text)
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
        for key in ("respuesta", "reply_to_user", "reply", "mensaje", "texto"):
            val = result.get(key)
            if val:
                return str(val).strip()
        return ""

    @staticmethod
    def with_version_banner(text: str) -> str:
        enabled = os.getenv("AGENT_REPLY_VERSION_BANNER_ENABLED", "0").strip().lower()
        if enabled in {"0", "false", "no"}:
            return text

        banner = os.getenv("AGENT_REPLY_VERSION_BANNER", DEFAULT_AGENT_REPLY_VERSION_BANNER).strip()
        if not banner:
            return text

        prefix = f"[{banner}]"
        if text.startswith(prefix):
            return text
        return f"{prefix}\n{text}"

    @classmethod
    def is_terminal_result(cls, result: SendResult) -> bool:
        return result.sent or result.status in cls.TERMINAL_WITHOUT_SEND_STATUSES

    @staticmethod
    def has_completed_delivery(message: CRMMensaje) -> bool:
        agent_meta = dict((message.metadata_json or {}).get("agent_v2") or {})
        return bool(agent_meta.get("delivery_processed_at"))

    @staticmethod
    def _parse_iso_datetime(raw_value: object) -> datetime | None:
        if not raw_value:
            return None
        try:
            parsed = datetime.fromisoformat(str(raw_value).replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)

    @staticmethod
    def _env_seconds(name: str, default: int) -> int:
        try:
            return max(int(os.getenv(name, str(default))), 1)
        except ValueError:
            return default

    @classmethod
    def pending_stale_seconds(cls) -> int:
        return cls._env_seconds("AGENT_DELIVERY_PENDING_STALE_SECONDS", 120)

    @classmethod
    def retry_after_seconds(cls) -> int:
        return cls._env_seconds("AGENT_DELIVERY_RETRY_AFTER_SECONDS", 60)

    @classmethod
    def has_recent_pending_delivery(
        cls,
        message: CRMMensaje,
        *,
        stale_after_seconds: int | None = None,
    ) -> bool:
        agent_meta = dict((message.metadata_json or {}).get("agent_v2") or {})
        pending_at = cls._parse_iso_datetime(agent_meta.get("delivery_pending_at"))
        if pending_at is None:
            return False
        stale_seconds = stale_after_seconds or cls.pending_stale_seconds()
        return datetime.now(UTC) - pending_at < timedelta(seconds=stale_seconds)

    @classmethod
    def has_recent_delivery_attempt(
        cls,
        message: CRMMensaje,
        *,
        retry_after_seconds: int | None = None,
    ) -> bool:
        agent_meta = dict((message.metadata_json or {}).get("agent_v2") or {})
        attempted_at = cls._parse_iso_datetime(agent_meta.get("delivery_last_attempt_at"))
        if attempted_at is None:
            return False
        retry_seconds = retry_after_seconds or cls.retry_after_seconds()
        return datetime.now(UTC) - attempted_at < timedelta(seconds=retry_seconds)

    @staticmethod
    def mark_delivery_pending(session: Session, message: CRMMensaje) -> None:
        metadata = dict(message.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        attempt = int(agent_meta.get("delivery_attempts") or 0) + 1
        agent_meta["delivery_attempts"] = attempt
        agent_meta["delivery_pending_at"] = datetime.now(UTC).isoformat()
        agent_meta["delivery"] = SendResult(sent=False, status="pending").to_dict()
        agent_meta.pop("delivery_processed_at", None)
        metadata["agent_v2"] = agent_meta
        message.metadata_json = metadata
        session.add(message)
        session.commit()
        session.refresh(message)

    @classmethod
    def record_delivery_result(
        cls,
        session: Session,
        message: CRMMensaje,
        result: SendResult,
    ) -> None:
        if message.tipo != TipoMensaje.ENTRADA.value:
            return

        # "Procesado por agente" no equivale a "leido por usuario".
        # El estado del inbox debe seguir en `nuevo` hasta que la UI
        # llame explicitamente a /acciones/marcar-leidos.
        metadata = dict(message.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        now = datetime.now(UTC).isoformat()
        agent_meta["delivery"] = result.to_dict()
        agent_meta["delivery_last_attempt_at"] = now
        agent_meta.pop("delivery_pending_at", None)
        if result.outbound_message_id is not None:
            agent_meta["outbound_message_id"] = result.outbound_message_id
        if cls.is_terminal_result(result):
            agent_meta["delivery_processed_at"] = now
        else:
            agent_meta.pop("delivery_processed_at", None)
        metadata["agent_v2"] = agent_meta
        message.metadata_json = metadata
        session.add(message)
        session.commit()
        session.refresh(message)

    @staticmethod
    def mark_delivery_superseded(
        session: Session,
        message: CRMMensaje,
        *,
        superseded_by_message_id: int,
    ) -> None:
        metadata = dict(message.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        now = datetime.now(UTC).isoformat()
        agent_meta["delivery"] = SendResult(sent=False, status="superseded").to_dict()
        agent_meta["delivery_superseded_by_message_id"] = superseded_by_message_id
        agent_meta["delivery_processed_at"] = now
        agent_meta.pop("delivery_pending_at", None)
        metadata["agent_v2"] = agent_meta
        message.metadata_json = metadata
        session.add(message)
        session.commit()
        session.refresh(message)

    @classmethod
    def mark_inbound_as_processed(cls, session: Session, message: CRMMensaje) -> None:
        """Compatibilidad para callers existentes que ya entregaron la respuesta."""
        cls.record_delivery_result(session, message, SendResult(sent=True, status="sent"))


