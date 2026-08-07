"""Pruebas del contrato de prompt de parte_diario."""

from __future__ import annotations

import pytest

from agente.v3.subprocesses.parte_diario.llm_client import ParteDiarioLLMClient, _parse_turn_plan
from agente.v3.subprocesses.parte_diario.models import ParteDiarioState


class FakeChatClient:
    def __init__(self) -> None:
        self.calls = []
        self.next_response = {"operations": [], "reply": None}

    async def complete_json(self, **kwargs):
        self.calls.append(kwargs)
        return self.next_response


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
    assert '"fecha_referencia":"' in prompt
    assert '"zona_horaria":"America/Argentina/Buenos_Aires"' in prompt
    assert '"mensaje":"mostrame el parte diario del viernes"' in prompt
    assert "`fecha_referencia` representa HOY" in prompt
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
    assert "`parte.fecha` es la fecha operativa del parte en carga" in prompt
    assert "Nunca agregues set_fecha si el mensaje actual no menciona una fecha explicita o" in prompt
    assert "conserva esa fecha sin" in prompt
    assert "emitir set_fecha" in prompt
    assert "Tiempos verbales como" in prompt


@pytest.mark.asyncio
async def test_cierre_prompt_reserves_exact_save_close_commands():
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
    assert "1 o GUARDAR: guarda el borrador y sale del proceso" in prompt
    assert "2 o CERRAR: intenta cerrar el parte" in prompt
    assert "No guardes, cierres ni descartes desde aca" in prompt


@pytest.mark.asyncio
async def test_contextual_reply_must_answer_informational_questions_first():
    chat = FakeChatClient()
    chat.next_response = {"reply": "El 9 de julio es feriado nacional en Argentina."}
    client = ParteDiarioLLMClient(chat_client=chat)

    reply = await client.contextual_reply(
        mensaje="cuales son los feriados de julio en argentina?",
        etapa="seleccionar_fecha",
        obra="Francia 118",
        opciones_visibles=[{"id": "2026-07-05", "label": "05/07/2026 dom"}],
    )

    prompt = chat.calls[0]["system_prompt"]
    assert reply == "El 9 de julio es feriado nacional en Argentina."
    assert "respondela primero" in prompt
    assert "No respondas solo con una instruccion de menu ante una pregunta informativa" in prompt
    assert "No inventes datos" in prompt


@pytest.mark.asyncio
async def test_carga_prompt_requires_command_classification_before_novelty_parsing():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat)

    await client.interpret_turn(
        "no ninguna",
        ParteDiarioState(oportunidad_id=1, idproyecto=10, fecha="2026-08-01"),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    response_schema = chat.calls[0]["response_format"]["json_schema"]["schema"]
    assert "Rol conversacional" in prompt
    assert "backend_action=\"finish_loading\"" in prompt
    assert "intencion conversacional" in prompt
    assert "salida silenciosa" in prompt
    assert "No intentes cubrir frases por patron fijo" in prompt
    assert response_schema["required"] == [
        "message_kind",
        "command_action",
        "backend_action",
        "operations",
        "reply",
    ]


def test_parse_turn_plan_maps_command_action_to_backend_operation():
    plan = _parse_turn_plan(
        {
            "message_kind": "comando",
            "command_action": "finalizar_carga",
            "backend_action": "none",
            "operations": [],
            "reply": None,
        }
    )

    assert [operation.type for operation in plan.operations] == ["solicitar_confirmacion"]


def test_parse_turn_plan_preserves_primitive_operations_for_natural_corrections():
    plan = _parse_turn_plan(
        {
            "message_kind": "novedad",
            "command_action": "none",
            "backend_action": "none",
            "operations": [
                {
                    "type": "eliminar_novedad",
                    "nombre": "medina juan manuel",
                    "estado_codigo": None,
                    "horas": None,
                    "horas_extra": None,
                    "descripcion": None,
                    "fecha": None,
                    "requested": None,
                    "reply": None,
                },
                {
                    "type": "agregar_novedad",
                    "nombre": "medina ivan",
                    "estado_codigo": "FAL",
                    "horas": None,
                    "horas_extra": None,
                    "descripcion": None,
                    "fecha": None,
                    "requested": None,
                    "reply": None,
                },
            ],
            "reply": None,
        }
    )

    assert [operation.type for operation in plan.operations] == ["eliminar_novedad", "agregar_novedad"]
    assert plan.operations[0].nombre == "medina juan manuel"
    assert plan.operations[1].nombre == "medina ivan"
    assert plan.operations[1].estado_codigo == "FAL"
