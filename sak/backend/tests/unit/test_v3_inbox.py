from datetime import UTC, datetime

import pytest

from agente.v3.contracts import V3InboundMessage, V3OrchestratorResult
from agente.v3.inbox.queue import V3Inbox


def _message() -> V3InboundMessage:
    return V3InboundMessage(
        id="msg-1",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        conversation_id="conv-1",
        external_message_id="external-1",
        from_address="from",
        to_address="to",
        text="hola",
        message_type="text",
        raw_payload={},
        normalized_payload={},
        received_at=datetime.now(UTC),
    )


class _FakeOrchestrator:
    def __init__(self, events: list[str]) -> None:
        self.events = events

    async def process_message(self, message):
        self.events.append("orchestrator")
        return V3OrchestratorResult(status="ok", reply_text="ok"), "out-1"


class _FailingOrchestrator:
    async def process_message(self, message):
        raise RuntimeError("db unavailable")


@pytest.mark.asyncio
async def test_v3_inbox_muestra_typing_antes_del_orquestador(monkeypatch):
    events: list[str] = []

    async def fake_show_typing(message):
        events.append("typing")

    monkeypatch.setattr("agente.v3.inbox.queue.show_typing_for_inbound_message", fake_show_typing)

    inbox = V3Inbox()
    await inbox.enqueue_many([_message()])
    processed = await inbox.process_next(orchestrator=_FakeOrchestrator(events))

    assert events == ["typing", "orchestrator"]
    assert processed is not None
    assert "typing" in processed.timings_ms


@pytest.mark.asyncio
async def test_v3_inbox_registra_error_del_orquestador_sin_propagar(monkeypatch):
    async def fake_show_typing(message):
        return None

    monkeypatch.setattr("agente.v3.inbox.queue.show_typing_for_inbound_message", fake_show_typing)

    inbox = V3Inbox()
    await inbox.enqueue_many([_message()])

    result = await inbox.process_pending(orchestrator=_FailingOrchestrator())

    assert result["status"] == "ok"
    assert result["processed_count"] == 1
    processed = result["processed"][0]
    assert processed["orchestrator"]["status"] == "error"
    assert processed["orchestrator"]["metadata"]["error"] == "db unavailable"
    assert processed["orchestrator"]["metadata"]["error_type"] == "RuntimeError"
    assert processed["outbox"]["status"] == "not_queued"
    assert result["pending_count"] == 0
