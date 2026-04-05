from __future__ import annotations

import json
from pathlib import Path

from agente.v2.core.state import utc_now_iso
from agente.v2.processes.solicitud_materiales.models import MaterialRequestState


DEFAULT_REQUESTS_DIR = Path(__file__).resolve().parents[2] / "core" / "state" / "material_requests"


class RequestStore:
    """Persistencia local del estado de solicitud para v2."""

    def __init__(self, root_dir: Path | None = None) -> None:
        self._root_dir = root_dir or DEFAULT_REQUESTS_DIR

    def _request_path(self, oportunidad_id: int) -> Path:
        return self._root_dir / f"oportunidad_{oportunidad_id}.json"

    def load(self, oportunidad_id: int) -> MaterialRequestState | None:
        request_path = self._request_path(oportunidad_id)
        if not request_path.exists():
            return None

        try:
            payload = json.loads(request_path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise ValueError("La solicitud v2 no es un JSON valido") from exc

        if not isinstance(payload, dict):
            raise ValueError("La solicitud v2 no es valida")
        return MaterialRequestState.from_state_dict(payload, oportunidad_id)

    def load_active(self, oportunidad_id: int) -> MaterialRequestState | None:
        request_state = self.load(oportunidad_id)
        if not request_state or not request_state.activa:
            return None
        return request_state

    def save(self, request_state: MaterialRequestState, ultimo_mensaje_id: int | None) -> MaterialRequestState:
        previous = self.load(request_state.oportunidad_id)
        if previous:
            request_state.version = int(previous.version) + 1
            request_state.created_at = previous.created_at
        else:
            request_state.version = max(int(request_state.version or 1), 1)
            request_state.created_at = request_state.created_at or utc_now_iso()

        request_state.updated_at = utc_now_iso()
        request_state.ultimo_mensaje_id = ultimo_mensaje_id

        request_path = self._request_path(request_state.oportunidad_id)
        request_path.parent.mkdir(parents=True, exist_ok=True)
        request_path.write_text(
            json.dumps(request_state.to_state_dict(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return request_state
