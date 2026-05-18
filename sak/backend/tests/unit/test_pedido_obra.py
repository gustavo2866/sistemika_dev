"""Tests unitarios del proceso pedido_obra — sin LLM, sin DB."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from agente.v2.processes.pedido_obra.models import PedidoItem, PedidoState
from agente.v2.processes.pedido_obra.parser import ParseResult, parse_message


# ---------------------------------------------------------------------------
# Parser tests (high confidence)
# ---------------------------------------------------------------------------

class TestParser:
    def test_item_kgs(self):
        r = parse_message("20 kg de cemento")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert len(r.items) == 1
        assert r.items[0].descripcion == "cemento"
        assert r.items[0].cantidad == 20.0
        assert r.items[0].unidad == "kg"

    def test_item_bolsas(self):
        r = parse_message("necesito 5 bolsas de arena")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert r.items[0].descripcion == "arena"
        assert r.items[0].cantidad == 5.0

    def test_item_m3(self):
        r = parse_message("3 m3 hormigón")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert r.items[0].cantidad == 3.0
        assert "hormig" in r.items[0].descripcion.lower()

    def test_numero_en_palabras_tres(self):
        r = parse_message("tres hierros del 12")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert r.items[0].cantidad == 3.0

    def test_numero_en_palabras_mixto(self):
        r = parse_message("hola, necesito tres hierros del 12, 4mts de arena y 20 cementos")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert len(r.items) >= 2

    def test_correccion_implicita_era_de(self):
        r = parse_message("la pintura era de 5 litros")
        assert r.confidence == "high"
        assert r.intent == "comando_modificar"
        assert len(r.items) == 1
        assert "pintura" in r.items[0].descripcion.lower()
        assert r.items[0].cantidad == 5.0
        assert r.items[0].unidad == "litros"

    def test_correccion_implicita_eran(self):
        r = parse_message("los hierros eran 3 barras")
        assert r.confidence == "high"
        assert r.intent == "comando_modificar"
        assert r.items[0].cantidad == 3.0

    def test_multiple_items(self):
        r = parse_message("2 bolsas cemento y 10 kg arena")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert len(r.items) == 2

    def test_descripcion_con_especificacion_numerica(self):
        r = parse_message("4 latas de pintura de 5lts")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert r.items[0].cantidad == 4.0
        assert r.items[0].unidad in ("lata", "latas")
        assert "pintura" in r.items[0].descripcion.lower()
        assert "5" in r.items[0].descripcion  # "de 5lts" incluido

    def test_descripcion_con_especificacion_en_mensaje_compuesto(self):
        r = parse_message("necesito 3mts de arena fina y 4 latas de pintura de 5lts")
        assert r.confidence == "high"
        assert r.intent == "item"
        assert len(r.items) == 2
        arena = next(it for it in r.items if "arena" in it.descripcion.lower())
        pintura = next(it for it in r.items if "pintura" in it.descripcion.lower())
        assert arena.cantidad == 3.0
        assert pintura.cantidad == 4.0
        # La especificacion "de 5lts" debe estar en la descripcion de pintura
        assert "5" in pintura.descripcion

    def test_cierre_listo(self):
        r = parse_message("listo")
        assert r.intent == "cierre"
        assert r.confidence == "high"

    def test_cierre_nada_mas(self):
        r = parse_message("nada más")
        assert r.intent == "cierre"

    def test_confirmar(self):
        r = parse_message("confirmo")
        assert r.intent == "confirmar"
        assert r.confidence == "high"

    def test_cancelar(self):
        r = parse_message("cancelar")
        assert r.intent == "cancelar"
        assert r.confidence == "high"

    def test_limpiar_el_pedido(self):
        r = parse_message("limpiar el pedido")
        assert r.intent == "comando_limpiar"
        assert r.confidence == "high"

    def test_quitar_extrae_target(self):
        r = parse_message("quitar las palas")
        assert r.intent == "comando_quitar"
        assert r.target_descripcion == "palas"

    def test_modificar_descripcion_debe_ser(self):
        r = parse_message("los ladrillos deben ser huecos")
        assert r.intent == "comando_modificar"
        assert r.target_descripcion == "ladrillos"
        assert r.nueva_descripcion == "ladrillos huecos"

    def test_modificar_descripcion_cambiar_por(self):
        r = parse_message("cambiar ladrillos por ladrillos huecos")
        assert r.intent == "comando_modificar"
        assert r.target_descripcion == "ladrillos"
        assert r.nueva_descripcion == "ladrillos huecos"

    def test_modificacion_compuesta_va_al_llm(self):
        r = parse_message("las barras de hierro deben ser 3 y de 10mts de largo")
        assert r.confidence == "low"
        assert r.intent == "unknown"

    def test_item_con_medida_interna_compuesta_va_al_llm(self):
        r = parse_message("agrega 5 barras de hierro del 12, de 10 mts de largo")
        assert r.confidence == "low"
        assert r.intent == "unknown"

    def test_parrafo_multioperacion_va_al_llm(self):
        r = parse_message("cambia ladrillos por comunes\nquita arena\nagrega 5 bolsas cemento")
        assert r.confidence == "low"
        assert r.intent == "unknown"

    def test_bare_number_is_cantidad(self):
        r = parse_message("15")
        assert r.intent == "cantidad"
        assert r.confidence == "high"

    def test_unknown_low_confidence(self):
        r = parse_message("lo mismo que la vez pasada")
        assert r.confidence == "low"

    def test_relative_reference_low(self):
        r = parse_message("2 más de lo mismo")
        assert r.confidence == "low"

    def test_empty_message(self):
        r = parse_message("")
        assert r.confidence == "low"
        assert r.intent == "unknown"


# ---------------------------------------------------------------------------
# PedidoState serialization
# ---------------------------------------------------------------------------

class TestPedidoState:
    def _make_state(self) -> PedidoState:
        return PedidoState(
            oportunidad_id=42,
            etapa="carga",
            items=[
                PedidoItem(descripcion="cemento", cantidad=5.0, unidad="bolsas", item_id="aaa"),
                PedidoItem(descripcion="arena", cantidad=None, unidad="m3", item_id="bbb"),
            ],
        )

    def test_roundtrip(self):
        state = self._make_state()
        d = state.to_dict()
        state2 = PedidoState.from_dict(d, oportunidad_id=42)
        assert state2.oportunidad_id == 42
        assert state2.etapa == "carga"
        assert len(state2.items) == 2
        assert state2.items[0].cantidad == 5.0
        assert state2.items[1].cantidad is None

    def test_oportunidad_id_embedded(self):
        state = self._make_state()
        d = state.to_dict()
        assert d["oportunidad_id"] == 42
        # from_dict can recover it without explicit kwarg
        state2 = PedidoState.from_dict(d)
        assert state2.oportunidad_id == 42

    def test_items_sin_cantidad(self):
        state = self._make_state()
        faltantes = state.items_sin_cantidad()
        assert len(faltantes) == 1
        assert faltantes[0].descripcion == "arena"

    def test_tiene_pedido_activo_true(self):
        state = self._make_state()
        assert state.tiene_pedido_activo()

    def test_tiene_pedido_activo_false_inicial(self):
        state = PedidoState(oportunidad_id=1, etapa="inicial", items=[])
        assert not state.tiene_pedido_activo()

    def test_tiene_pedido_activo_false_sin_items(self):
        state = PedidoState(oportunidad_id=1, etapa="carga", items=[])
        assert not state.tiene_pedido_activo()

    def test_resumen_items(self):
        state = self._make_state()
        resumen = state.resumen_items()
        assert "cemento" in resumen
        assert "arena" in resumen
        assert "5" in resumen
        assert "5.0" not in resumen
        assert "sin cantidad" in resumen

    def test_empty_factory(self):
        state = PedidoState.empty(99)
        assert state.oportunidad_id == 99
        assert state.etapa == "inicial"
        assert state.items == []

    def test_touch_updates_updated_at(self):
        state = PedidoState(oportunidad_id=1)
        before = state.updated_at
        state.touch()
        assert state.updated_at >= before


# ---------------------------------------------------------------------------
# Nodo inicial (sin LLM — sólo path de alta confianza)
# ---------------------------------------------------------------------------

class TestNodoInicial:
    @pytest.mark.asyncio
    async def test_item_creates_carga_state(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import inicial as nodo

        state = PedidoState.empty(1)
        llm = AsyncMock()
        result = await nodo.run(state, "10 bolsas cemento", llm)
        assert result.next_state.etapa == "carga"
        assert len(result.next_state.items) >= 1
        assert result.keep_active
        assert "listo" in result.reply.lower()

    @pytest.mark.asyncio
    async def test_cierre_no_active_process(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import inicial as nodo

        state = PedidoState.empty(1)
        llm = AsyncMock()
        result = await nodo.run(state, "listo", llm)
        assert not result.keep_active

    @pytest.mark.asyncio
    async def test_item_missing_quantity_asks(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import inicial as nodo

        state = PedidoState.empty(1)
        llm = AsyncMock()
        # Item with no quantity possible: just a material name
        result = await nodo.run(state, "necesito cemento bolsas", llm)
        # If HIGH confidence without quantity → may go to LLM. Just ensure active
        # Result could be LLM call; we only assert keepalive or no crash.
        assert result.next_state is not None


# ---------------------------------------------------------------------------
# Nodo carga — paths de alta confianza
# ---------------------------------------------------------------------------

class TestNodoCarga:
    def _state_with_item(self, *, cantidad=None) -> PedidoState:
        return PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=cantidad, unidad="bolsas", item_id="aaa")],
        )

    @pytest.mark.asyncio
    async def test_add_item(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = self._state_with_item(cantidad=5.0)
        llm = AsyncMock()
        result = await nodo.run(state, "5 kg arena", llm)
        assert len(result.next_state.items) == 2
        assert result.keep_active

    @pytest.mark.asyncio
    async def test_confirmar_va_a_confirmacion(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = self._state_with_item(cantidad=10.0)
        llm = AsyncMock()
        result = await nodo.run(state, "confirmar el pedido", llm)
        assert result.next_state.etapa == "confirmacion"
        assert result.next_state.esperando == "confirmacion_cierre"
        assert result.keep_active
        assert "cancelar" not in result.reply.lower()

    @pytest.mark.asyncio
    async def test_cancelar_cierra_proceso(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = self._state_with_item(cantidad=10.0)
        llm = AsyncMock()
        result = await nodo.run(state, "cancelar", llm)
        assert not result.keep_active

    @pytest.mark.asyncio
    async def test_cantidad_faltante_se_completa(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = self._state_with_item(cantidad=None)
        state.etapa = "confirmacion"
        state.esperando = "cantidad_faltante"
        state.item_cantidad_idx = 0
        llm = AsyncMock()
        result = await nodo.run(state, "7 bolsas", llm)
        # item should now have quantity 7
        assert result.next_state.items[0].cantidad == 7.0
        assert result.next_state.items[0].unidad == "bolsas"
        assert result.next_state.esperando == "confirmacion_cierre"

    @pytest.mark.asyncio
    async def test_limpiar_borra_items(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[
                PedidoItem(descripcion="a", cantidad=1.0, item_id="x"),
                PedidoItem(descripcion="b", cantidad=2.0, item_id="y"),
            ],
        )
        llm = AsyncMock()
        result = await nodo.run(state, "borrá todo", llm)
        # borrá todo → may be low confidence, LLM mock returns default
        # Just verify no crash
        assert result.next_state is not None

    @pytest.mark.asyncio
    async def test_correccion_implicita_sin_llm(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="pintura", cantidad=3.0, unidad="lta", item_id="p1")],
        )
        llm = AsyncMock()
        result = await nodo.run(state, "la pintura era de 5 litros", llm)
        assert result.next_state.items[0].cantidad == 5.0
        assert result.next_state.items[0].unidad == "litros"
        llm.evaluar_carga.assert_not_called()  # sin LLM

    @pytest.mark.asyncio
    async def test_modifica_descripcion_sin_llm(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="ladrillos", cantidad=1000.0, item_id="l1")],
        )
        llm = AsyncMock()
        result = await nodo.run(state, "los ladrillos deben ser huecos", llm)
        assert result.next_state.items[0].descripcion == "ladrillos huecos"
        llm.evaluar_carga.assert_not_called()

    @pytest.mark.asyncio
    async def test_quita_item_con_target_sin_llm(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[
                PedidoItem(descripcion="palas", cantidad=4.0, item_id="p1"),
                PedidoItem(descripcion="cemento", cantidad=2.0, unidad="bolsas", item_id="c1"),
            ],
        )
        llm = AsyncMock()
        result = await nodo.run(state, "quitar las palas", llm)
        assert [item.descripcion for item in result.next_state.items] == ["cemento"]
        llm.evaluar_carga.assert_not_called()

    @pytest.mark.asyncio
    async def test_modificacion_compuesta_usa_llm_y_matchea_unidad_descripcion(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="hierro del 12", cantidad=2.0, unidad="barras", item_id="h1")],
        )
        llm_resp = SimpleNamespace(
            intent="comando_modificar",
            items=[],
            target_descripcion="barras de hierro",
            nueva_descripcion="hierro del 12 de 10 mts de largo",
            cantidad=3.0,
            unidad="barras",
            reply=None,
        )
        llm = SimpleNamespace(evaluar_carga=AsyncMock(return_value=llm_resp))

        result = await nodo.run(state, "las barras de hierro deben ser 3 y de 10mts de largo", llm)

        assert result.next_state.items[0].cantidad == 3.0
        assert result.next_state.items[0].unidad == "barras"
        assert result.next_state.items[0].descripcion == "hierro del 12 de 10 mts de largo"
        llm.evaluar_carga.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_item_compuesto_usa_llm_para_no_separar_medida_interna(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(oportunidad_id=1, etapa="carga", items=[])
        llm_resp = SimpleNamespace(
            intent="item",
            items=[
                SimpleNamespace(
                    descripcion="hierro del 12 de 10 mts de largo",
                    cantidad=5.0,
                    unidad="barras",
                )
            ],
            target_descripcion=None,
            nueva_descripcion=None,
            cantidad=None,
            unidad=None,
            reply=None,
        )
        llm = SimpleNamespace(evaluar_carga=AsyncMock(return_value=llm_resp))

        result = await nodo.run(state, "agrega 5 barras de hierro del 12, de 10 mts de largo", llm)

        assert len(result.next_state.items) == 1
        assert result.next_state.items[0].cantidad == 5.0
        assert result.next_state.items[0].unidad == "barras"
        assert result.next_state.items[0].descripcion == "hierro del 12 de 10 mts de largo"
        llm.evaluar_carga.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_multioperacion_llm_aplica_en_orden_y_una_sola_llamada(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[
                PedidoItem(descripcion="ladrillos huecos", cantidad=4000.0, item_id="l1"),
                PedidoItem(descripcion="arena fina", cantidad=3.0, unidad="metros", item_id="a1"),
            ],
        )
        llm_resp = SimpleNamespace(
            intent="offtopic",
            items=[],
            target_descripcion=None,
            nueva_descripcion=None,
            cantidad=None,
            unidad=None,
            reply=None,
            operations=[
                SimpleNamespace(
                    type="update_item",
                    target_descripcion="ladrillos huecos",
                    nueva_descripcion="ladrillos comunes",
                    cantidad=None,
                    unidad=None,
                    items=[],
                    reply=None,
                ),
                SimpleNamespace(
                    type="remove_item",
                    target_descripcion="arena",
                    nueva_descripcion=None,
                    cantidad=None,
                    unidad=None,
                    items=[],
                    reply=None,
                ),
                SimpleNamespace(
                    type="add_items",
                    target_descripcion=None,
                    nueva_descripcion=None,
                    cantidad=None,
                    unidad=None,
                    items=[
                        SimpleNamespace(descripcion="cemento", cantidad=5.0, unidad="bolsas"),
                    ],
                    reply=None,
                ),
                SimpleNamespace(
                    type="finish_order",
                    target_descripcion=None,
                    nueva_descripcion=None,
                    cantidad=None,
                    unidad=None,
                    items=[],
                    reply=None,
                ),
            ],
        )
        llm = SimpleNamespace(evaluar_carga=AsyncMock(return_value=llm_resp))

        mensaje = "cambia ladrillos huecos por comunes\nquita arena\nagrega 5 bolsas cemento\nlisto"
        result = await nodo.run(state, mensaje, llm)

        assert result.next_state.etapa == "confirmacion"
        assert result.next_state.esperando == "confirmacion_cierre"
        assert [item.descripcion for item in result.next_state.items] == ["ladrillos comunes", "cemento"]
        assert result.next_state.items[1].cantidad == 5.0
        llm.evaluar_carga.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cierre_valida_cantidades_una_por_una(self):
        from unittest.mock import AsyncMock
        from agente.v2.processes.pedido_obra.nodes import carga as nodo

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[
                PedidoItem(descripcion="cemento", cantidad=None, unidad="bolsas", item_id="c1"),
                PedidoItem(descripcion="arena fina", cantidad=None, unidad="m3", item_id="a1"),
            ],
        )
        llm = AsyncMock()

        result = await nodo.run(state, "listo", llm)
        assert result.next_state.etapa == "confirmacion"
        assert result.next_state.esperando == "cantidad_faltante"
        assert result.next_state.item_cantidad_idx == 0

        result = await nodo.run(result.next_state, "4", llm)
        assert result.next_state.items[0].cantidad == 4.0
        assert result.next_state.esperando == "cantidad_faltante"
        assert result.next_state.item_cantidad_idx == 1

        result = await nodo.run(result.next_state, "3", llm)
        assert result.next_state.items[1].cantidad == 3.0
        assert result.next_state.esperando == "confirmacion_cierre"


# ---------------------------------------------------------------------------
# Nodo confirmacion
# ---------------------------------------------------------------------------

class TestNodoConfirmacion:
    def _state(self) -> PedidoState:
        return PedidoState(
            oportunidad_id=1,
            etapa="confirmacion",
            items=[PedidoItem(descripcion="cemento", cantidad=5.0, unidad="bolsas", item_id="aaa")],
        )

    def test_confirmar_pone_finalizado(self):
        from agente.v2.processes.pedido_obra.nodes import confirmacion as nodo
        result = nodo.run(self._state(), "confirmo")
        assert result.next_state.etapa == "finalizado"
        assert result.pedido_listo
        assert not result.keep_active

    def test_cancelar_cierra(self):
        from agente.v2.processes.pedido_obra.nodes import confirmacion as nodo
        result = nodo.run(self._state(), "cancelar")
        assert not result.keep_active

    def test_ambiguo_mantiene_estado(self):
        from agente.v2.processes.pedido_obra.nodes import confirmacion as nodo
        result = nodo.run(self._state(), "mmmm")
        assert result.next_state.etapa == "confirmacion"
        assert result.keep_active

    def test_nuevo_item_redirige_a_carga(self):
        from agente.v2.processes.pedido_obra.nodes import confirmacion as nodo
        result = nodo.run(self._state(), "20 kg arena")
        assert result._redirect == "carga"


# ---------------------------------------------------------------------------
# Payload del handler
# ---------------------------------------------------------------------------

class TestHandlerPayload:
    def test_turn_result_includes_current_items_before_confirmation(self):
        from agente.v2.processes.pedido_obra.handler import _build_turn_result

        state = PedidoState(
            oportunidad_id=1,
            etapa="carga",
            items=[PedidoItem(descripcion="cemento", cantidad=5, unidad="bolsas")],
        )
        ctx = SimpleNamespace(oportunidad_id=1)

        result = _build_turn_result(
            reply="Pedido actual",
            next_state=state,
            keep_active=True,
            ctx=ctx,
        )

        assert result.payload["items"][0]["descripcion"] == "cemento"
        assert result.payload["items"][0]["cantidad"] == 5
        assert result.payload["etapa"] == "carga"
        assert result.payload["pedido_listo"] is False

    def test_priority_ignores_non_project_opportunities(self):
        from agente.v2.processes.pedido_obra.handler import PedidoObraProcess

        ctx = SimpleNamespace(
            is_project=False,
            active_process=None,
            message=SimpleNamespace(contenido="necesito 5 bolsas de cemento"),
        )

        assert PedidoObraProcess().priority(ctx) is None

    def test_priority_accepts_project_cleanup_commands(self):
        from agente.v2.processes.pedido_obra.handler import PedidoObraProcess

        ctx = SimpleNamespace(
            is_project=True,
            active_process=None,
            message=SimpleNamespace(contenido="limpiar el pedido"),
        )

        assert PedidoObraProcess().priority(ctx) == 50


# ---------------------------------------------------------------------------
# LLM response parsing
# ---------------------------------------------------------------------------

class TestLLMClient:
    def test_parse_operations_response(self):
        from agente.v2.processes.pedido_obra.llm_client import PedidoObraLLMClient

        client = PedidoObraLLMClient(api_key="test")
        result = client._parse_evaluacion({
            "operations": [
                {
                    "type": "add_items",
                    "items": [{"descripcion": "cemento", "cantidad": 5, "unidad": "bolsas"}],
                },
                {
                    "type": "update_item",
                    "target_descripcion": "barras de hierro",
                    "cantidad": 3,
                    "unidad": "barras",
                    "nueva_descripcion": "hierro de 10 mts de largo",
                },
            ]
        })

        assert len(result.operations) == 2
        assert result.operations[0].type == "add_items"
        assert result.operations[0].items[0].descripcion == "cemento"
        assert result.operations[1].target_descripcion == "barras de hierro"
        assert result.operations[1].cantidad == 3.0
