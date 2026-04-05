"""
Pipeline principal del agente v2.

Flujo de un turno:

    process_turn(session, message_id, trigger)
        │
        ├─ 1. Valida mensaje y oportunidad asociada
        ├─ 2. Deduplicacion: si ya fue procesado devuelve el resultado cacheado
        ├─ 3. Carga estado conversacional + construye TurnContext
        ├─ 4. Resuelve que proceso tiene mayor prioridad para el mensaje
        │
        ├─ ¿Proceso encontrado?
        │       └─ NO → registra "sin proceso" y retorna
        │
        └─ SÍ
                ├─ 5. Ejecuta el proceso (LLM, operaciones, etc.)
                ├─ 6. Persiste estado conversacional actualizado
                └─ 7. Marca el mensaje como procesado y retorna payload
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from agente.v2.core.context import MessageInfo, TurnContext
from agente.v2.core.process import AgentProcess, ProcessRegistry
from agente.v2.core.state import ConversationState, JsonConversationStateStore
from app.models import CRMContacto, CRMMensaje, CRMOportunidad, Proyecto
from app.models.base import serialize_datetime
from app.models.crm.catalogos import CRMTipoOperacion


class AgentTurnOrchestrator:
    """Orquestador del pipeline de un turno del agente."""

    def __init__(
        self,
        *,
        processes: list[AgentProcess],
        state_store: JsonConversationStateStore,
        history_limit: int = 6,
    ) -> None:
        self._registry = ProcessRegistry(processes)
        self._state_store = state_store
        self._history_limit = history_limit

    @property
    def state_store(self) -> JsonConversationStateStore:
        return self._state_store

    @property
    def registry(self) -> ProcessRegistry:
        return self._registry

    # ------------------------------------------------------------------
    # Punto de entrada principal
    # ------------------------------------------------------------------

    async def process_turn(
        self,
        session: Session,
        message_id: int,
        trigger: str,
    ) -> dict[str, Any]:
        """
        Procesa un turno completo para el mensaje dado.

        Si el mensaje ya fue procesado anteriormente devuelve el resultado
        cacheado sin llamar al LLM. Cualquier excepcion no controlada
        se propaga hacia el caller para ser logueada y devuelta como 500.
        """
        message = session.get(CRMMensaje, message_id)
        if not message:
            raise ValueError("Mensaje no encontrado")
        if not message.oportunidad_id:
            raise ValueError("Mensaje sin oportunidad asociada")

        # Deduplicacion: evita reprocesar el mismo mensaje (webhook doble, retry, etc.)
        cached = (message.metadata_json or {}).get("agent_v2", {}).get("result")
        if isinstance(cached, dict):
            return {**cached, "message_id": message_id, "cached": True}

        state = self._state_store.load(message.oportunidad_id)
        ctx = self.build_context(session, message_id, trigger=trigger, state=state)

        process = self._registry.resolve(ctx)
        if not process:
            result: dict[str, Any] = {"type": "no_process", "skipped": True, "reason": "No hay procesos disponibles"}
            state.last_message_id = message.id
            self._state_store.save(state)
            self._mark_done(session, message, result=result, process_name=None, trigger=trigger)
            return {**result, "message_id": message_id, "cached": False}

        turn_result = process.handle(ctx)

        state.active_process = process.name if turn_result.keep_active else None
        state.process_state = turn_result.process_state if turn_result.keep_active else {}
        state.last_message_id = message.id
        self._state_store.save(state)

        self._mark_done(session, message, result=turn_result.payload, process_name=process.name, trigger=trigger)

        return {
            **turn_result.payload,
            "message_id": message_id,
            "cached": False,
            "process_name": process.name,
        }

    # ------------------------------------------------------------------
    # Construccion de contexto
    # ------------------------------------------------------------------

    def build_context(
        self,
        session: Session,
        message_id: int,
        *,
        trigger: str = "webhook",
        state: ConversationState | None = None,
    ) -> TurnContext:
        """Carga y construye el contexto completo para un turno."""
        message = session.get(CRMMensaje, message_id)
        if not message or message.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Mensaje no encontrado")
        if not message.oportunidad_id:
            raise HTTPException(status_code=400, detail="Mensaje sin oportunidad asociada")

        oportunidad = session.get(CRMOportunidad, message.oportunidad_id)
        if not oportunidad:
            raise HTTPException(status_code=404, detail="Oportunidad no encontrada")

        resolved_state = state or self._state_store.load(message.oportunidad_id)
        contacto = session.get(CRMContacto, message.contacto_id) if message.contacto_id else None

        return TurnContext(
            oportunidad_id=message.oportunidad_id,
            contacto_id=contacto.id if contacto else None,
            canal=message.canal,
            trigger=trigger,
            message=self._to_message_info(message),
            history=self._load_history(session, message.oportunidad_id),
            conversation_state=resolved_state,
            is_project=self._is_project(session, oportunidad),
        )

    # ------------------------------------------------------------------
    # Helper: resolver ultimo mensaje de una oportunidad
    # ------------------------------------------------------------------

    @staticmethod
    def resolve_latest_message_id(session: Session, oportunidad_id: int) -> int:
        oportunidad = session.get(CRMOportunidad, oportunidad_id)
        if not oportunidad:
            raise HTTPException(status_code=404, detail="Oportunidad no encontrada")

        fecha_ref = func.coalesce(CRMMensaje.fecha_mensaje, CRMMensaje.created_at)
        latest = session.exec(
            select(CRMMensaje.id)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .where(CRMMensaje.tipo == "entrada")
            .order_by(fecha_ref.desc(), CRMMensaje.id.desc())
            .limit(1)
        ).first()
        if latest:
            return int(latest)

        latest = session.exec(
            select(CRMMensaje.id)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .order_by(fecha_ref.desc(), CRMMensaje.id.desc())
            .limit(1)
        ).first()
        if not latest:
            raise HTTPException(status_code=404, detail="No hay mensajes para la oportunidad")
        return int(latest)

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    def _load_history(self, session: Session, oportunidad_id: int) -> list[MessageInfo]:
        fecha_ref = func.coalesce(CRMMensaje.fecha_mensaje, CRMMensaje.created_at)
        rows = session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .order_by(fecha_ref.desc(), CRMMensaje.id.desc())
            .limit(self._history_limit)
        ).all()
        return [self._to_message_info(m) for m in reversed(rows)]

    @staticmethod
    def _to_message_info(message: CRMMensaje) -> MessageInfo:
        return MessageInfo(
            id=message.id,
            contenido=message.contenido or "",
            tipo=message.tipo,
            canal=message.canal,
            estado=message.estado,
            fecha=serialize_datetime(message.fecha_mensaje or message.created_at),
        )

    @staticmethod
    def _is_project(session: Session, oportunidad: CRMOportunidad) -> bool:
        linked = session.exec(
            select(Proyecto.id).where(Proyecto.oportunidad_id == oportunidad.id).limit(1)
        ).first()
        if linked:
            return True
        if oportunidad.tipo_operacion_id:
            tipo = session.get(CRMTipoOperacion, oportunidad.tipo_operacion_id)
            if tipo:
                codigo = str(tipo.codigo or "").strip().lower()
                nombre = str(tipo.nombre or "").strip().lower()
                if codigo == "proyecto" or nombre == "proyecto":
                    return True
        return False

    @staticmethod
    def _mark_done(
        session: Session,
        message: CRMMensaje,
        *,
        result: dict[str, Any],
        process_name: str | None,
        trigger: str,
    ) -> None:
        metadata = dict(message.metadata_json or {})
        metadata["agent_v2"] = {
            "result": result,
            "process_name": process_name,
            "trigger": trigger,
            "processed_at": datetime.now(UTC).isoformat(),
        }
        message.metadata_json = metadata
        session.add(message)
        session.commit()
        session.refresh(message)

