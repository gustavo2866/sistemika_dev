"""
Tests unitarios de los modulos nuevos del core v2:
  - agente.v2.core.context   (MessageInfo, TurnContext)
  - agente.v2.core.process   (TurnResult, ProcessRegistry)
  - agente.v2.core.state     (ConversationState, JsonConversationStateStore)
"""
from __future__ import annotations

import json
import textwrap
from pathlib import Path
from typing import Any

import pytest

from agente.v2.core.context import MessageInfo, TurnContext
from agente.v2.core.process import ProcessRegistry, TurnResult
from agente.v2.core.state import ConversationState, JsonConversationStateStore


# ---------------------------------------------------------------------------
# Helpers compartidos
# ---------------------------------------------------------------------------

def _make_state(oportunidad_id: int = 1, **kwargs) -> ConversationState:
    return ConversationState(oportunidad_id=oportunidad_id, **kwargs)


def _make_message(id: int = 1, contenido: str = "Hola", tipo: str = "entrada") -> MessageInfo:
    return MessageInfo(id=id, contenido=contenido, tipo=tipo, canal="whatsapp", estado="recibido", fecha="2026-01-01T00:00:00+00:00")


def _make_context(
    *,
    oportunidad_id: int = 1,
    active_process: str | None = None,
    process_state: dict | None = None,
    is_project: bool = True,
    message: MessageInfo | None = None,
) -> TurnContext:
    state = _make_state(oportunidad_id=oportunidad_id, active_process=active_process, process_state=process_state or {})
    return TurnContext(
        oportunidad_id=oportunidad_id,
        contacto_id=10,
        canal="whatsapp",
        trigger="webhook",
        message=message or _make_message(),
        history=[],
        conversation_state=state,
        is_project=is_project,
    )


class _FakeProcess:
    def __init__(self, name: str, fixed_priority: int | None) -> None:
        self.name = name
        self._priority = fixed_priority

    def priority(self, ctx: TurnContext) -> int | None:
        return self._priority

    def handle(self, ctx: TurnContext) -> TurnResult:
        return TurnResult(payload={"process": self.name}, keep_active=True)


# ===========================================================================
# MessageInfo
# ===========================================================================

class TestMessageInfo:
    def test_to_prompt_dict_contains_all_fields(self):
        msg = MessageInfo(id=5, contenido="Hola", tipo="entrada", canal="whatsapp", estado="recibido", fecha="2026-01-01")
        d = msg.to_prompt_dict()
        assert d["id"] == 5
        assert d["contenido"] == "Hola"
        assert d["tipo"] == "entrada"
        assert d["canal"] == "whatsapp"
        assert d["estado"] == "recibido"
        assert d["fecha"] == "2026-01-01"

    def test_canal_y_estado_son_opcionales(self):
        msg = MessageInfo(id=1, contenido="x", tipo="salida")
        assert msg.canal is None
        assert msg.estado is None

    def test_to_prompt_dict_con_campos_nulos(self):
        msg = MessageInfo(id=2, contenido="y", tipo="salida")
        d = msg.to_prompt_dict()
        assert d["canal"] is None
        assert d["estado"] is None


# ===========================================================================
# TurnContext
# ===========================================================================

class TestTurnContext:
    def test_active_process_delega_al_estado(self):
        ctx = _make_context(active_process="solicitud_materiales")
        assert ctx.active_process == "solicitud_materiales"

    def test_active_process_none_cuando_no_hay_proceso(self):
        ctx = _make_context(active_process=None)
        assert ctx.active_process is None

    def test_process_state_delega_al_estado(self):
        ps = {"pending_query": {"attribute_name": "tipo"}}
        ctx = _make_context(process_state=ps)
        assert ctx.process_state == ps

    def test_process_state_vacio_por_defecto(self):
        ctx = _make_context()
        assert ctx.process_state == {}

    def test_is_project_false(self):
        ctx = _make_context(is_project=False)
        assert ctx.is_project is False

    def test_is_project_true(self):
        ctx = _make_context(is_project=True)
        assert ctx.is_project is True


# ===========================================================================
# TurnResult
# ===========================================================================

class TestTurnResult:
    def test_valores_por_defecto(self):
        r = TurnResult(payload={"type": "chat_reply"})
        assert r.keep_active is True
        assert r.process_state == {}

    def test_keep_active_false(self):
        r = TurnResult(payload={}, keep_active=False)
        assert r.keep_active is False

    def test_process_state_se_almacena(self):
        ps = {"foo": "bar"}
        r = TurnResult(payload={}, process_state=ps)
        assert r.process_state == ps


# ===========================================================================
# ProcessRegistry
# ===========================================================================

class TestProcessRegistry:
    def test_resolve_devuelve_none_con_lista_vacia(self):
        registry = ProcessRegistry([])
        ctx = _make_context()
        assert registry.resolve(ctx) is None

    def test_resolve_devuelve_proceso_con_mayor_prioridad(self):
        p_baja = _FakeProcess("baja", 10)
        p_alta = _FakeProcess("alta", 90)
        registry = ProcessRegistry([p_baja, p_alta])
        ctx = _make_context()
        assert registry.resolve(ctx).name == "alta"

    def test_resolve_devuelve_none_cuando_todos_retornan_none(self):
        p = _FakeProcess("sin_match", None)
        registry = ProcessRegistry([p])
        ctx = _make_context()
        assert registry.resolve(ctx) is None

    def test_proceso_activo_recibe_bonus_1000(self):
        # p_baja tiene prioridad 50, p_activo tiene 10 pero es el activo → 1010
        p_baja = _FakeProcess("baja", 50)
        p_activo = _FakeProcess("activo", 10)
        registry = ProcessRegistry([p_baja, p_activo])
        ctx = _make_context(active_process="activo")
        assert registry.resolve(ctx).name == "activo"

    def test_proceso_activo_sin_match_no_recibe_bonus(self):
        # active_process apunta a un proceso que retorna None
        p_sin_match = _FakeProcess("activo", None)
        p_normal = _FakeProcess("otro", 50)
        registry = ProcessRegistry([p_sin_match, p_normal])
        ctx = _make_context(active_process="activo")
        assert registry.resolve(ctx).name == "otro"

    def test_dos_procesos_igual_prioridad_elige_ultimo_en_gana(self):
        p1 = _FakeProcess("primero", 100)
        p2 = _FakeProcess("segundo", 100)
        registry = ProcessRegistry([p1, p2])
        ctx = _make_context()
        # El resultado es determinístico (dict insertion order), el último que gana
        result = registry.resolve(ctx)
        assert result is not None
        assert result.name in ("primero", "segundo")


# ===========================================================================
# ConversationState
# ===========================================================================

class TestConversationState:
    def test_empty_crea_estado_limpio(self):
        state = ConversationState.empty(42)
        assert state.oportunidad_id == 42
        assert state.active_process is None
        assert state.process_state == {}
        assert state.last_message_id is None
        assert state.version == 1

    def test_to_dict_roundtrip(self):
        state = ConversationState(
            oportunidad_id=7,
            active_process="solicitud_materiales",
            process_state={"k": "v"},
            last_message_id=99,
            last_outbound_message_id=100,
            version=3,
        )
        d = state.to_dict()
        reconstructed = ConversationState.from_dict(d, oportunidad_id=7)
        assert reconstructed.oportunidad_id == 7
        assert reconstructed.active_process == "solicitud_materiales"
        assert reconstructed.process_state == {"k": "v"}
        assert reconstructed.last_message_id == 99
        assert reconstructed.last_outbound_message_id == 100
        assert reconstructed.version == 3

    def test_from_dict_none_devuelve_estado_vacio(self):
        state = ConversationState.from_dict(None, oportunidad_id=5)
        assert state.oportunidad_id == 5
        assert state.active_process is None

    def test_from_dict_formato_antiguo(self):
        """Compatibilidad con el formato previo a la simplificacion del core."""
        viejo = {
            "scope_id": 3,
            "active_process": "solicitud_materiales",
            "process_states": {
                "solicitud_materiales": {"pending_query": {"attribute_name": "tipo"}}
            },
            "last_processed_message_id": 55,
        }
        state = ConversationState.from_dict(viejo, oportunidad_id=3)
        assert state.oportunidad_id == 3
        assert state.active_process == "solicitud_materiales"
        assert state.process_state == {"pending_query": {"attribute_name": "tipo"}}
        assert state.last_message_id == 55

    def test_from_dict_formato_antiguo_sin_proceso_activo(self):
        viejo = {"scope_id": 8, "process_states": {}, "last_processed_message_id": None}
        state = ConversationState.from_dict(viejo, oportunidad_id=8)
        assert state.active_process is None
        assert state.process_state == {}

    def test_from_dict_ignora_active_process_con_espacios(self):
        state = ConversationState.from_dict({"active_process": "  "}, oportunidad_id=1)
        assert state.active_process is None

    def test_version_minima_es_1(self):
        state = ConversationState.from_dict({"version": 0}, oportunidad_id=1)
        assert state.version == 1


# ===========================================================================
# JsonConversationStateStore
# ===========================================================================

class TestJsonConversationStateStore:
    def test_load_devuelve_estado_vacio_si_no_existe_archivo(self, tmp_path):
        store = JsonConversationStateStore(root_dir=tmp_path)
        state = store.load(99)
        assert state.oportunidad_id == 99
        assert state.active_process is None

    def test_save_y_load_roundtrip(self, tmp_path):
        store = JsonConversationStateStore(root_dir=tmp_path)
        state = ConversationState(oportunidad_id=1, active_process="proc_a", process_state={"x": 1})
        store.save(state)
        loaded = store.load(1)
        assert loaded.active_process == "proc_a"
        assert loaded.process_state == {"x": 1}

    def test_save_incrementa_version(self, tmp_path):
        store = JsonConversationStateStore(root_dir=tmp_path)
        s1 = ConversationState(oportunidad_id=1)
        store.save(s1)           # version 1 → guarda con version 2
        s2 = store.load(1)
        assert s2.version == 2
        store.save(s2)           # version 2 → guarda con version 3
        s3 = store.load(1)
        assert s3.version == 3

    def test_save_crea_directorio_si_no_existe(self, tmp_path):
        nested = tmp_path / "a" / "b" / "c"
        store = JsonConversationStateStore(root_dir=nested)
        state = ConversationState(oportunidad_id=2, active_process="p")
        store.save(state)
        assert nested.exists()
        assert store.load(2).active_process == "p"

    def test_load_json_invalido_lanza_value_error(self, tmp_path):
        store = JsonConversationStateStore(root_dir=tmp_path)
        (tmp_path / "oportunidad_7.json").write_text("esto no es json", encoding="utf-8")
        with pytest.raises(ValueError, match="invalido"):
            store.load(7)

    def test_load_json_no_dict_lanza_value_error(self, tmp_path):
        store = JsonConversationStateStore(root_dir=tmp_path)
        (tmp_path / "oportunidad_8.json").write_text("[1, 2, 3]", encoding="utf-8")
        with pytest.raises(ValueError, match="invalido"):
            store.load(8)

    def test_load_compatible_con_formato_antiguo_en_disco(self, tmp_path):
        viejo = {
            "scope_id": 10,
            "active_process": "solicitud_materiales",
            "process_states": {"solicitud_materiales": {"ready": True}},
            "last_processed_message_id": 77,
        }
        (tmp_path / "oportunidad_10.json").write_text(json.dumps(viejo), encoding="utf-8")
        store = JsonConversationStateStore(root_dir=tmp_path)
        state = store.load(10)
        assert state.active_process == "solicitud_materiales"
        assert state.process_state == {"ready": True}
        assert state.last_message_id == 77

    def test_save_escribe_json_valido_en_disco(self, tmp_path):
        store = JsonConversationStateStore(root_dir=tmp_path)
        state = ConversationState(oportunidad_id=3, active_process="x", process_state={"a": 1})
        store.save(state)
        raw = json.loads((tmp_path / "oportunidad_3.json").read_text(encoding="utf-8"))
        assert raw["active_process"] == "x"
        assert raw["process_state"] == {"a": 1}
        assert isinstance(raw["version"], int)

    def test_oportunidades_distintas_no_interfieren(self, tmp_path):
        store = JsonConversationStateStore(root_dir=tmp_path)
        store.save(ConversationState(oportunidad_id=1, active_process="p1"))
        store.save(ConversationState(oportunidad_id=2, active_process="p2"))
        assert store.load(1).active_process == "p1"
        assert store.load(2).active_process == "p2"
