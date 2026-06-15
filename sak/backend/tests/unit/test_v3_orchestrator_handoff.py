import pytest

from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessResult
from agente.v3.orchestrator.context_store import V3ContextStore
from agente.v3.orchestrator.process_selector import PROCESS_GENERAL, V3ProcessSelection
from agente.v3.orchestrator.service import V3Orchestrator
from agente.v3.outbox.queue import V3Outbox
from agente.v3.subprocesses.registry import V3SubprocessRegistry


class FakeSelector:
    async def resolve(self, message, context):
        return V3ProcessSelection(
            process_name=PROCESS_GENERAL,
            mode="test",
            confidence=1.0,
            reason="test",
        )


class FakeGeneralProcess:
    def __init__(self, *, handoff_text: str | None = None) -> None:
        self.handoff_text = handoff_text

    name = PROCESS_GENERAL

    async def handle(self, message, context):
        updated = context.copy()
        updated.active_process = message.normalized_payload["target_process"]
        updated.process_state = {}
        return V3ProcessResult(
            context=updated,
            reply_text="respuesta intermedia general",
            metadata={
                "process_name": self.name,
                "status": "handoff",
                "target_process": updated.active_process,
                **({"handoff_text": self.handoff_text} if self.handoff_text else {}),
            },
        )


class FakeTargetProcess:
    def __init__(self, name: str) -> None:
        self.name = name
        self.messages = []

    async def handle(self, message, context):
        self.messages.append((message, context.copy()))
        updated = context.copy()
        updated.active_process = self.name
        updated.process_state = {"captured_text": message.text}
        return V3ProcessResult(
            context=updated,
            reply_text=f"{self.name} proceso: {message.text}",
            metadata={"process_name": self.name, "status": "ok"},
        )


def _message(text: str, target_process: str) -> V3InboundMessage:
    return V3InboundMessage(
        id="msg-1",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        conversation_id="conv-1",
        external_message_id="external-1",
        from_address="from",
        to_address="to",
        text=text,
        message_type="text",
        raw_payload={},
        normalized_payload={"target_process": target_process},
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("target_process", ["pedidoObra", "parteDiario"])
async def test_orchestrator_executes_general_handoff_with_same_message(target_process: str):
    target = FakeTargetProcess(target_process)
    registry = V3SubprocessRegistry([FakeGeneralProcess(), target])
    orchestrator = V3Orchestrator(
        context_store=V3ContextStore(),
        outbox=V3Outbox(),
        subprocess_registry=registry,
        process_selector=FakeSelector(),
    )

    result, outbound_id = await orchestrator.process_message(_message("necesito 20 bolsas cemento", target_process))

    assert outbound_id
    assert result.reply_text == f"{target_process} proceso: necesito 20 bolsas cemento"
    assert result.metadata["selected_process"] == target_process
    assert result.metadata["initial_selected_process"] == PROCESS_GENERAL
    assert result.metadata["handoff_from_process"] == PROCESS_GENERAL
    assert result.metadata["handoff_to_process"] == target_process
    assert target.messages[0][0].text == "necesito 20 bolsas cemento"
    assert target.messages[0][1].active_process == target_process


@pytest.mark.asyncio
async def test_orchestrator_executes_general_handoff_with_forwarded_text():
    target = FakeTargetProcess("pedidoObra")
    registry = V3SubprocessRegistry([FakeGeneralProcess(handoff_text="pedido obra"), target])
    orchestrator = V3Orchestrator(
        context_store=V3ContextStore(),
        outbox=V3Outbox(),
        subprocess_registry=registry,
        process_selector=FakeSelector(),
    )

    result, outbound_id = await orchestrator.process_message(_message("1", "pedidoObra"))

    assert outbound_id
    assert result.reply_text == "pedidoObra proceso: pedido obra"
    assert target.messages[0][0].text == "pedido obra"
