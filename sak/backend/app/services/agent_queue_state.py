"""Estado persistente minimo para la cola del agente."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from app.models import CRMMensaje
from app.models.base import current_utc_time

DEFAULT_QUEUE_NAME = "prod"
QUEUE_NAME_KEY = "agent_queue"
QUEUE_STATUS_KEY = "agent_queue_status"
QUEUE_ATTEMPTS_KEY = "agent_queue_attempts"
QUEUE_ERROR_KEY = "agent_queue_error"
QUEUE_QUEUED_AT_KEY = "agent_queue_queued_at"
QUEUE_ENQUEUED_AT_KEY = "agent_queue_enqueued_at"
QUEUE_STARTED_AT_KEY = "agent_queue_started_at"
QUEUE_PROCESSED_AT_KEY = "agent_queue_processed_at"
QUEUE_SOURCE_KEY = "agent_queue_source"

STATUS_PENDING = "pendiente"
STATUS_PROCESSING = "en_proceso"
STATUS_PROCESSED = "procesado"
STATUS_ERROR = "error"

_QUEUE_RE = re.compile(r"^[a-z0-9_-]+$")
_BACKEND_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_BACKEND_ENV_PATH)
_runtime_enqueued_at: dict[int, str] = {}


def normalize_queue_name(raw_value: Any | None) -> str:
    value = str(raw_value or DEFAULT_QUEUE_NAME).strip().lower()
    if not value:
        return DEFAULT_QUEUE_NAME
    if not _QUEUE_RE.fullmatch(value):
        raise ValueError("Nombre de cola invalido")
    return value


def worker_queue_name() -> str:
    return normalize_queue_name(os.getenv("AGENT_QUEUE_NAME", DEFAULT_QUEUE_NAME))


def message_queue_name(message: CRMMensaje) -> str:
    metadata = dict(message.metadata_json or {})
    return normalize_queue_name(metadata.get(QUEUE_NAME_KEY, DEFAULT_QUEUE_NAME))


def message_queue_status(message: CRMMensaje) -> str | None:
    metadata = dict(message.metadata_json or {})
    status = metadata.get(QUEUE_STATUS_KEY)
    return str(status) if status else None


def apply_queued_metadata(metadata: dict[str, Any] | None, *, queue_name: str) -> dict[str, Any]:
    result = dict(metadata or {})
    result[QUEUE_NAME_KEY] = normalize_queue_name(queue_name)
    result[QUEUE_STATUS_KEY] = STATUS_PENDING
    result.setdefault(QUEUE_QUEUED_AT_KEY, current_utc_time().isoformat())
    result.pop(QUEUE_ERROR_KEY, None)
    return result


def mark_processing_metadata(
    metadata: dict[str, Any] | None,
    *,
    source: str,
) -> dict[str, Any]:
    result = dict(metadata or {})
    result[QUEUE_STATUS_KEY] = STATUS_PROCESSING
    result[QUEUE_SOURCE_KEY] = source
    result[QUEUE_STARTED_AT_KEY] = current_utc_time().isoformat()
    result[QUEUE_ATTEMPTS_KEY] = int(result.get(QUEUE_ATTEMPTS_KEY) or 0) + 1
    result.pop(QUEUE_ERROR_KEY, None)
    return result


def mark_pending_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    result = dict(metadata or {})
    result[QUEUE_STATUS_KEY] = STATUS_PENDING
    result.setdefault(QUEUE_QUEUED_AT_KEY, current_utc_time().isoformat())
    return result


def mark_enqueued_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    result = dict(metadata or {})
    result[QUEUE_ENQUEUED_AT_KEY] = current_utc_time().isoformat()
    return result


def record_runtime_enqueued_at(message_id: int) -> None:
    _runtime_enqueued_at[int(message_id)] = current_utc_time().isoformat()


def pop_runtime_enqueued_at(message_id: int) -> str | None:
    return _runtime_enqueued_at.pop(int(message_id), None)


def mark_processed_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    result = dict(metadata or {})
    result[QUEUE_STATUS_KEY] = STATUS_PROCESSED
    result[QUEUE_PROCESSED_AT_KEY] = current_utc_time().isoformat()
    result.pop(QUEUE_ERROR_KEY, None)
    return result


def mark_error_metadata(
    metadata: dict[str, Any] | None,
    *,
    source: str,
    error: str,
) -> dict[str, Any]:
    result = dict(metadata or {})
    result[QUEUE_STATUS_KEY] = STATUS_ERROR
    result[QUEUE_ERROR_KEY] = {
        "source": source,
        "message": error,
        "at": current_utc_time().isoformat(),
    }
    return result
