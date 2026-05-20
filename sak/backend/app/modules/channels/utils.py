"""Small normalization helpers for channel integrations."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo


def normalize_address(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    return cleaned.lstrip("+")


def normalize_provider_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        # meta_w stored Meta timestamps as Argentina local naive datetimes.
        value = value.replace(tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
    return value.astimezone(UTC)


def normalize_phone_for_meta(phone: str) -> str:
    phone_clean = str(phone).strip().lstrip("+")
    if phone_clean.startswith("549"):
        phone_clean = phone_clean.replace("549", "54", 1)
    return f"+{phone_clean}"

