from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agente.v2.core.models import AgentConversationState, utc_now_iso


DEFAULT_CONVERSATIONS_DIR = Path(__file__).resolve().parent / "state" / "conversation_state"
DEFAULT_EXECUTIONS_DIR = Path(__file__).resolve().parent / "state" / "turn_executions"


class AgentConversationStateRepository:
    """Persistencia local del estado conversacional y de la bitacora de turnos."""

    def __init__(
        self,
        root_dir: Path | None = None,
        executions_dir: Path | None = None,
    ) -> None:
        self._root_dir = root_dir or DEFAULT_CONVERSATIONS_DIR
        self._executions_dir = executions_dir or DEFAULT_EXECUTIONS_DIR

    def _state_path(self, scope_id: int) -> Path:
        return self._root_dir / f"oportunidad_{scope_id}.json"

    def _execution_path(self, scope_id: int, message_id: int) -> Path:
        return self._executions_dir / f"oportunidad_{scope_id}" / f"message_{message_id}.json"

    def load(self, scope_id: int, *, agent_mode: str = "manual") -> AgentConversationState:
        state_path = self._state_path(scope_id)
        if not state_path.exists():
            return AgentConversationState.empty(scope_id, agent_mode=agent_mode)

        try:
            payload = json.loads(state_path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise ValueError("El estado conversacional del agente v2 no es un JSON valido") from exc

        if not isinstance(payload, dict):
            raise ValueError("El estado conversacional del agente v2 no es valido")

        state = AgentConversationState.from_state_dict(payload)
        if not state.scope_id:
            state.scope_id = scope_id
        if not state.agent_mode:
            state.agent_mode = agent_mode
        return state

    def save(
        self,
        state: AgentConversationState,
        *,
        expected_version: int | None = None,
    ) -> AgentConversationState:
        current = self.load(state.scope_id, agent_mode=state.agent_mode)
        state_to_save = state.clone()

        if current.scope_id and current.version and expected_version is not None and current.version != expected_version:
            raise ValueError("Conflicto de version al persistir el estado conversacional del agente v2")

        if current.scope_id and self._state_path(state.scope_id).exists():
            state_to_save.version = current.version + 1
        else:
            state_to_save.version = max(int(state.version or 1), 1)

        state_path = self._state_path(state.scope_id)
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(
            json.dumps(state_to_save.to_state_dict(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return state_to_save

    def get_turn_execution(self, scope_id: int, message_id: int) -> dict[str, Any] | None:
        execution_path = self._execution_path(scope_id, message_id)
        if not execution_path.exists():
            return None

        try:
            payload = json.loads(execution_path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise ValueError("La bitacora de turnos del agente v2 no es un JSON valido") from exc

        if not isinstance(payload, dict):
            raise ValueError("La bitacora de turnos del agente v2 no es valida")
        return payload

    def save_turn_execution(self, scope_id: int, message_id: int, record: dict[str, Any]) -> dict[str, Any]:
        execution_path = self._execution_path(scope_id, message_id)
        execution_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            **record,
            "message_id": message_id,
            "scope_id": scope_id,
            "recorded_at": utc_now_iso(),
        }
        execution_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return payload
