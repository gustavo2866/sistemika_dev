from types import SimpleNamespace

import pytest

from agente.v2.core.context import MessageInfo, TurnContext
from agente.v2.core.orchestrator import AgentTurnOrchestrator
from agente.v2.core.process import TurnResult
from agente.v2.core.state import ConversationState, JsonConversationStateStore
from agente.v2.processes.general.handler import GeneralProcess
from agente.v2.processes.general.llm_client import GeneralLLMClient
from agente.v2.processes.general.models import GeneralDecision
from app.models import CRMMensaje


def _context(*, active_process: str | None = None, is_project: bool = True) -> TurnContext:
    return TurnContext(
        oportunidad_id=1,
        contacto_id=None,
        canal="whatsapp",
        trigger="webhook",
        message=MessageInfo(id=1, contenido="necesito cemento", tipo="entrada"),
        history=[],
        conversation_state=ConversationState(
            oportunidad_id=1,
            active_process=active_process,
        ),
        is_project=is_project,
    )


class _FakeGeneralLLM:
    def __init__(self, intent: str) -> None:
        self.intent = intent

    async def interpret_turn(self, mensaje: str):
        return GeneralDecision(type=self.intent)  # type: ignore[arg-type]


class TestGeneralProcess:
    def test_priority_only_without_active_process_on_project(self):
        process = GeneralProcess(llm_client=_FakeGeneralLLM("saludo"))

        assert process.priority(_context()) == 100
        assert process.priority(_context(active_process="pedido_obra")) is None
        assert process.priority(_context(is_project=False)) is None

    @pytest.mark.asyncio
    async def test_start_pedido_obra_requests_handoff(self):
        process = GeneralProcess(llm_client=_FakeGeneralLLM("start_pedido_obra"))

        result = await process.handle(_context())

        assert result.activate_process == "pedido_obra"
        assert result.keep_active is False

    @pytest.mark.asyncio
    async def test_saludo_returns_fixed_menu(self):
        process = GeneralProcess(llm_client=_FakeGeneralLLM("saludo"))

        result = await process.handle(_context())

        assert result.payload["type"] == "general_reply"
        assert "Pedido de materiales" in result.payload["reply_to_user"]
        assert "Parte diario" in result.payload["reply_to_user"]

    @pytest.mark.asyncio
    async def test_llm_error_returns_recoverable_reply(self):
        llm = SimpleNamespace(interpret_turn=lambda mensaje: None)

        async def fail(_mensaje):
            raise ValueError("boom")

        llm.interpret_turn = fail
        process = GeneralProcess(llm_client=llm)

        result = await process.handle(_context())

        assert result.payload["type"] == "general_reply"
        assert "No pude interpretar" in result.payload["reply_to_user"]

    def test_llm_parser_rejects_unknown_intent(self):
        with pytest.raises(ValueError):
            GeneralLLMClient._parse({"type": "invented"})


@pytest.mark.asyncio
async def test_orchestrator_activate_and_forward_reuses_original_message(db_session, tmp_path):
    message = CRMMensaje(
        tipo="entrada",
        contenido="necesito cemento",
        oportunidad_id=1,
    )
    db_session.add(message)
    db_session.commit()
    db_session.refresh(message)

    class General:
        name = "general"

        def priority(self, ctx):
            return 100 if ctx.active_process is None else None

        async def handle(self, ctx):
            return TurnResult(payload={}, keep_active=False, activate_process="pedido_obra")

    class Pedido:
        name = "pedido_obra"

        def priority(self, ctx):
            return 100 if ctx.active_process == self.name else None

        async def handle(self, ctx):
            assert ctx.message.contenido == "necesito cemento"
            assert ctx.active_process == self.name
            return TurnResult(
                payload={"type": "pedido_obra_reply", "items": ["cemento"]},
                keep_active=True,
                process_state={"items": ["cemento"]},
            )

    store = JsonConversationStateStore(root_dir=tmp_path)
    orchestrator = AgentTurnOrchestrator(
        processes=[General(), Pedido()],
        state_store=store,
    )

    def build_context(session, message_id, *, trigger="webhook", state=None):
        return TurnContext(
            oportunidad_id=1,
            contacto_id=None,
            canal="whatsapp",
            trigger=trigger,
            message=MessageInfo(id=message_id, contenido=message.contenido, tipo="entrada"),
            history=[],
            conversation_state=state or store.load(1),
            is_project=True,
        )

    orchestrator.build_context = build_context  # type: ignore[method-assign]

    result = await orchestrator.process_turn(db_session, message.id, "webhook")

    assert result["type"] == "pedido_obra_reply"
    assert result["process_name"] == "pedido_obra"
    assert store.load(1).active_process == "pedido_obra"
