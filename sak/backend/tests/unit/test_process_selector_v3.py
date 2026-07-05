import pytest

from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.orchestrator.process_selector import (
    PROCESS_GENERAL,
    PROCESS_PARTE_DIARIO,
    V3ProcessSelector,
)


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
async def test_selector_no_toma_pedido_de_materiales_con_saludo_como_general_fast_path(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    selector = V3ProcessSelector()
    context = V3ConversationContext(conversation_id="conv-1")

    selection = await selector.resolve(_message("hola necesito 20 bolsas de cemento"), context)

    assert selection.mode == "fallback"


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ["hola", "buenos dias", "hola buen dia", "hola como estas"])
async def test_selector_mantiene_saludo_simple_como_general(monkeypatch, text):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    selector = V3ProcessSelector()
    context = V3ConversationContext(conversation_id="conv-1")

    selection = await selector.resolve(_message(text), context)

    assert selection.process_name == PROCESS_GENERAL
    assert selection.mode == "fast_path"


@pytest.mark.asyncio
async def test_selector_no_toma_saludo_con_solicitud_como_general_fast_path(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    selector = V3ProcessSelector()
    context = V3ConversationContext(conversation_id="conv-1")

    selection = await selector.resolve(_message("hola necesito 2 juegos de ducha"), context)

    assert selection.mode == "fallback"


@pytest.mark.asyncio
async def test_selector_deriva_respuesta_interactiva_de_fecha_a_parte_diario(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    selector = V3ProcessSelector()
    context = V3ConversationContext(conversation_id="conv-1")

    selection = await selector.resolve(_message("2026-06-28"), context)

    assert selection.process_name == PROCESS_PARTE_DIARIO
    assert selection.mode == "fast_path"


@pytest.mark.asyncio
async def test_selector_deriva_titulo_visible_de_fecha_a_parte_diario(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    selector = V3ProcessSelector()
    context = V3ConversationContext(conversation_id="conv-1")

    selection = await selector.resolve(_message("28/06/2026 dom"), context)

    assert selection.process_name == PROCESS_PARTE_DIARIO
    assert selection.mode == "fast_path"
