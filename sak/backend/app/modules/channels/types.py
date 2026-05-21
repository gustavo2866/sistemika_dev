"""Provider-neutral channel types."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

SendPolicy = Literal["auto", "text_only", "template_only"]


@dataclass(slots=True)
class SendMessageCommand:
    provider: str
    channel_type: str
    account_ref: str
    to_address: str
    text: str
    company_ref: str | None = None
    contact_name: str | None = None
    template_fallback_name: str = "notificacion_general"
    template_fallback_language: str = "en"
    policy: SendPolicy = "auto"


@dataclass(slots=True)
class MarkReadCommand:
    provider: str
    channel_type: str
    account_ref: str
    external_message_id: str
    contact_address: str | None = None
    business_address: str | None = None
    show_typing: bool = False


@dataclass(slots=True)
class DeliveryResult:
    status: str
    external_message_id: str | None = None
    provider_message_type: str | None = None
    raw_response: dict[str, Any] = field(default_factory=dict)

    def to_metaw_compatible_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "meta_message_id": self.external_message_id,
            "provider_message_type": self.provider_message_type,
            "raw_response": self.raw_response,
        }


@dataclass(slots=True)
class ChannelEventData:
    provider: str
    channel_type: str
    account_ref: str
    direction: str
    from_address: str | None = None
    to_address: str | None = None
    external_message_id: str | None = None
    external_event_id: str | None = None
    external_account_id: str | None = None
    status: str | None = None
    occurred_at: datetime | None = None
    raw_payload: dict[str, Any] = field(default_factory=dict)
    normalized_payload: dict[str, Any] = field(default_factory=dict)
