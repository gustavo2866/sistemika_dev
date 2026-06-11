import pytest

from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.subprocesses.pedido_obra.handler import PedidoObraSubprocess
from agente.v3.subprocesses.pedido_obra.interpreter import PedidoObraOperation


class FakeCargaLLM:
    async def interpret_carga(self, message, state):
        return [
            PedidoObraOperation(type="insert", descripcion="cemento", cantidad=10, unidad="bolsas"),
            PedidoObraOperation(type="insert", descripcion="hierro del 12", cantidad=5, unidad="barras"),
        ], 12


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
async def test_pedido_obra_v3_carga_usa_plan_llm_y_backend_aplica_estado():
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())
    context = V3ConversationContext(
        conversation_id="conv-1",
        process_state={
            "etapa": "carga",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 20,
        },
    )
    result = await process.handle(_message("necesito cemento y hierro"), context)

    assert result.context.active_process == "pedidoObra"
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["items"] == [
        {"item_id": result.context.process_state["items"][0]["item_id"], "descripcion": "cemento", "cantidad": 10, "unidad": "bolsas"},
        {"item_id": result.context.process_state["items"][1]["item_id"], "descripcion": "hierro del 12", "cantidad": 5, "unidad": "barras"},
    ]
    assert result.metadata["interpreter"] == "llm"
    assert result.metadata["llm_ms"] == 12
