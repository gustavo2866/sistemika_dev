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
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.gateway import channel_gateway
from app.modules.channels.persistence import ChannelEvent, channel_event_store
from app.modules.channels.providers.meta.client import meta_graph_client
from app.modules.channels.types import ChannelEventData
from app.modules.channels.utils import normalize_phone_for_meta
from app.services.audio_transcription_service import audio_transcription_service

logger = logging.getLogger(__name__)


def _extract_text(msg_data: dict[str, Any]) -> str | None:
    msg_type = msg_data.get("type")
    if msg_type == "text":
        return (msg_data.get("text") or {}).get("body")
    if msg_type == "interactive":
        interactive = msg_data.get("interactive") or {}
        interactive_type = interactive.get("type")
        if interactive_type == "list_reply":
            reply = interactive.get("list_reply") or {}
            return str(reply.get("id") or reply.get("title") or "").strip() or None
        if interactive_type == "button_reply":
            reply = interactive.get("button_reply") or {}
            return str(reply.get("id") or reply.get("title") or "").strip() or None
    media_data = msg_data.get(str(msg_type)) if msg_type else None
    if isinstance(media_data, dict):
        return media_data.get("caption")
    return None


def _extract_media_data(msg_data: dict[str, Any]) -> dict[str, Any]:
    msg_type = str(msg_data.get("type") or "")
    media_data = msg_data.get(msg_type) if msg_type else None
    if not isinstance(media_data, dict):
        return {}
    return {
        "id": media_data.get("id"),
        "caption": media_data.get("caption"),
        "filename": media_data.get("filename"),
        "mime_type": media_data.get("mime_type"),
    }


def _audio_filename(media_id: str, mime_type: str | None) -> str:
    extension = "ogg"
    normalized = (mime_type or "").split(";")[0].strip().lower()
    if normalized == "audio/mpeg":
        extension = "mp3"
    elif normalized in {"audio/mp4", "audio/m4a"}:
        extension = "m4a"
    elif normalized == "audio/wav":
        extension = "wav"
    elif normalized == "audio/webm":
        extension = "webm"
    return f"{media_id}.{extension}"


def _raw_meta_to_v3_inbound_messages(payload: dict[str, Any], *, queue_name: str | None = None) -> list[V3InboundMessage]:
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
                msg_type = str(msg_data.get("type") or "unknown")
                media_data = _extract_media_data(msg_data)
                extracted_text = _extract_text(msg_data)
                from_phone = str(msg_data.get("from") or "")
                conversation_id = f"meta:{account_ref}:{from_phone}"
                normalized_payload = {
                    "event_type": "message.received",
                    "timestamp": utc_now().isoformat(),
                    "conversation_id": conversation_id,
                    "agent_v3": {
                        "queue": queue_name,
                    },
                    "mensaje": {
                        "meta_message_id": external_message_id,
                        "from_phone": from_phone,
                        "to_phone": to_phone,
                        "tipo": msg_type,
                        "texto": extracted_text,
                        "media_id": media_data.get("id"),
                        "caption": media_data.get("caption"),
                        "filename": media_data.get("filename"),
                        "mime_type": media_data.get("mime_type"),
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
                        text=extracted_text,
                        message_type=msg_type,
                        raw_payload=payload,
                        normalized_payload=normalized_payload,
                        queue_name=queue_name,
                    )
                )
    return messages


def _dedupe_key(message: V3InboundMessage) -> tuple[str, str, str] | None:
    if message.message_type != "interactive":
        return None
    text = str(message.text or "").strip()
    if not text:
        return None
    if not text.startswith(("parte_fecha:", "parte_accion:")):
        return None
    return (str(message.queue_name or ""), message.conversation_id, text)


class V3MetaChannel:
    """Adaptador Meta inicial.

    La recepcion parsea payloads reales de Meta y encola mensajes inbound.
    El envio queda registrado en memoria para medir el flujo sin llamar aun a Graph API.
    """

    _DEDUP_TTL_SECONDS = 5.0

    def __init__(self) -> None:
        self._recent_inbound_keys: dict[tuple[str, str, str], float] = {}

    async def receive(
        self,
        payload: dict[str, Any],
        *,
        inbox: V3Inbox = default_inbox,
        queue_name: str | None = None,
        after_enqueue: Callable[[list[V3InboundMessage]], None] | None = None,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        inbound_messages = _raw_meta_to_v3_inbound_messages(payload, queue_name=queue_name)
        t_normalized = time.perf_counter()
        await _prepare_audio_messages(inbound_messages)
        t_audio = time.perf_counter()

        received_count = len(inbound_messages)
        inbound_messages = self._dedupe_inbound_messages(inbound_messages)
        enqueued_ids = await inbox.enqueue_many(inbound_messages)
        t_enqueued = time.perf_counter()
        if after_enqueue is not None and inbound_messages:
            after_enqueue(inbound_messages)
        timings_ms = {
            "normalize": round((t_normalized - t0) * 1000, 3),
            "audio": round((t_audio - t_normalized) * 1000, 3),
            "enqueue": round((t_enqueued - t_audio) * 1000, 3),
            "total": round((t_enqueued - t0) * 1000, 3),
        }
        logger.info(
            "v3_meta_receive_timing received_count=%s enqueued_count=%s skipped_duplicates=%s normalize_ms=%s audio_ms=%s enqueue_ms=%s total_ms=%s",
            received_count,
            len(enqueued_ids),
            received_count - len(inbound_messages),
            timings_ms["normalize"],
            timings_ms["audio"],
            timings_ms["enqueue"],
            timings_ms["total"],
        )

        return {
            "status": "ok",
            "received_count": received_count,
            "enqueued_count": len(enqueued_ids),
            "skipped_duplicates": received_count - len(inbound_messages),
            "message_ids": enqueued_ids,
            "timings_ms": timings_ms,
        }

    def _dedupe_inbound_messages(self, messages: list[V3InboundMessage]) -> list[V3InboundMessage]:
        now = time.monotonic()
        self._recent_inbound_keys = {
            key: expires_at
            for key, expires_at in self._recent_inbound_keys.items()
            if expires_at > now
        }

        accepted: list[V3InboundMessage] = []
        for message in messages:
            key = _dedupe_key(message)
            if key and key in self._recent_inbound_keys:
                logger.info(
                    "v3_meta_duplicate_inbound_skipped conversation_id=%s external_message_id=%s text=%s",
                    message.conversation_id,
                    message.external_message_id,
                    message.text,
                )
                continue
            if key:
                self._recent_inbound_keys[key] = now + self._DEDUP_TTL_SECONDS
            accepted.append(message)
        return accepted

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

    async def send_interactive(self, outbound: V3OutboundMessage) -> V3OutboundMessage:
        if not outbound.interactive:
            return await self.send_text(outbound)

        t0 = time.perf_counter()
        with Session(engine) as session:
            account_config = meta_account_resolver.resolve(session, outbound.account_ref)
            payload = {
                "messaging_product": "whatsapp",
                "to": normalize_phone_for_meta(outbound.to_address),
                "type": "interactive",
                "interactive": outbound.interactive,
            }
            try:
                result = await meta_graph_client.send_message(
                    access_token=account_config.access_token,
                    phone_number_id=account_config.phone_number_id,
                    payload=payload,
                )
                external_message_id = (
                    ((result.get("messages") or [{}])[0] or {}).get("id")
                    or result.get("meta_message_id")
                )
                channel_event_store.record(
                    session,
                    ChannelEventData(
                        provider=outbound.provider,
                        channel_type=outbound.channel_type,
                        account_ref=outbound.account_ref,
                        external_account_id=account_config.phone_number_id,
                        direction="outbound",
                        from_address=account_config.phone_number_id,
                        to_address=outbound.to_address,
                        external_message_id=external_message_id,
                        status="sent",
                        raw_payload=result,
                        normalized_payload={
                            "request": payload,
                            "message_type": "interactive",
                            "interactive_type": outbound.interactive.get("type"),
                            "agent_v3": _agent_v3_metadata(outbound),
                        },
                    ),
                )
                session.commit()
            except Exception as exc:
                channel_event_store.record(
                    session,
                    ChannelEventData(
                        provider=outbound.provider,
                        channel_type=outbound.channel_type,
                        account_ref=outbound.account_ref,
                        external_account_id=account_config.phone_number_id,
                        direction="outbound",
                        from_address=account_config.phone_number_id,
                        to_address=outbound.to_address,
                        status="failed",
                        normalized_payload={
                            "request": payload,
                            "message_type": "interactive",
                            "error": str(exc),
                            "agent_v3": _agent_v3_metadata(outbound),
                        },
                    ),
                )
                session.commit()
                raise
        t_send = time.perf_counter()
        outbound.status = "sent"
        outbound.external_message_id = external_message_id
        outbound.raw_response = dict(result)
        _annotate_sent_channel_event(outbound)
        t_annotate = time.perf_counter()
        logger.info(
            "v3_meta_send_interactive_timing source_external_message_id=%s outbound_external_message_id=%s "
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


async def _prepare_audio_messages(messages: list[V3InboundMessage]) -> None:
    for message in messages:
        if message.message_type != "audio":
            continue
        await _prepare_audio_message(message)


async def _prepare_audio_message(message: V3InboundMessage) -> None:
    mensaje = dict((message.normalized_payload or {}).get("mensaje") or {})
    media_id = str(mensaje.get("media_id") or "").strip()
    mime_type = mensaje.get("mime_type")
    filename = mensaje.get("filename")
    audio_meta = {
        "tipo": "audio",
        "id": media_id or None,
        "mime_type": mime_type,
        "filename": filename,
        "caption": mensaje.get("caption"),
    }
    try:
        if not media_id:
            raise ValueError("Audio sin media_id")
        with Session(engine) as session:
            account_config = meta_account_resolver.resolve(session, message.account_ref)
        download = await meta_graph_client.download_media(
            access_token=account_config.access_token,
            media_id=media_id,
        )
        resolved_mime_type = download.mime_type or mime_type
        transcription = await audio_transcription_service.transcribe_bytes(
            download.content,
            filename=str(filename or _audio_filename(media_id, resolved_mime_type)),
            mime_type=resolved_mime_type,
        )
        audio_meta.update(
            {
                "transcription": transcription,
                "transcription_status": "ok",
                "download_mime_type": download.mime_type,
                "file_size": download.file_size,
                "sha256": download.sha256,
            }
        )
        _apply_audio_text(message, transcription or "[Audio recibido]", audio_meta)
    except Exception as exc:
        logger.warning(
            "No se pudo transcribir audio v3 external_message_id=%s media_id=%s",
            message.external_message_id,
            media_id or None,
            exc_info=True,
        )
        audio_meta.update(
            {
                "transcription_status": "failed",
                "transcription_error": str(exc),
            }
        )
        _apply_audio_text(message, "[Audio recibido]", audio_meta)


def _apply_audio_text(message: V3InboundMessage, text: str, audio_meta: dict[str, Any]) -> None:
    message.text = text
    normalized = dict(message.normalized_payload or {})
    mensaje = dict(normalized.get("mensaje") or {})
    mensaje["texto"] = text
    mensaje["audio"] = audio_meta
    normalized["mensaje"] = mensaje
    message.normalized_payload = normalized


def _annotate_sent_channel_event(outbound: V3OutboundMessage) -> None:
    """Agrega correlacion v3 al channel_event outbound persistido por el gateway."""

    if not outbound.external_message_id:
        return

    with Session(engine) as session:
        rows = session.exec(
            select(ChannelEvent)
            .where(ChannelEvent.deleted_at.is_(None))
            .where(ChannelEvent.provider == outbound.provider)
            .where(ChannelEvent.channel_type == outbound.channel_type)
            .where(ChannelEvent.direction == "outbound")
            .where(ChannelEvent.external_message_id == outbound.external_message_id)
            .order_by(ChannelEvent.created_at.desc(), ChannelEvent.id.desc())
            .limit(20)
        ).all()
        row = next(
            (
                candidate
                for candidate in rows
                if isinstance((candidate.normalized_payload or {}).get("request"), dict)
            ),
            None,
        )
        if row is None:
            return

        normalized = dict(row.normalized_payload or {})
        normalized["agent_v3"] = _agent_v3_metadata(outbound)
        row.normalized_payload = normalized
        session.add(row)
        session.commit()


def _agent_v3_metadata(outbound: V3OutboundMessage) -> dict[str, Any]:
    return {
        "outbound_message_id": outbound.id,
        "source_message_id": outbound.source_message_id,
        "source_external_message_id": outbound.source_external_message_id,
        "queue": outbound.queue_name,
    }


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
