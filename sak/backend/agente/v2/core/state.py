"""Estado conversacional del agente y su persistencia en JSON."""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


DEFAULT_STATE_DIR = Path(__file__).resolve().parent / "state" / "conversation_state"


def utc_now_iso() -> str:
    """Devuelve la fecha actual en UTC serializada a ISO 8601."""
    return datetime.now(UTC).isoformat()


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


# ---------------------------------------------------------------------------
# Estado conversacional simplificado
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class ConversationState:
    """Estado conversacional de una oportunidad."""

    oportunidad_id: int
    active_process: str | None = None
    process_state: dict[str, Any] = field(default_factory=dict)
    last_message_id: int | None = None
    last_outbound_message_id: int | None = None
    version: int = 1

    @classmethod
    def empty(cls, oportunidad_id: int) -> "ConversationState":
        return cls(oportunidad_id=oportunidad_id)

    def to_dict(self) -> dict[str, Any]:
        return {
            "oportunidad_id": self.oportunidad_id,
            "active_process": self.active_process,
            "process_state": self.process_state,
            "last_message_id": self.last_message_id,
            "last_outbound_message_id": self.last_outbound_message_id,
            "version": self.version,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None, *, oportunidad_id: int) -> "ConversationState":
        """Reconstruye estado desde JSON — compatible con el formato anterior."""
        raw = data or {}

        # Soporte formato anterior: scope_id / process_states / last_processed_message_id
        oid = int(raw.get("oportunidad_id") or raw.get("scope_id") or oportunidad_id)
        active = _clean_text(raw.get("active_process"))

        process_state = raw.get("process_state")
        if not isinstance(process_state, dict):
            # formato anterior: process_states = {nombre: estado}
            process_states = raw.get("process_states") or {}
            process_state = dict(process_states.get(active, {})) if active and isinstance(process_states, dict) else {}

        last_msg = raw.get("last_message_id") or raw.get("last_processed_message_id")

        return cls(
            oportunidad_id=oid,
            active_process=active,
            process_state=dict(process_state),
            last_message_id=last_msg,
            last_outbound_message_id=raw.get("last_outbound_message_id"),
            version=max(int(raw.get("version") or 1), 1),
        )


# ---------------------------------------------------------------------------
# Persistencia JSON
# ---------------------------------------------------------------------------

class JsonConversationStateStore:
    """Persistencia en JSON del estado conversacional por oportunidad."""

    def __init__(self, root_dir: Path | None = None, executions_dir: Path | None = None) -> None:
        self._root = root_dir or DEFAULT_STATE_DIR
        # executions_dir ignorado — se mantiene el parametro para compatibilidad con build_v2_dependencies

    def _path(self, oportunidad_id: int) -> Path:
        return self._root / f"oportunidad_{oportunidad_id}.json"

    @staticmethod
    def _write_atomic(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=path.name + ".", suffix=".tmp", text=True)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
                f.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        except Exception:
            try:
                os.unlink(tmp)
            except FileNotFoundError:
                pass
            raise

    def load(self, oportunidad_id: int) -> ConversationState:
        path = self._path(oportunidad_id)
        if not path.exists():
            return ConversationState.empty(oportunidad_id)
        try:
            raw = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise ValueError("Estado JSON invalido") from exc
        if not isinstance(raw, dict):
            raise ValueError("Estado JSON invalido")
        return ConversationState.from_dict(raw, oportunidad_id=oportunidad_id)

    def save(self, state: ConversationState) -> ConversationState:
        current = self.load(state.oportunidad_id)
        state.version = current.version + 1
        self._write_atomic(self._path(state.oportunidad_id), state.to_dict())
        return state


# Alias para compatibilidad con el nombre anterior
AgentConversationStateRepository = JsonConversationStateStore

