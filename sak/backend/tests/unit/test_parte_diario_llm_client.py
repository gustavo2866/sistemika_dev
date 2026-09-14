"""Pruebas del contrato de prompt de parte_diario."""

from __future__ import annotations

import json
import pytest

from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient, _parse_turn_plan
from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, NominaItem, ParteDiarioDraft
from agente.v3.subprocesses.parte_diario.domain.novedades import execute_plan


class FakeChatClient:
    def __init__(self) -> None:
        self.calls = []
        self.next_response = {"operations": [], "reply": None}

    async def complete_json(self, **kwargs):
        self.calls.append(kwargs)
        return self.next_response


# El contrato solo ofrece retorno cuando hay un estado de aclaracion que terminar.
@pytest.mark.asyncio
@pytest.mark.parametrize("etapa", ["carga", "listado", "carga_aclaracion", "carga_validar_estado", "cierre"])
async def test_schema_retoma_solo_desde_aclaracion(etapa):
    chat = FakeChatClient()
    await ParteDiarioLLMClient(chat_client=chat).interpret_turn(
        "limpia todo", ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-09-12"),
        [], [], contexto_conversacion={"etapa": etapa},
    )
    properties = chat.calls[0]["response_format"]["json_schema"]["schema"]["properties"]
    assert ("resume_loading" in properties["backend_action"]["enum"]) == (etapa == "carga_aclaracion")
    assert ("retomar_carga" in properties["operations"]["items"]["properties"]["type"]["enum"]) == (etapa == "carga_aclaracion")
    assert "ask_clarification" in properties["backend_action"]["enum"]
    assert "eliminar_novedad" in properties["operations"]["items"]["properties"]["type"]["enum"]


@pytest.mark.asyncio
async def test_prompt_includes_local_date_and_weekday_resolution_rules():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat)

    await client.interpret_turn(
        "mostrame el parte diario del viernes",
        ParteDiarioDraft(oportunidad_id=1, idproyecto=10),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    payload = json.loads(chat.calls[0]["user_content"])
    assert payload["fecha_referencia"]
    assert payload["zona_horaria"] == "America/Argentina/Buenos_Aires"
    assert payload["mensaje"] == "mostrame el parte diario del viernes"
    assert "estrictamente anterior a hoy" in prompt
    assert 'Si hoy es lunes, "lunes" es el lunes anterior' in prompt
    assert "inicio o consulta tambien genera set_fecha" in prompt


# El prompt comun especifica que el destino pertenece a una persona, no a todo el lote.
@pytest.mark.asyncio
async def test_carga_prompt_asigna_destino_por_persona():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat).for_stage("carga")
    await client.interpret_turn(
        "medina trabajo 12 hs, ponce trabajo en francia",
        ParteDiarioDraft(oportunidad_id=1, idproyecto=10), [], [],
    )
    prompt = chat.calls[0]["system_prompt"]
    assert "Asigna el destino por persona" in prompt
    assert "Informar horas sin otra obra no implica transferencia" in prompt
    assert "mencionada para otra persona" in prompt
    assert "sabado 6h, domingo 0h" in prompt
    assert "si no se indican horas, horas=null" in prompt


# Comprueba el contrato comun y que ejecutar sus operaciones conserva motivo y horas.
@pytest.mark.asyncio
@pytest.mark.parametrize("modo", ["carga", "listado"])
async def test_motivo_especifico_y_horas_independientes(modo):
    chat = FakeChatClient()
    nominas = [NominaItem(101, "Xavier", "Delgado"), NominaItem(102, "Paco", "Gerlo")]
    estados = [EstadoItem(1, "P", "PRESENTE"), EstadoItem(2, "FAL", "FALTA"),
               EstadoItem(3, "ACC", "ACCIDENTE"), EstadoItem(4, "PER", "PERMISO")]
    chat.next_response = {
        "operations": [
            {"type": "agregar_novedad", "nombre": "Delgado", "estado_codigo": "ACC",
             "idnomina": 101 if modo == "listado" else None, "horas": None},
            {"type": "agregar_novedad", "nombre": "Gerlo", "estado_codigo": "PER",
             "idnomina": 102 if modo == "listado" else None, "horas": 3},
        ], "reply": None,
    }
    mensaje = ("[idnomina=101] Delgado, Xavier: se quebro el braso\n"
               "[idnomina=102] Gerlo, Paco: pidio salir para ir al banco trabajo 3hs"
               if modo == "listado" else
               "Delgado se quebro el braso, Gerlo pidio salir para ir al banco trabajo 3hs")
    draft = ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-09-12")
    plan = await ParteDiarioLLMClient(chat_client=chat).interpret_turn(
        mensaje, draft, nominas, estados, contexto_conversacion={"etapa": modo},
    )
    prompt = chat.calls[0]["system_prompt"]
    payload = json.loads(chat.calls[0]["user_content"])
    assert "El motivo especifico tiene prioridad" in prompt
    assert "Estado y horas son datos independientes" in prompt
    assert "errores ortograficos comprensibles" in prompt
    assert "Usa estos codigos solo si estan activos" in prompt
    assert payload["estados_activos"] == [
        {"codigo": estado.abreviatura, "nombre": estado.nombre} for estado in estados
    ]
    assert payload["mensaje"] == mensaje
    result = execute_plan(draft, plan, nominas, nominas, estados)
    assert not result.errors
    assert not result.next_state.pendientes_ambiguos
    assert [(n.idnomina, n.estado_codigo, n.horas) for n in result.next_state.novedades] == [
        (101, "ACC", 0), (102, "PER", 3),
    ]


@pytest.mark.asyncio
async def test_initial_request_normalizer_extracts_date_with_own_schema():
    chat = FakeChatClient()
    chat.next_response = {"fecha": "2026-08-06", "obra": None}
    client = ParteDiarioLLMClient(chat_client=chat)

    normalized = await client.normalize_initial_request("parte diario del jueves")

    prompt = chat.calls[0]["system_prompt"]
    schema = chat.calls[0]["response_format"]["json_schema"]["schema"]
    assert normalized == {"fecha": "2026-08-06", "obra": None}
    assert "normalizador inicial del proceso parte diario" in prompt
    assert "deben ser siempre anteriores a `fecha_referencia`" in prompt
    assert "ocurrencia anterior inmediata" in prompt
    assert schema["required"] == ["fecha", "obra"]
    assert set(schema["properties"]) == {"fecha", "obra"}


@pytest.mark.asyncio
async def test_prompt_requires_preserving_active_date_without_new_temporal_reference():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat)

    await client.interpret_turn(
        "cabrera trabajo 3 hs",
        ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-05-29"),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    payload = json.loads(chat.calls[0]["user_content"])
    assert payload["mensaje"] == "cabrera trabajo 3 hs"
    assert payload["parte"]["fecha"] == "2026-05-29"
    assert "Conserva parte.fecha salvo referencia temporal en el mensaje actual" in prompt
    assert "no exige otro set_fecha" in prompt
    assert "Tiempos verbales como" in prompt


@pytest.mark.asyncio
async def test_cierre_prompt_reserves_exact_save_close_commands():
    chat = FakeChatClient()
    client = ParteDiarioLLMClient(chat_client=chat).for_stage("cierre")

    await client.interpret_turn(
        "agrega vera 4 hs",
        ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-05-29"),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    assert "Etapa actual: cierre." in prompt
    assert "1 o GUARDAR: finaliza la carga y sale del proceso" in prompt
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
        ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-08-01"),
        [],
        [],
    )

    prompt = chat.calls[0]["system_prompt"]
    response_schema = chat.calls[0]["response_format"]["json_schema"]["schema"]
    assert "Usa finish_loading solo cuando se entiende que el usuario termino la carga" in prompt
    assert "sin_novedades declara ausencia de novedades" in prompt
    assert "Esto no aplica a una accion ya definida" in prompt
    assert 'backend_action="ask_clarification"' in prompt
    assert "No uses una lista de frases" in prompt
    assert "Contrato de decision del turno (prioritario)" in prompt
    assert "Entender o aceptar una orden no equivale a ejecutarla" in prompt
    assert "El rechazo actual prevalece sobre la solicitud anterior" in prompt
    assert "No exijas que el mensaje actual vuelva a nombrarlos" in prompt
    assert "El alcance de busqueda no reemplaza el filtro" in prompt
    assert "fuera_de_proyecto=true" in prompt
    assert "nombre_proyecto" in prompt
    assert "No apliques defaults ni sumes extras" in prompt
    assert response_schema["required"] == [
        "message_kind",
        "command_action",
        "backend_action",
        "operations",
        "reply",
        "alcance",
    ]
    operation_schema = response_schema["properties"]["operations"]["items"]
    assert "alcance" in operation_schema["properties"]
    assert "alcance" in operation_schema["required"]
    assert "fuera_de_proyecto" in operation_schema["properties"]
    assert "fuera_de_proyecto" in operation_schema["required"]
    assert "nombre_proyecto" in operation_schema["properties"]
    assert "nombre_proyecto" in operation_schema["required"]


def test_parse_turn_plan_preserves_external_project_fields():
    plan = _parse_turn_plan(
        {
            "message_kind": "novedad",
            "command_action": "none",
            "backend_action": "add_novelty",
            "operations": [
                {
                    "type": "agregar_novedad",
                    "nombre": "Perez",
                    "alcance": None,
                    "estado_codigo": "P",
                    "horas": None,
                    "horas_extra": None,
                    "descripcion": None,
                    "fuera_de_proyecto": True,
                    "nombre_proyecto": "Francia 118",
                    "fecha": None,
                    "requested": None,
                    "reply": None,
                }
            ],
            "reply": None,
        }
    )

    assert plan.operations[0].fuera_de_proyecto is True
    assert plan.operations[0].nombre_proyecto == "Francia 118"


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


def test_parse_turn_plan_maps_no_novelty_backend_action_to_operation():
    plan = _parse_turn_plan(
        {
            "message_kind": "comando",
            "command_action": "none",
            "backend_action": "sin_novedades",
            "operations": [],
            "reply": None,
        }
    )

    assert [operation.type for operation in plan.operations] == ["sin_novedades"]


# Rechazar una propuesta retoma el modo de carga sin cambios ni revision.
@pytest.mark.parametrize("operations", [[], [{"type": "retomar_carga"}]])
def test_parse_turn_plan_retoma_carga_sin_duplicar(operations):
    plan = _parse_turn_plan({"backend_action": "resume_loading", "operations": operations})
    assert [op.type for op in plan.operations] == ["retomar_carga"]


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
