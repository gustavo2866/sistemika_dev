from __future__ import annotations

from agente.v2.core.contracts import AgentProcessHandler
from agente.v2.core.models import ChatTurnContext, ProcessActivationDecision


class ProcessRegistry:
    """Registro y resolucion de procesos conversacionales disponibles."""

    def __init__(self, handlers: list[AgentProcessHandler] | None = None) -> None:
        self._handlers: dict[str, AgentProcessHandler] = {}
        for handler in handlers or []:
            self.register(handler)

    def register(self, handler: AgentProcessHandler) -> None:
        self._handlers[handler.process_name] = handler

    def get(self, process_name: str | None) -> AgentProcessHandler | None:
        if not process_name:
            return None
        return self._handlers.get(process_name)

    def resolve(
        self,
        context: ChatTurnContext,
        *,
        requested_process: str | None = None,
        excluded_processes: set[str] | None = None,
    ) -> tuple[AgentProcessHandler, ProcessActivationDecision]:
        excluded = excluded_processes or set()

        if requested_process:
            requested_handler = self.get(requested_process)
            if requested_handler is None:
                raise ValueError(f"Proceso solicitado no registrado: {requested_process}")
            if requested_process in excluded:
                raise ValueError(f"Proceso solicitado excluido del despacho: {requested_process}")
            decision = requested_handler.can_activate(context)
            if not decision.can_activate:
                raise ValueError(f"Proceso solicitado no aplica al turno: {requested_process}")
            return requested_handler, decision

        candidates: list[tuple[int, str, AgentProcessHandler, ProcessActivationDecision]] = []
        active_process = context.agent_state.active_process

        for process_name, handler in self._handlers.items():
            if process_name in excluded:
                continue
            decision = handler.can_activate(context)
            if not decision.can_activate:
                continue

            priority = decision.priority
            if active_process == process_name:
                priority = max(priority, 1_000)
            candidates.append((priority, process_name, handler, decision))

        if not candidates:
            raise ValueError("No hay procesos disponibles para resolver el turno")

        candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
        _, _, handler, decision = candidates[0]
        return handler, decision
