"""Contrato de proceso y registro de procesos disponibles."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from agente.v2.core.context import TurnContext


@dataclass(slots=True)
class TurnResult:
    """Resultado uniforme que el core espera de cualquier proceso."""

    payload: dict[str, Any]             # respuesta completa que recibe el caller
    keep_active: bool = True            # False = cerrar el proceso tras este turno
    process_state: dict[str, Any] = field(default_factory=dict)


class AgentProcess(Protocol):
    """Contrato minimo que un proceso debe implementar."""

    name: str

    def priority(self, ctx: TurnContext) -> int | None:
        """
        Indica con que prioridad puede manejar este turno.
        Devuelve None si no puede manejar el mensaje.
        El proceso activo recibe +1000 de bonus automaticamente.
        """
        ...

    def handle(self, ctx: TurnContext) -> TurnResult:
        """Ejecuta el turno y devuelve resultado con respuesta y nuevo estado."""
        ...


class ProcessRegistry:
    """Mantiene procesos disponibles y elige el de mayor prioridad para el turno."""

    def __init__(self, processes: list[AgentProcess]) -> None:
        self._processes = {p.name: p for p in processes}

    def resolve(self, ctx: TurnContext) -> AgentProcess | None:
        best: tuple[int, AgentProcess] | None = None
        active = ctx.active_process
        for process in self._processes.values():
            score = process.priority(ctx)
            if score is None:
                continue
            if active == process.name:
                score += 1000
            if best is None or score > best[0]:
                best = (score, process)
        return best[1] if best else None
