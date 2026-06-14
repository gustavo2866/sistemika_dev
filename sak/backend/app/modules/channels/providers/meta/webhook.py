"""Meta webhook parsing helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from sqlmodel import Session

from app.modules.channels.config import meta_account_resolver


def _stable_uuid(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"meta:{value}"))


def _timestamp_from_meta(value: str | int | None) -> str:
    if value is None:
        return datetime.now(UTC).isoformat()
    try:
        return datetime.fromtimestamp(int(value), UTC).isoformat()
    except (TypeError, ValueError):
        return datetime.now(UTC).isoformat()


def _contact_name(contacts: list[dict[str, Any]], wa_id: str | None) -> str | None:
    if not wa_id:
        return None
    for contact in contacts:
        if contact.get("wa_id") == wa_id:
            return (contact.get("profile") or {}).get("name")
    return None


def _extract_message_content(msg_data: dict[str, Any]) -> dict[str, Any]:
    msg_type = msg_data.get("type")
    result: dict[str, Any] = {
        "texto": None,
        "media_id": None,
        "caption": None,
        "filename": None,
        "mime_type": None,
    }
    if msg_type == "text":
        result["texto"] = (msg_data.get("text") or {}).get("body")
    elif msg_type in {"image", "document", "audio", "video"}:
        media_data = msg_data.get(msg_type) or {}
        result["media_id"] = media_data.get("id")
        result["caption"] = media_data.get("caption")
        result["filename"] = media_data.get("filename")
        result["mime_type"] = media_data.get("mime_type")
    return result


def raw_meta_to_channel_payloads(session: Session, payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert raw Meta Cloud API webhook payloads to SAK's normalized payload."""
    normalized: list[dict[str, Any]] = []

    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            metadata = value.get("metadata", {}) or {}
            phone_number_id = str(metadata.get("phone_number_id") or "")
            display_phone_number = metadata.get("display_phone_number") or phone_number_id
            account_ref = meta_account_resolver.resolve_account_ref_by_phone_number_id(session, phone_number_id)
            if not account_ref:
                account_ref = _stable_uuid(f"phone-number:{phone_number_id}")

            celular = {
                "id": account_ref,
                "alias": f"Meta {display_phone_number}",
                "phone_number": display_phone_number,
            }
            contacts = value.get("contacts", []) or []

            for msg_data in value.get("messages", []) or []:
                meta_message_id = msg_data.get("id")
                if not meta_message_id:
                    continue
                from_phone = msg_data.get("from")
                content = _extract_message_content(msg_data)
                normalized.append(
                    {
                        "event_type": "message.received",
                        "timestamp": datetime.now(UTC).isoformat(),
                        "mensaje": {
                            "id": _stable_uuid(meta_message_id),
                            "meta_message_id": meta_message_id,
                            "from_phone": from_phone,
                            "from_name": _contact_name(contacts, from_phone),
                            "to_phone": display_phone_number,
                            "direccion": "in",
                            "tipo": msg_data.get("type") or "unknown",
                            "texto": content["texto"],
                            "media_id": content["media_id"],
                            "caption": content["caption"],
                            "filename": content["filename"],
                            "mime_type": content["mime_type"],
                            "status": "received",
                            "meta_timestamp": _timestamp_from_meta(msg_data.get("timestamp")),
                            "created_at": datetime.now(UTC).isoformat(),
                            "celular": celular,
                        },
                        "source": "meta_raw",
                        "raw_meta_payload": payload,
                    }
                )

            for status_data in value.get("statuses", []) or []:
                meta_message_id = status_data.get("id")
                if not meta_message_id:
                    continue
                status = status_data.get("status") or "unknown"
                normalized.append(
                    {
                        "event_type": f"message.{status}",
                        "timestamp": datetime.now(UTC).isoformat(),
                        "mensaje": {
                            "id": _stable_uuid(f"status:{meta_message_id}:{status_data.get('timestamp')}"),
                            "meta_message_id": meta_message_id,
                            "from_phone": display_phone_number,
                            "from_name": None,
                            "to_phone": status_data.get("recipient_id") or "",
                            "direccion": "out",
                            "tipo": "status",
                            "texto": None,
                            "media_id": None,
                            "caption": None,
                            "filename": None,
                            "mime_type": None,
                            "status": status,
                            "errors": status_data.get("errors") or [],
                            "meta_timestamp": _timestamp_from_meta(status_data.get("timestamp")),
                            "created_at": datetime.now(UTC).isoformat(),
                            "celular": celular,
                        },
                        "source": "meta_raw",
                        "raw_meta_payload": payload,
                    }
                )

    return normalized
