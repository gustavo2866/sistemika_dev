"""
Proceso secretario_materiales — agente v2.

Filosofia: el encargado de obra dicta, el agente registra.
- Registra todo lo que se pide, aunque falten datos
- Pregunta solo la cantidad (unico dato sin el cual no se puede pedir nada), una sola vez y sin bloquear
- Cualquier mensaje que no sea de materiales se responde brevemente
- El contexto de obra (fechas, condiciones) queda como observacion
- La solicitud siempre queda abierta — el cierre lo gestiona el arquitecto desde el CRM
"""

from __future__ import annotations

import re
from dataclasses import replace
from pathlib import Path
from typing import Any

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.core.state import JsonConversationStateStore
from agente.v2.processes.solicitud_materiales.family_catalog import FamilyCatalog
from agente.v2.processes.solicitud_materiales.models import (
    MaterialItem,
    MaterialRequestState,
)
from agente.v2.processes.solicitud_materiales.operation_execution import RequestOperationExecutor
from agente.v2.processes.solicitud_materiales.request_store import RequestStore
from agente.v2.processes.secretario_materiales.llm_client import SecretarioLLMClient


_SECRETARIO_REQUESTS_DIR = Path(__file__).resolve().parents[2] / "core" / "state" / "secretario_requests"
_SECRETARIO_STATE_DIR = Path(__file__).resolve().parents[2] / "core" / "state" / "secretario_conversations"

# Singleton del catalogo — se construye una sola vez y se reutiliza en todos los requests
_FAMILY_CATALOG_SINGLETON: FamilyCatalog | None = None


def _get_family_catalog(path: Path | None = None) -> FamilyCatalog:
    global _FAMILY_CATALOG_SINGLETON
    if _FAMILY_CATALOG_SINGLETON is None:
        _FAMILY_CATALOG_SINGLETON = FamilyCatalog(path)
    return _FAMILY_CATALOG_SINGLETON

_MATERIAL_VERBS = (
    "necesito", "manda", "mandame", "agrega", "suma", "saca",
    "quita", "cambia", "corrige", "deja solo", "limpia", "borra",
)
_MATERIAL_PATTERN = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(bolsas?|barras?|m3|metros?|mts?|unidades?|rollos?|kg)\b",
    flags=re.IGNORECASE,
)


def _format_quantity(value: float | int | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _build_summary_line(item: MaterialItem) -> str:
    parts = [
        _format_quantity(item.cantidad),
        str(item.unidad or "").strip() or None,
        item.descripcion or item.familia or "item",
    ]
    line = " ".join(p for p in parts if p)
    if item.cantidad is None:
        line += " (sin cantidad)"
    return line


def _build_summary_text(request_state: MaterialRequestState) -> str:
    lines = [_build_summary_line(item) for item in request_state.items]
    if not lines:
        return ""
    return "Hasta ahora tengo registrado:\n- " + "\n- ".join(lines)


class SecretarioMaterialesProcess:
    """
    Proceso secretario_materiales.

    Implementa el contrato AgentProcess del core v2.
    """

    name = "solicitud_materiales"

    def __init__(
        self,
        family_catalog: FamilyCatalog,
        request_store: RequestStore,
        llm_client: SecretarioLLMClient,
    ) -> None:
        self._family_catalog = family_catalog
        self._request_store = request_store
        self._llm_client = llm_client
        self._executor = RequestOperationExecutor()

    # ------------------------------------------------------------------
    # Contrato AgentProcess
    # ------------------------------------------------------------------

    def load_request_state(
        self,
        oportunidad_id: int,
        *,
        active_only: bool = False,
    ) -> MaterialRequestState | None:
        if active_only:
            return self._request_store.load_active(oportunidad_id)
        return self._request_store.load(oportunidad_id)

    def priority(self, ctx: TurnContext) -> int | None:
        if not ctx.is_project:
            return None
        if ctx.active_process == self.name:
            return 100
        if self._request_store.load_active(ctx.oportunidad_id) is not None:
            return 90
        if self._looks_like_material_request(ctx.message.contenido):
            return 80
        return 10

    async def handle(self, ctx: TurnContext) -> TurnResult:
        message = ctx.message
        history = ctx.history

        # Cargar o crear estado
        request_state = self._request_store.load_active(ctx.oportunidad_id)
        if request_state is not None:
            request_state = replace(
                request_state,
                items=[item.clone() for item in request_state.items],
                observaciones=list(request_state.observaciones),
            )
        else:
            request_state = MaterialRequestState.empty(
                ctx.oportunidad_id,
                ultimo_mensaje_id=message.id,
            )

        # Borrar cualquier consulta pendiente — el secretario no bloquea
        for item in request_state.items:
            item.consulta = None
            item.consulta_atributo = None
            item.consulta_intentos = 0

        # Llamada al LLM (async — no bloquea el event loop)
        decision = await self._llm_client.process_turn(
            message_text=message.contenido,
            history=[m.to_prompt_dict() for m in history],
            current_request=request_state.to_analysis_dict(),
            families=self._family_catalog.list_prompt_families(),
        )

        # Aplicar operaciones
        warnings = self._executor.apply(request_state, decision.operations)

        # Registrar observacion si la hay
        if decision.observation:
            request_state.observaciones.append(decision.observation)

        # Mantener solicitud siempre abierta (el cierre lo hace el arquitecto)
        request_state.activa = True
        request_state.estado_solicitud = "open"

        saved = self._request_store.save(request_state, message.id)

        # Construir respuesta
        reply = self._build_reply(decision=decision, saved=saved, warnings=warnings)

        return TurnResult(
            payload={
                "type": "material_request",
                "respuesta": reply,
                "modelo": "secretario-v1",
                "solicitud": saved.to_state_dict(),
                "warnings": warnings,
            },
            keep_active=True,
            process_state={"last_reply": reply},
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_reply(
        self,
        *,
        decision: Any,
        saved: MaterialRequestState,
        warnings: list[str],
    ) -> str:
        parts: list[str] = []

        # Confirmacion/respuesta del LLM
        if decision.reply:
            parts.append(decision.reply.strip())

        # Preguntar cantidad del PRIMER item sin cantidad (no bloquea, solo pregunta)
        items_sin_cantidad = [item for item in saved.items if item.cantidad is None]
        if items_sin_cantidad:
            nombre = items_sin_cantidad[0].descripcion or items_sin_cantidad[0].familia or "ese material"
            parts.append(f"¿Cuantos/as {nombre} necesitas?")

        # Resumen actual si hay items
        if saved.items:
            parts.append(_build_summary_text(saved))

        return "\n\n".join(p for p in parts if p) or "Entendido."

    @staticmethod
    def _looks_like_material_request(message: str | None) -> bool:
        text = str(message or "").strip().lower()
        if not text:
            return False
        if any(v in text for v in _MATERIAL_VERBS):
            return True
        return bool(_MATERIAL_PATTERN.search(text))


def build_secretario_dependencies(
    *,
    session=None,
    families_path: Path | None = None,
):
    """Construye las dependencias del proceso secretario_materiales.

    Si se pasa `session` (SQLModel Session), usa stores en DB igual que v2.
    Si no, usa stores JSON en disco (tests / desarrollo local).
    """
    family_catalog = _get_family_catalog(families_path)

    if session is not None:
        from agente.v2.db.stores import DbConversationStateStore, DbProcessRequestStore
        request_store = DbProcessRequestStore(session)
        state_store = DbConversationStateStore(session)
    else:
        request_store = RequestStore(_SECRETARIO_REQUESTS_DIR)
        state_store = JsonConversationStateStore(root_dir=_SECRETARIO_STATE_DIR)

    llm_client = SecretarioLLMClient()
    process = SecretarioMaterialesProcess(
        family_catalog=family_catalog,
        request_store=request_store,
        llm_client=llm_client,
    )
    return state_store, process
