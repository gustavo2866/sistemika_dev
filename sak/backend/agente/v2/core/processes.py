# Modulo reemplazado - usa agente.v2.core.process (sin 's').
from agente.v2.core.process import AgentProcess as AgentProcess, TurnResult as TurnResult, ProcessRegistry as ProcessRegistry  # noqa: F401
from dataclasses import dataclass, field
from typing import Any


# Tipos de compatibilidad usados por handler.py - solo tipos internos, no contratos de core.

@dataclass
class BusinessAction:
    action_type: str
    payload: dict[str, Any] = field(default_factory=dict)

    def __init__(self, action_type: str, payload: dict[str, Any] | None = None) -> None:
        self.action_type = action_type
        self.payload = payload or {}


@dataclass
class ProcessUserReply:
    text: str | None


@dataclass
class ProcessHandoff:
    target_process: str
    reason: str = ""


@dataclass
class ProcessActivationDecision:
    can_activate: bool
    priority: int
    reason: str
    process_name: str


@dataclass
class ProcessTurnResult:
    process_name: str
    consumed_turn: bool
    keep_process_active: bool
    next_substate: str | None
    updated_process_state: dict[str, Any] | None
    actions: list[BusinessAction]
    user_reply: ProcessUserReply | None
    response_payload: dict[str, Any]
    handoff: ProcessHandoff | None = None
    warnings: list[str] = field(default_factory=list)
    debug: dict[str, Any] = field(default_factory=dict)