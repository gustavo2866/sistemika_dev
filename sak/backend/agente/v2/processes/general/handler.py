"""Proceso general para turnos sin subproceso activo."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from agente.v2.core.context import TurnContext
from agente.v2.core.process import TurnResult
from agente.v2.processes.general.llm_client import GeneralLLMClient
from app.models import Nomina, ParteDiario, Proyecto


BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")


class GeneralProcess:
    name = "general"

    def __init__(
        self,
        *,
        session: Session | None = None,
        llm_client: GeneralLLMClient | None = None,
    ) -> None:
        self._session = session
        self._llm = llm_client or GeneralLLMClient()

    def priority(self, ctx: TurnContext) -> int | None:
        if ctx.active_process is not None or not ctx.is_project:
            return None
        return 100

    async def handle(self, ctx: TurnContext) -> TurnResult:
        try:
            decision = await self._llm.interpret_turn(ctx.message.contenido)
        except Exception:
            return self._reply(
                "No pude interpretar el mensaje. Indica si necesitas hacer un pedido de materiales o informar el parte diario."
            )

        if decision.type == "start_pedido_obra":
            return TurnResult(payload={}, keep_active=False, activate_process="pedido_obra")
        if decision.type == "start_parte_diario":
            return TurnResult(payload={}, keep_active=False, activate_process="parte_diario")
        if decision.type == "mostrar_nomina":
            return self._reply(self._render_nomina(ctx.oportunidad_id))
        if decision.type == "mostrar_parte_hoy":
            return self._reply(self._render_parte_hoy(ctx.oportunidad_id))
        if decision.type == "saludo":
            return self._reply(
                "Hola. Puedo ayudarte con:\n"
                "1. Pedido de materiales\n"
                "2. Parte diario de asistencia"
            )
        return self._reply(
            "Indica que deseas realizar:\n"
            "1. Pedido de materiales\n"
            "2. Parte diario de asistencia"
        )

    @staticmethod
    def _reply(text: str) -> TurnResult:
        return TurnResult(
            payload={"type": "general_reply", "reply_to_user": text},
            keep_active=False,
        )

    def _render_nomina(self, oportunidad_id: int) -> str:
        project = self._resolve_project(oportunidad_id)
        if self._session is None or project is None:
            return "No encontre un proyecto asociado para consultar la nomina."
        today = datetime.now(BUENOS_AIRES).date()
        rows = self._session.exec(
            select(Nomina)
            .where(Nomina.idproyecto == project.id)
            .where(Nomina.activo.is_(True))
            .where((Nomina.fecha_egreso.is_(None)) | (Nomina.fecha_egreso >= today))
            .order_by(Nomina.apellido, Nomina.nombre)
        ).all()
        if not rows:
            return "No hay personal activo asignado a la obra."
        names = "\n".join(f"- {row.apellido}, {row.nombre}" for row in rows)
        return f"*NOMINA ACTIVA*\n{names}"

    def _render_parte_hoy(self, oportunidad_id: int) -> str:
        project = self._resolve_project(oportunidad_id)
        if self._session is None or project is None:
            return "No encontre un proyecto asociado para consultar el parte diario."
        today = datetime.now(BUENOS_AIRES).date()
        parte = self._session.exec(
            select(ParteDiario)
            .where(ParteDiario.idproyecto == project.id)
            .where(ParteDiario.fecha == today)
        ).first()
        if parte is None:
            return "Todavia no hay un parte diario cargado para hoy."
        return f"*PARTE DIARIO DE HOY*\nEstado: {parte.estado.value}\nRegistros: {len(parte.detalles)}"

    def _resolve_project(self, oportunidad_id: int) -> Proyecto | None:
        if self._session is None:
            return None
        return self._session.exec(
            select(Proyecto).where(Proyecto.oportunidad_id == oportunidad_id)
        ).first()
