from __future__ import annotations

from typing import Any, Protocol

from sqlmodel import Session

from agente.v2.core.models import (
    ChatTurnContext,
    MaterialItem,
    NormalTurnDecision,
    PendingTurnDecision,
    ProcessActivationDecision,
    ProcessTurnResult,
    SendResult,
    SendTextCommand,
)


class AgentProcessHandler(Protocol):
    process_name: str

    def can_activate(self, context: ChatTurnContext) -> ProcessActivationDecision:
        ...

    def handle_turn(self, context: ChatTurnContext) -> ProcessTurnResult:
        ...


class LLMGateway(Protocol):
    def interpret_normal_turn(
        self,
        context: ChatTurnContext,
        prompt_families: list[dict[str, Any]],
    ) -> NormalTurnDecision:
        ...

    def classify_pending_turn(
        self,
        context: ChatTurnContext,
        pending_item: MaterialItem,
        pending_attribute: dict[str, Any],
    ) -> PendingTurnDecision:
        ...


class OutboundChannelAdapter(Protocol):
    async def send_text(self, session: Session, command: SendTextCommand) -> SendResult:
        ...
