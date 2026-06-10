"""Capa channel v3 para recepcion/envio con Meta."""

from __future__ import annotations

import time
import logging
from typing import Any, Callable
from uuid import uuid4

from sqlmodel import Session

from agente.v3.inbox import default_inbox
from agente.v3.models import (
    V3InboundMessage,
    V3OutboundMessage,
    utc_now,
)
from app.db import engine
from app.modules.channels.gateway import channel_gateway
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.types import ChannelEventData

logger = logging.getLogger(__name__)


def _extract_text(msg_data: dict[str, Any]) -> str | None:
    msg_type = msg_data.get("type")
    if msg_type == "text":
        return (msg_data.get("text") or {}).get("body")
    media_data = msg_data.get(str(msg_type)) if msg_type else None
    if isinstance(media_data, dict):
        return media_data.get("caption")
    return None


def _raw_meta_to_v3_inbound_messages(payload: dict[str, Any]) -> list[V3InboundMessage]:
    messages: list[V3InboundMessage] = []
    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            metadata = value.get("metadata", {}) or {}
            account_ref = str(metadata.get("phone_number_id") or metadata.get("display_phone_number") or "")
            to_phone = str(metadata.get("display_phone_number") or metadata.get("phone_number_id") or "")
            for msg_data in value.get("messages", []) or []:
                external_message_id = msg_data.get("id")
                if not external_message_id:
                    continue
                from_phone = str(msg_data.get("from") or "")
                conversation_id = f"meta:{account_ref}:{from_phone}"
                normalized_payload = {
                    "event_type": "message.received",
                    "timestamp": utc_now().isoformat(),
                    "conversation_id": conversation_id,
                    "mensaje": {
                        "meta_message_id": external_message_id,
                        "from_phone": from_phone,
                        "to_phone": to_phone,
                        "tipo": msg_data.get("type") or "unknown",
                        "texto": _extract_text(msg_data),
                    },
                }
                messages.append(
                    V3InboundMessage(
                        id=str(uuid4()),
                        provider="meta",
                        channel_type="whatsapp",
                        account_ref=account_ref,
                        conversation_id=conversation_id,
                        external_message_id=str(external_message_id),
                        from_address=from_phone,
                        to_address=to_phone,
                        text=_extract_text(msg_data),
                        message_type=str(msg_data.get("type") or "unknown"),
                        raw_payload=payload,
                        normalized_payload=normalized_payload,
                    )
                )
    return messages


class V3MetaChannel:
    """Adaptador Meta inicial.

    La recepcion parsea payloads reales de Meta y encola mensajes inbound.
    El envio queda registrado en memoria para medir el flujo sin llamar aun a Graph API.
    """

    async def receive(
        self,
        payload: dict[str, Any],
        *,
        after_enqueue: Callable[[list[V3InboundMessage]], None] | None = None,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        inbound_messages = _raw_meta_to_v3_inbound_messages(payload)
        t_normalized = time.perf_counter()

        enqueued_ids = await default_inbox.enqueue_many(inbound_messages)
        t_enqueued = time.perf_counter()
        if after_enqueue is not None and inbound_messages:
            after_enqueue(inbound_messages)

        return {
            "status": "ok",
            "received_count": len(inbound_messages),
            "enqueued_count": len(enqueued_ids),
            "message_ids": enqueued_ids,
            "timings_ms": {
                "normalize": round((t_normalized - t0) * 1000, 3),
                "enqueue": round((t_enqueued - t_normalized) * 1000, 3),
                "total": round((t_enqueued - t0) * 1000, 3),
            },
        }

    async def send_text(self, outbound: V3OutboundMessage) -> V3OutboundMessage:
        result = await channel_gateway.enviar_mensaje(
            empresa_id="v3",
            celular_id=outbound.account_ref,
            telefono_destino=outbound.to_address,
            texto=outbound.text,
            policy="text_only",
        )
        outbound.status = str(result.get("status") or "sent")
        outbound.external_message_id = result.get("meta_message_id")
        outbound.raw_response = dict(result)
        return outbound


default_meta_channel = V3MetaChannel()


def persist_received_channel_events(messages: list[V3InboundMessage]) -> None:
    """Persiste mensajes v3 en channel_events fuera del request principal."""

    if not messages:
        return
    with Session(engine) as session:
        try:
            for message in messages:
                channel_event_store.record(
                    session,
                    ChannelEventData(
                        provider=message.provider,
                        channel_type=message.channel_type,
                        account_ref=message.account_ref,
                        direction="inbound",
                        from_address=message.from_address,
                        to_address=message.to_address,
                        external_message_id=message.external_message_id,
                        status="received",
                        occurred_at=message.received_at,
                        raw_payload=message.raw_payload,
                        normalized_payload=message.normalized_payload,
                    ),
                )
            session.commit()
        except Exception:
            session.rollback()
            logger.exception("Error persistiendo channel_events desde agente v3")
