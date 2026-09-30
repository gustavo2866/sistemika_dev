"""Configuracion dedicada del modelo de Parte Diario."""

from agente.v3.subprocesses.parte_diario.adapters.carga_agent import ParteDiarioCargaAgentClient
from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.adapters.model_config import resolve_parte_diario_model
from agente.v3.subprocesses.parte_diario.adapters.query_agent import ParteDiarioQueryAgentClient


def test_modelo_default_es_luna_low(monkeypatch):
    monkeypatch.delenv("OPENAI_PARTE_DIARIO_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_PARTE_DIARIO_REASONING_EFFORT", raising=False)
    monkeypatch.delenv("OPENAI_PARTE_DIARIO_CARGA_AGENT_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_PARTE_DIARIO_QUERY_AGENT_MODEL", raising=False)

    assert resolve_parte_diario_model() == ("gpt-6-luna", "low")
    llm = ParteDiarioLLMClient(api_key="test-key")
    carga = ParteDiarioCargaAgentClient()
    query = ParteDiarioQueryAgentClient()

    assert (llm._chat.model, llm._chat.reasoning_effort) == ("gpt-6-luna", "low")
    assert (carga.model, carga.reasoning_effort) == ("gpt-6-luna", "low")
    assert (query.model, query.reasoning_effort) == ("gpt-6-luna", "low")


def test_override_de_modelo_anterior_no_fuerza_razonamiento(monkeypatch):
    monkeypatch.delenv("OPENAI_PARTE_DIARIO_REASONING_EFFORT", raising=False)

    assert resolve_parte_diario_model("gpt-4.1-mini") == ("gpt-4.1-mini", None)
