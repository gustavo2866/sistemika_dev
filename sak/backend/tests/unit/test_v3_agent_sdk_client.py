"""Configuracion de razonamiento en el wrapper de Agents SDK."""

from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from agente.v3.llm import agent_sdk_client as module
from agente.v3.llm.agent_sdk_client import AgentSDKClient


class Output(BaseModel):
    respuesta: str


@pytest.mark.asyncio
async def test_agent_sdk_envia_reasoning_effort(monkeypatch):
    captured = {}

    class FakeModelSettings:
        def __init__(self, *, reasoning):
            self.reasoning = reasoning

    class FakeAgent:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    class FakeRunner:
        @staticmethod
        async def run(agent, *, input, run_config):
            return SimpleNamespace(final_output={"respuesta": "ok"})

    class FakeRunConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    monkeypatch.setattr(
        module,
        "_load_agents_sdk",
        lambda: (FakeAgent, FakeModelSettings, FakeRunner, FakeRunConfig),
    )
    client = AgentSDKClient(
        name="test",
        instructions="test",
        output_type=Output,
        model="gpt-6-luna",
        reasoning_effort="low",
        api_key="test-key",
    )

    result = await client.run("hola")

    assert result == Output(respuesta="ok")
    assert captured["model"] == "gpt-6-luna"
    assert captured["model_settings"].reasoning == {"effort": "low"}
