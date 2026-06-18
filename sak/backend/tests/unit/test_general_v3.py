import pytest

from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.subprocesses.general import GeneralSubprocess
from agente.v3.subprocesses.general_agent import GENERAL_MENU_TEXT, GeneralAgentOutput


class FakeGeneralAgent:
    def __init__(self, output=None, exc: Exception | None = None) -> None:
        self.output = output
        self.exc = exc
        self.calls = []

    async def respond(self, **kwargs):
        self.calls.append(kwargs)
        if self.exc is not None:
            raise self.exc
        return self.output


def _message(text: str) -> V3InboundMessage:
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
        normalized_payload={},
    )


@pytest.mark.asyncio
async def test_general_v3_responde_general_con_agent_sdk():
    client = FakeGeneralAgent(
        GeneralAgentOutput(
            type="general_reply",
            target_process=None,
            respuesta="Puedo ayudarte con pedidos de obra o partes diarios.",
            reason="consulta_general",
        )
    )
    process = GeneralSubprocess(agent_client=client)
    result = await process.handle(_message("que podes hacer"), V3ConversationContext(conversation_id="conv-1"))

    assert result.reply_text == "Puedo ayudarte con pedidos de obra o partes diarios."
    assert result.context.active_process == "general"
    assert result.context.process_state["agent_source"] == "agent_sdk"
    assert result.metadata["status"] == "general_reply"
    assert client.calls[0]["message_text"] == "que podes hacer"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "text",
    [
        "hola",
        "Hola!",
        "buen dia",
        "buenos dias",
        "buenas tardes",
        "hola buen dia",
        "hola como estas",
        "",
    ],
)
async def test_general_v3_saludo_puro_responde_menu_sin_agent_sdk(text):
    client = FakeGeneralAgent()
    process = GeneralSubprocess(agent_client=client)
    result = await process.handle(_message(text), V3ConversationContext(conversation_id="conv-1"))

    assert result.reply_text == GENERAL_MENU_TEXT
    assert result.context.active_process == "general"
    assert result.context.process_state["agent_source"] == "fast_path"
    assert result.metadata["agent_source"] == "fast_path"
    assert result.metadata["reason"] == "pure_greeting"
    assert client.calls == []


@pytest.mark.asyncio
async def test_general_v3_saludo_con_solicitud_no_usa_fastpath():
    client = FakeGeneralAgent(
        GeneralAgentOutput(
            type="handoff",
            target_process="pedidoObra",
            respuesta="Perfecto. Decime que materiales necesitas y para que obra.",
            reason="pedido_materiales",
        )
    )
    process = GeneralSubprocess(agent_client=client)
    result = await process.handle(
        _message("hola necesito cemento"),
        V3ConversationContext(conversation_id="conv-1"),
    )

    assert result.context.active_process == "pedidoObra"
    assert result.metadata["status"] == "handoff"
    assert client.calls[0]["message_text"] == "hola necesito cemento"


@pytest.mark.asyncio
async def test_general_v3_deriva_a_pedido_obra():
    client = FakeGeneralAgent(
        GeneralAgentOutput(
            type="handoff",
            target_process="pedidoObra",
            respuesta="Perfecto. Decime que materiales necesitas y para que obra.",
            reason="pedido_materiales",
        )
    )
    process = GeneralSubprocess(agent_client=client)
    result = await process.handle(_message("necesito cemento"), V3ConversationContext(conversation_id="conv-1"))

    assert result.reply_text == "Perfecto. Decime que materiales necesitas y para que obra."
    assert result.context.active_process == "pedidoObra"
    assert result.context.process_state == {}
    assert result.metadata["status"] == "handoff"
    assert result.metadata["target_process"] == "pedidoObra"


@pytest.mark.asyncio
async def test_general_v3_deriva_a_parte_diario():
    client = FakeGeneralAgent(
        GeneralAgentOutput(
            type="handoff",
            target_process="parteDiario",
            respuesta="Perfecto. Pasame la asistencia o novedades del dia.",
            reason="parte_diario",
        )
    )
    process = GeneralSubprocess(agent_client=client)
    result = await process.handle(_message("cargar asistencia"), V3ConversationContext(conversation_id="conv-1"))

    assert result.context.active_process == "parteDiario"
    assert result.metadata["target_process"] == "parteDiario"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("text", "target_process", "handoff_text"),
    [
        ("1", "pedidoObra", "pedido obra"),
        ("2", "parteDiario", "parte diario"),
    ],
)
async def test_general_v3_menu_numerico_deriva_sin_llamar_sdk(text, target_process, handoff_text):
    client = FakeGeneralAgent()
    process = GeneralSubprocess(agent_client=client)
    result = await process.handle(
        _message(text),
        V3ConversationContext(conversation_id="conv-1", active_process="general"),
    )

    assert result.context.active_process == target_process
    assert result.metadata["status"] == "handoff"
    assert result.metadata["target_process"] == target_process
    assert result.metadata["handoff_text"] == handoff_text
    assert client.calls == []


@pytest.mark.asyncio
async def test_general_v3_usa_fallback_si_falla_agent_sdk():
    process = GeneralSubprocess(agent_client=FakeGeneralAgent(exc=RuntimeError("sin sdk")))
    result = await process.handle(_message("ayuda"), V3ConversationContext(conversation_id="conv-1"))

    assert result.reply_text == GENERAL_MENU_TEXT
    assert result.context.active_process == "general"
    assert result.metadata["agent_source"] == "fallback"


@pytest.mark.asyncio
async def test_general_v3_cancelar_cierra_contexto_sin_llamar_sdk():
    client = FakeGeneralAgent()
    process = GeneralSubprocess(agent_client=client)
    context = V3ConversationContext(
        conversation_id="conv-1",
        active_process="general",
        process_state={"last_text": "hola"},
    )
    result = await process.handle(_message("cancelar"), context)

    assert result.context.active_process is None
    assert result.context.process_state == {}
    assert "Conversacion cancelada" in result.reply_text
    assert client.calls == []
