"""Transporte del historial al modelo sin llamadas de red."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agente.v3.llm.openai_chat_client import OpenAIChatClient


# Mantiene roles y orden: instrucciones, dialogo anterior, mensaje actual.
@pytest.mark.asyncio
@pytest.mark.parametrize("history", [None, [
    {"role": "user", "content": "limpiar todo"},
    {"role": "assistant", "content": "Queres eliminar todas las novedades?"},
]])
async def test_complete_json_preserva_historial_y_usuarios(history):
    create = AsyncMock(return_value=SimpleNamespace(choices=[SimpleNamespace(
        message=SimpleNamespace(content='{"operations": []}', refusal=None),
    )]))
    sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    client = OpenAIChatClient(api_key="test-key", client=sdk)
    result = await client.complete_json(system_prompt="Interpreta el dialogo", user_content="si",
                                        response_format={"type": "json_object"}, history=history)
    assert result == {"operations": []}
    assert create.call_args.kwargs["messages"] == [
        {"role": "system", "content": "Interpreta el dialogo"},
        *(history or []),
        {"role": "user", "content": "si"},
    ]


# Los modelos de razonamiento usan su parametro y el limite de completion actual.
@pytest.mark.asyncio
async def test_complete_json_configura_razonamiento():
    create = AsyncMock(return_value=SimpleNamespace(choices=[SimpleNamespace(
        message=SimpleNamespace(content='{"operations": []}', refusal=None),
    )]))
    sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    client = OpenAIChatClient(
        api_key="test-key",
        model="gpt-6-luna",
        reasoning_effort="low",
        client=sdk,
    )

    await client.complete_json(
        system_prompt="Interpreta",
        response_format={"type": "json_object"},
        max_tokens=321,
    )

    request = create.call_args.kwargs
    assert request["model"] == "gpt-6-luna"
    assert request["reasoning_effort"] == "low"
    assert request["max_completion_tokens"] == 321
    assert "max_tokens" not in request
