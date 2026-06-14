"""Pruebas del contrato de prompt de parte_diario."""

from __future__ import annotations

import pytest

from agente.v3.subprocesses.parte_diario.llm_client import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.models import ParteDiarioState


class FakeChatClient:
    def __init__(self) -> None:
        self.calls = []

    async def complete_json(self, **kwargs):
        self.calls.append(kwargs)
        return {"operations": [], "reply": None}


@pytest.mark.asyncio
async def test_prompt_includes_local_date_and_weekday_resolution_rules():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat)

    await client.interpret_turn(
        "mostrame el parte diario del viernes",
        ParteDiarioState(oportunidad_id=1, idproyecto=10),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    assert '"fecha_actual":"' in prompt
    assert '"zona_horaria":"America/Argentina/Buenos_Aires"' in prompt
    assert '"mensaje":"mostrame el parte diario del viernes"' in prompt
    assert '"el viernes pasado"' in prompt
    assert "set_fecha para el viernes correspondiente y luego mostrar_parte" in prompt


@pytest.mark.asyncio
async def test_prompt_requires_preserving_active_date_without_new_temporal_reference():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat)

    await client.interpret_turn(
        "cabrera trabajo 3 hs",
        ParteDiarioState(oportunidad_id=1, idproyecto=10, fecha="2026-05-29"),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    assert '"mensaje":"cabrera trabajo 3 hs"' in prompt
    assert '"fecha":"2026-05-29"' in prompt
    assert "Nunca agregues set_fecha si el mensaje actual no menciona una referencia temporal." in prompt
    assert "conserva esa fecha sin emitir set_fecha" in prompt


@pytest.mark.asyncio
async def test_cierre_prompt_reserves_exact_confirmation_commands():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat).for_stage("cierre")

    await client.interpret_turn(
        "agrega vera 4 hs",
        ParteDiarioState(oportunidad_id=1, idproyecto=10, fecha="2026-05-29"),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    assert "Etapa actual: cierre." in prompt
    assert "1 o CONFIRMAR: confirma y guarda el parte" in prompt
    assert "No confirmes ni descartes desde aca" in prompt
