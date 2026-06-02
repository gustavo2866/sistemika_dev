"""Tests unitarios del proceso pedido_obra nuevo."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agente.v2.processes.pedido_obra.executor import execute_plan
from agente.v2.processes.pedido_obra.handler import PedidoObraProcess, _build_turn_result
from agente.v2.processes.pedido_obra.llm_client import PROMPTS_DIR, TURN_PLAN_RESPONSE_FORMAT, PedidoObraLLMClient
from agente.v2.processes.pedido_obra.models import (
    OperationItem,
    PedidoItem,
    PedidoOperation,
    PedidoState,
    TurnPlan,
)


def _ctx(*, texto: str = "mensaje", state: dict | None = None, is_project: bool = True):
    return SimpleNamespace(
        oportunidad_id=1,
        is_project=is_project,
        active_process=None,
        process_state=state or {},
        message=SimpleNamespace(contenido=texto),
    )


class TestPedidoState:
    def test_roundtrip(self):
        state = PedidoState(
            oportunidad_id=42,
            etapa="carga",
            items=[
                PedidoItem(descripcion="cemento", cantidad=5.0, unidad="bolsas", item_id="aaa"),
                PedidoItem(descripcion="arena", cantidad=None, unidad="m3", item_id="bbb"),
            ],
        )

        loaded = PedidoState.from_dict(state.to_dict())

        assert loaded.oportunidad_id == 42
        assert loaded.etapa == "carga"
        assert loaded.items[0].cantidad == 5.0
        assert loaded.items[1].cantidad is None

    def test_prompt_dict_includes_pending_item(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="cantidad_faltante",
            item_cantidad_idx=0,
            items=[PedidoItem(descripcion="puertas", item_id="p1")],
        )

        payload = state.to_prompt_dict()

        assert payload["pending_item"]["id"] == "p1"
        assert payload["pending_item"]["descripcion"] == "puertas"

    def test_resumen_items_formats_numbers(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=5.0, unidad="bolsas")],
        )

        assert "5 bolsas cemento" in state.resumen_items()
        assert "5.0" not in state.resumen_items()


class TestLLMParsing:
    def test_parse_turn_plan_operations(self):
        client = PedidoObraLLMClient(api_key="test")

        plan = client._parse_turn_plan(
            {
                "operations": [
                    {
                        "type": "add_items",
                        "items": [
                            {"descripcion": "puertas", "cantidad": 2},
                            {"descripcion": "ventanas", "cantidad": 4},
                        ],
                    },
                    {
                        "type": "update_item",
                        "target_item_id": "abc",
                        "cantidad": 5,
                        "unidad": "litros",
                    },
                ]
            }
        )

        assert len(plan.operations) == 2
        assert plan.operations[0].items[0].descripcion == "puertas"
        assert plan.operations[1].target_item_id == "abc"
        assert plan.operations[1].cantidad == 5.0

    def test_parse_requires_operations_contract(self):
        client = PedidoObraLLMClient(api_key="test")

        plan = client._parse_turn_plan({"intent": "finish_order"})

        assert plan.operations == []
        assert plan.raw_response == {"intent": "finish_order"}

    @pytest.mark.asyncio
    async def test_interpret_turn_does_not_apply_local_fallback_for_listo(self):
        client = PedidoObraLLMClient(api_key="test")
        client._call = AsyncMock(return_value={"reply": "ok"})  # type: ignore[method-assign]

        plan = await client.interpret_turn(
            "listo",
            PedidoState(
                oportunidad_id=1,
                etapa="carga",
                items=[PedidoItem(descripcion="cemento", cantidad=10)],
            ),
        )

        assert plan.operations == []
        assert plan.reply == "ok"

    def test_prompt_maps_natural_closing_phrases_to_finish_order(self):
        prompt = (PROMPTS_DIR / "interpretar_turno.txt").read_text(encoding="utf-8")

        assert "no quiero mas nada" in prompt
        assert "terminar pedido" in prompt
        assert "finish_order" in prompt
        assert "No lo clasifiques como saludo, agradecimiento u offtopic." in prompt

    def test_prompt_blocks_other_process_even_when_order_has_no_items(self):
        prompt = (PROMPTS_DIR / "interpretar_turno.txt").read_text(encoding="utf-8")

        assert "Durante cualquier etapa del pedido abierto" in prompt
        assert "pedido todavia no" in prompt
        assert "tiene materiales cargados" in prompt

    def test_llm_schema_does_not_expose_terminal_backend_operations(self):
        operation_types = TURN_PLAN_RESPONSE_FORMAT["json_schema"]["schema"]["properties"]["operations"]["items"][
            "properties"
        ]["type"]["enum"]

        assert "confirm_order" not in operation_types
        assert "cancel_order" not in operation_types
        assert "solicitar_confirmacion" in operation_types
        assert "solicitar_cancelacion" in operation_types


class TestExecutor:
    def test_adds_multiple_items_from_llm_plan(self):
        state = PedidoState.empty(1)
        plan = TurnPlan(
            operations=[
                PedidoOperation(
                    type="add_items",
                    items=[
                        OperationItem(descripcion="puertas", cantidad=2),
                        OperationItem(descripcion="ventanas", cantidad=4),
                        OperationItem(descripcion="palas", cantidad=2),
                    ],
                )
            ]
        )

        result = execute_plan(state, plan)

        assert result.status == "updated"
        assert [item.descripcion for item in result.next_state.items] == ["puertas", "ventanas", "palas"]
        assert result.next_state.etapa == "carga"
        assert "actualizado" in result.reply.lower()
        assert "escribi LISTO" in result.reply
        assert "escribi listo" not in result.reply

    def test_add_items_sums_existing_material_with_same_unit(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=30, unidad="bolsas")],
        )

        result = execute_plan(
            state,
            TurnPlan(
                operations=[
                    PedidoOperation(
                        type="add_items",
                        items=[OperationItem(descripcion="cemento", cantidad=10, unidad="bolsas")],
                    )
                ]
            ),
        )

        assert len(result.next_state.items) == 1
        assert result.next_state.items[0].cantidad == 40
        assert result.next_state.items[0].unidad == "bolsas"

    def test_add_items_infers_unit_and_sums_existing_material(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=30, unidad="bolsas")],
        )

        result = execute_plan(
            state,
            TurnPlan(
                operations=[
                    PedidoOperation(
                        type="add_items",
                        items=[OperationItem(descripcion="bolsas de cemento", cantidad=10)],
                    )
                ]
            ),
        )

        assert len(result.next_state.items) == 1
        assert result.next_state.items[0].cantidad == 40
        assert result.next_state.items[0].descripcion == "cemento"

    def test_add_items_sums_more_specific_existing_material(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="pintura de 20lts", cantidad=8, unidad="latas")],
        )

        result = execute_plan(
            state,
            TurnPlan(
                operations=[
                    PedidoOperation(
                        type="add_items",
                        items=[OperationItem(descripcion="pintura", cantidad=4, unidad="latas")],
                    )
                ]
            ),
        )

        assert len(result.next_state.items) == 1
        assert result.next_state.items[0].cantidad == 12
        assert result.next_state.items[0].descripcion == "pintura de 20lts"

    def test_finish_order_asks_missing_quantities_only_at_close(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="puertas", item_id="p1")],
        )

        result = execute_plan(state, TurnPlan(operations=[PedidoOperation(type="finish_order")]))

        assert result.status == "missing_quantity"
        assert result.next_state.esperando == "cantidad_faltante"
        assert result.next_state.item_cantidad_idx == 0
        assert result.reply == "Que cantidad de puertas necesitas?"
        assert "Antes de cerrar" not in result.reply

    def test_answer_missing_quantity_moves_to_confirmation(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="cantidad_faltante",
            item_cantidad_idx=0,
            items=[PedidoItem(descripcion="puertas", item_id="p1")],
        )

        result = execute_plan(
            state,
            TurnPlan(operations=[PedidoOperation(type="answer_missing_quantity", cantidad=2)]),
        )

        assert result.status == "ready_for_confirmation"
        assert result.next_state.items[0].cantidad == 2
        assert result.next_state.esperando == "confirmacion_cierre"
        assert result.reply.endswith("Para enviarlo, responde CONFIRMAR.")
        assert "Tambien podes decirme que cambiar" not in result.reply

    def test_confirm_order_finalizes_when_complete(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="confirmacion_cierre",
            items=[PedidoItem(descripcion="puertas", cantidad=2, item_id="p1")],
        )

        result = execute_plan(state, TurnPlan(operations=[PedidoOperation(type="confirm_order")]))

        assert result.status == "confirmed"
        assert result.pedido_listo
        assert not result.keep_active
        assert result.next_state.etapa == "finalizado"
        assert result.reply.startswith("*PEDIDO CONFIRMADO*")
        assert result.reply.endswith("2 puertas")
        assert "Lo vamos a gestionar" not in result.reply
        assert "Si necesitas hacer otro pedido" not in result.reply

    def test_confirm_order_is_blocked_before_confirmation(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="puertas", cantidad=2, item_id="p1")],
        )

        result = execute_plan(state, TurnPlan(operations=[PedidoOperation(type="confirm_order")]))

        assert result.status == "blocked"
        assert result.keep_active
        assert result.next_state.etapa == "carga"

    def test_solicitar_cancelacion_preserves_open_order(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="puertas", cantidad=2, item_id="p1")],
        )

        result = execute_plan(state, TurnPlan(operations=[PedidoOperation(type="solicitar_cancelacion")]))

        assert result.status == "cancel_confirmation_required"
        assert result.keep_active
        assert result.next_state.items[0].descripcion == "puertas"
        assert result.reply.endswith("responde CANCELAR.")

    def test_request_other_process_preserves_open_order(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="puertas", cantidad=2, item_id="p1")],
        )

        result = execute_plan(state, TurnPlan(operations=[PedidoOperation(type="request_other_process")]))

        assert result.status == "other_process_blocked"
        assert result.keep_active
        assert result.next_state.items[0].descripcion == "puertas"
        assert "pedido de materiales abierto" in result.reply

    def test_update_uses_target_item_id(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="pintura", cantidad=3, unidad="latas", item_id="p1")],
        )

        result = execute_plan(
            state,
            TurnPlan(
                operations=[
                    PedidoOperation(
                        type="update_item",
                        target_item_id="p1",
                        cantidad=5,
                        unidad="litros",
                    )
                ]
            ),
        )

        assert result.next_state.items[0].cantidad == 5
        assert result.next_state.items[0].unidad == "litros"

    def test_start_new_order_can_add_items_in_same_turn(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            esperando="decision_pedido_previo",
            items=[PedidoItem(descripcion="tejas", cantidad=200, item_id="old")],
        )

        result = execute_plan(
            state,
            TurnPlan(
                operations=[
                    PedidoOperation(type="start_new_order"),
                    PedidoOperation(type="add_items", items=[OperationItem(descripcion="palas", cantidad=2)]),
                ]
            ),
        )

        assert [item.descripcion for item in result.next_state.items] == ["palas"]
        assert result.next_state.esperando is None

    def test_show_stale_order_uses_previous_order_text(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            esperando="decision_pedido_previo",
            items=[PedidoItem(descripcion="tejas", cantidad=200)],
        )

        result = execute_plan(state, TurnPlan(operations=[PedidoOperation(type="show_order")]))

        assert "pedido previo" in result.reply.lower()
        assert "continuar" in result.reply.lower()

    def test_offtopic_greeting_uses_llm_reply(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=20, unidad="bolsas")],
        )

        result = execute_plan(
            state,
            TurnPlan(
                operations=[
                    PedidoOperation(
                        type="offtopic",
                        reply="Hola, todo bien. Decime que materiales necesitas o escribi LISTO para cerrar el pedido.",
                    )
                ]
            ),
        )

        assert result.status == "offtopic"
        assert result.reply.startswith("Hola")
        assert "No entendi" not in result.reply
        assert "Pedido abierto:" in result.reply
        assert "20 bolsas cemento" in result.reply

    def test_offtopic_without_items_default_asks_for_materials(self):
        state = PedidoState(oportunidad_id=1, etapa="inicial")

        result = execute_plan(
            state,
            TurnPlan(operations=[PedidoOperation(type="offtopic")]),
        )

        assert result.status == "offtopic"
        assert result.reply == "Decime que materiales necesitas."
        assert "LISTO" not in result.reply


class TestHandler:
    def test_priority_accepts_all_project_turns(self):
        process = PedidoObraProcess()

        assert process.priority(_ctx(texto="hola", is_project=True)) == 50
        assert process.priority(_ctx(texto="hola", is_project=False)) is None

    @pytest.mark.asyncio
    async def test_handle_uses_single_llm_interpretation(self):
        llm = SimpleNamespace(
            interpret_turn=AsyncMock(
                return_value=TurnPlan(
                    operations=[
                        PedidoOperation(
                            type="add_items",
                            items=[OperationItem(descripcion="cemento", cantidad=5, unidad="bolsas")],
                        )
                    ]
                )
            )
        )
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="5 bolsas cemento"))

        llm.interpret_turn.assert_awaited_once()
        assert result.keep_active
        assert result.payload["items"][0]["descripcion"] == "cemento"
        assert result.payload["pedido_obra"]["operations"] == ["add_items"]

    @pytest.mark.asyncio
    async def test_handle_answers_missing_quantity_number_without_llm(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="cantidad_faltante",
            item_cantidad_idx=0,
            items=[PedidoItem(descripcion="puertas", item_id="p1")],
        )
        llm = SimpleNamespace(interpret_turn=AsyncMock())
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="2", state=state.to_dict()))

        llm.interpret_turn.assert_not_awaited()
        assert result.payload["items"][0]["cantidad"] == 2
        assert result.payload["esperando"] == "confirmacion_cierre"
        assert result.payload["pedido_obra"]["fast_path"] == "missing_quantity_number"
        assert result.payload["pedido_obra"]["llm_ms"] == 0

    @pytest.mark.asyncio
    async def test_handle_answers_missing_quantity_words_without_llm(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="cantidad_faltante",
            item_cantidad_idx=0,
            items=[PedidoItem(descripcion="bolsas cemento", item_id="p1")],
        )
        llm = SimpleNamespace(interpret_turn=AsyncMock())
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="treinta y cinco", state=state.to_dict()))

        llm.interpret_turn.assert_not_awaited()
        assert result.payload["items"][0]["cantidad"] == 35
        assert result.payload["pedido_obra"]["fast_path"] == "missing_quantity_number"

    @pytest.mark.asyncio
    async def test_handle_listo_finishes_order_without_llm(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=10, unidad="bolsas")],
        )
        llm = SimpleNamespace(interpret_turn=AsyncMock())
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="Listo", state=state.to_dict()))

        llm.interpret_turn.assert_not_awaited()
        assert result.keep_active
        assert result.payload["esperando"] == "confirmacion_cierre"
        assert result.payload["pedido_obra"]["operations"] == ["finish_order"]
        assert result.payload["pedido_obra"]["llm_operations"] == ["finish_order"]
        assert result.payload["pedido_obra"]["fast_path"] == "command_finish_order"
        assert result.payload["reply_to_user"].endswith("Para enviarlo, responde CONFIRMAR.")

    @pytest.mark.asyncio
    async def test_handle_confirmar_before_confirmation_finishes_order_without_llm(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=10, unidad="bolsas")],
        )
        llm = SimpleNamespace(interpret_turn=AsyncMock())
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="Confirmar", state=state.to_dict()))

        llm.interpret_turn.assert_not_awaited()
        assert result.keep_active
        assert result.payload["esperando"] == "confirmacion_cierre"
        assert result.payload["pedido_obra"]["operations"] == ["finish_order"]
        assert result.payload["pedido_obra"]["fast_path"] == "command_finish_order"

    @pytest.mark.asyncio
    async def test_handle_orphan_confirmar_does_not_finish_empty_order(self):
        llm = SimpleNamespace(
            interpret_turn=AsyncMock(
                return_value=TurnPlan(
                    operations=[PedidoOperation(type="offtopic", reply="No hay un pedido activo.")],
                )
            )
        )
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="Confirmar"))

        llm.interpret_turn.assert_awaited_once()
        assert result.payload["reply_to_user"] == "No hay un pedido activo."
        assert result.payload["pedido_obra"]["operations"] == ["offtopic"]

    @pytest.mark.asyncio
    async def test_handle_confirmar_in_confirmation_confirms_order_without_llm(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="confirmacion_cierre",
            items=[PedidoItem(descripcion="cemento", cantidad=10, unidad="bolsas")],
        )
        llm = SimpleNamespace(interpret_turn=AsyncMock())
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="Confirmar", state=state.to_dict()))

        llm.interpret_turn.assert_not_awaited()
        assert not result.keep_active
        assert result.payload["pedido_listo"]
        assert result.payload["etapa"] == "finalizado"
        assert result.payload["pedido_obra"]["operations"] == ["confirm_order"]
        assert result.payload["pedido_obra"]["fast_path"] == "command_confirm_order"

    @pytest.mark.asyncio
    async def test_handle_cancelar_cancels_during_missing_quantity_without_llm(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="cantidad_faltante",
            item_cantidad_idx=0,
            items=[PedidoItem(descripcion="cemento", item_id="p1")],
        )
        llm = SimpleNamespace(interpret_turn=AsyncMock())
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="Cancelar", state=state.to_dict()))

        llm.interpret_turn.assert_not_awaited()
        assert not result.keep_active
        assert result.payload["etapa"] == "finalizado"
        assert result.payload["pedido_obra"]["operations"] == ["cancel_order"]
        assert result.payload["pedido_obra"]["fast_path"] == "command_cancel_order"

    @pytest.mark.asyncio
    async def test_handle_informal_confirmation_does_not_materialize_order(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="confirmacion_cierre",
            items=[PedidoItem(descripcion="cemento", cantidad=10, unidad="bolsas")],
        )
        llm = SimpleNamespace(
            interpret_turn=AsyncMock(return_value=TurnPlan(operations=[PedidoOperation(type="confirm_order")]))
        )
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="Ok, mandalo", state=state.to_dict()))

        llm.interpret_turn.assert_awaited_once()
        assert result.keep_active
        assert not result.payload["pedido_listo"]
        assert result.payload["esperando"] == "confirmacion_cierre"
        assert result.payload["pedido_obra"]["operations"] == ["solicitar_confirmacion"]
        assert result.payload["reply_to_user"].endswith("Para enviarlo, responde CONFIRMAR.")

    @pytest.mark.asyncio
    async def test_handle_missing_quantity_with_unit_still_uses_llm(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            esperando="cantidad_faltante",
            item_cantidad_idx=0,
            items=[PedidoItem(descripcion="cemento", item_id="p1")],
        )
        llm = SimpleNamespace(
            interpret_turn=AsyncMock(
                return_value=TurnPlan(
                    operations=[PedidoOperation(type="answer_missing_quantity", cantidad=2, unidad="bolsas")]
                )
            )
        )
        process = PedidoObraProcess(llm_client=llm)

        result = await process.handle(_ctx(texto="2 bolsas", state=state.to_dict()))

        llm.interpret_turn.assert_awaited_once()
        assert result.payload["items"][0]["cantidad"] == 2
        assert result.payload["items"][0]["unidad"] == "bolsas"

    def test_turn_result_includes_items_and_metadata(self):
        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=5, unidad="bolsas")],
        )

        result = _build_turn_result(
            reply="ok",
            next_state=state,
            keep_active=True,
            ctx=_ctx(),
            metadata={"status": "updated", "operations": ["add_items"]},
        )

        assert result.payload["items"][0]["descripcion"] == "cemento"
        assert result.payload["pedido_obra"]["status"] == "updated"
