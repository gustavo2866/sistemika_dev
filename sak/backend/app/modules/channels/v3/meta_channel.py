"""Capa channel v3 para recepcion/envio con Meta."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable
from uuid import uuid4

from sqlmodel import Session, select

from agente.v3.contracts import (
    V3InboundMessage,
    V3OutboundMessage,
    utc_now,
)
from agente.v3.inbox import default_inbox
from agente.v3.inbox.queue import V3Inbox
from app.db import engine
from app.modules.channels.gateway import channel_gateway
from app.modules.channels.persistence import ChannelEvent, channel_event_store
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
        inbox: V3Inbox = default_inbox,
        after_enqueue: Callable[[list[V3InboundMessage]], None] | None = None,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        inbound_messages = _raw_meta_to_v3_inbound_messages(payload)
        t_normalized = time.perf_counter()

        enqueued_ids = await inbox.enqueue_many(inbound_messages)
        t_enqueued = time.perf_counter()
        if after_enqueue is not None and inbound_messages:
            after_enqueue(inbound_messages)
        timings_ms = {
            "normalize": round((t_normalized - t0) * 1000, 3),
            "enqueue": round((t_enqueued - t_normalized) * 1000, 3),
            "total": round((t_enqueued - t0) * 1000, 3),
        }
        logger.info(
            "v3_meta_receive_timing received_count=%s enqueued_count=%s normalize_ms=%s enqueue_ms=%s total_ms=%s",
            len(inbound_messages),
            len(enqueued_ids),
            timings_ms["normalize"],
            timings_ms["enqueue"],
            timings_ms["total"],
        )

        return {
            "status": "ok",
            "received_count": len(inbound_messages),
            "enqueued_count": len(enqueued_ids),
            "message_ids": enqueued_ids,
            "timings_ms": timings_ms,
        }

    async def send_text(self, outbound: V3OutboundMessage) -> V3OutboundMessage:
        t0 = time.perf_counter()
        result = await channel_gateway.enviar_mensaje(
            empresa_id="v3",
            celular_id=outbound.account_ref,
            telefono_destino=outbound.to_address,
            texto=outbound.text,
            policy="text_only",
        )
        t_send = time.perf_counter()
        outbound.status = str(result.get("status") or "sent")
        outbound.external_message_id = result.get("meta_message_id")
        outbound.raw_response = dict(result)
        _annotate_sent_channel_event(outbound)
        t_annotate = time.perf_counter()
        logger.info(
            "v3_meta_send_timing source_external_message_id=%s outbound_external_message_id=%s "
            "to_address=%s status=%s send_ms=%s annotate_ms=%s total_ms=%s",
            outbound.source_external_message_id,
            outbound.external_message_id,
            outbound.to_address,
            outbound.status,
            round((t_send - t0) * 1000, 3),
            round((t_annotate - t_send) * 1000, 3),
            round((t_annotate - t0) * 1000, 3),
        )
        return outbound


default_meta_channel = V3MetaChannel()


def _annotate_sent_channel_event(outbound: V3OutboundMessage) -> None:
    """Agrega correlacion v3 al channel_event outbound persistido por el gateway."""

    if not outbound.external_message_id:
        return

    with Session(engine) as session:
        row = session.exec(
            select(ChannelEvent)
            .where(ChannelEvent.deleted_at.is_(None))
            .where(ChannelEvent.provider == outbound.provider)
            .where(ChannelEvent.channel_type == outbound.channel_type)
            .where(ChannelEvent.direction == "outbound")
            .where(ChannelEvent.external_message_id == outbound.external_message_id)
            .order_by(ChannelEvent.created_at.desc(), ChannelEvent.id.desc())
            .limit(1)
        ).first()
        if row is None:
            return

        normalized = dict(row.normalized_payload or {})
        normalized["agent_v3"] = {
            "outbound_message_id": outbound.id,
            "source_message_id": outbound.source_message_id,
            "source_external_message_id": outbound.source_external_message_id,
        }
        row.normalized_payload = normalized
        session.add(row)
        session.commit()


def persist_received_channel_events(messages: list[V3InboundMessage]) -> None:
    """Persiste mensajes v3 en channel_events fuera del request principal."""

    if not messages:
        return
    started = time.perf_counter()
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
            logger.info(
                "v3_channel_events_persist_timing count=%s persist_ms=%s",
                len(messages),
                round((time.perf_counter() - started) * 1000, 3),
            )
        except Exception:
            session.rollback()
            logger.exception(
                "Error persistiendo channel_events desde agente v3 count=%s persist_ms=%s",
                len(messages),
                round((time.perf_counter() - started) * 1000, 3),
            )
