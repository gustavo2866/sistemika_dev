"""
Tests de integración para los DB stores del agente v2.

Usan SQLite en memoria (misma DB que el resto del suite) — cubren exactamente
el código que corre en producción con Postgres.

El fixture `db_session` lo provee conftest.py (que también parchea JSONB→JSON
para SQLite).
"""
from __future__ import annotations

import pytest
from sqlmodel import Session

from agente.v2.core.state import ConversationState
from agente.v2.db.stores import DbConversationStateStore, DbProcessRequestStore
from agente.v2.processes.solicitud_materiales.models import MaterialItem, MaterialRequestState


def _make_request_state(
    oportunidad_id: int = 1,
    *,
    activa: bool = True,
    estado_solicitud: str = "draft",
    items: list[MaterialItem] | None = None,
    observaciones: list[str] | None = None,
) -> MaterialRequestState:
    """Crea un MaterialRequestState con objetos MaterialItem directamente (no via from_state_dict)."""
    return MaterialRequestState(
        oportunidad_id=oportunidad_id,
        activa=activa,
        estado_solicitud=estado_solicitud,
        items=items or [],
        observaciones=observaciones or [],
    )


# ===========================================================================
# DbConversationStateStore
# ===========================================================================

class TestDbConversationStateStore:

    def test_load_retorna_estado_vacio_si_no_existe(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        state = store.load(oportunidad_id=99)
        assert state.oportunidad_id == 99
        assert state.active_process is None
        assert state.process_state == {}

    def test_save_y_load_roundtrip(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        state = ConversationState(
            oportunidad_id=1,
            active_process="solicitud_materiales",
            process_state={"pending_query": {"item_id": "abc"}},
            last_message_id=42,
        )
        store.save(state)
        db_session.commit()

        loaded = store.load(oportunidad_id=1)
        assert loaded.active_process == "solicitud_materiales"
        assert loaded.process_state == {"pending_query": {"item_id": "abc"}}
        assert loaded.last_message_id == 42

    def test_save_incrementa_version(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        state = ConversationState(oportunidad_id=1)
        store.save(state)
        db_session.commit()
        assert state.version == 1

        state.active_process = "solicitud_materiales"
        store.save(state)
        db_session.commit()
        assert state.version == 2

    def test_save_actualiza_fila_existente(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        state = ConversationState(oportunidad_id=1, active_process="proceso_a")
        store.save(state)
        db_session.commit()

        state.active_process = "proceso_b"
        store.save(state)
        db_session.commit()

        loaded = store.load(oportunidad_id=1)
        assert loaded.active_process == "proceso_b"
        assert loaded.version == 2

    def test_oportunidades_distintas_no_interfieren(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        store.save(ConversationState(oportunidad_id=1, active_process="proc_a"))
        store.save(ConversationState(oportunidad_id=2, active_process="proc_b"))
        db_session.commit()

        assert store.load(1).active_process == "proc_a"
        assert store.load(2).active_process == "proc_b"

    def test_load_for_update_retorna_estado_vacio_si_no_existe(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        # SQLite no soporta FOR UPDATE pero el código debe funcionar igualmente
        state = store.load_for_update(oportunidad_id=99)
        assert state.oportunidad_id == 99
        assert state.active_process is None

    def test_load_for_update_retorna_estado_guardado(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        store.save(ConversationState(oportunidad_id=5, active_process="mi_proceso", process_state={"x": 1}))
        db_session.commit()

        state = store.load_for_update(oportunidad_id=5)
        assert state.active_process == "mi_proceso"
        assert state.process_state == {"x": 1}

    def test_save_preserva_last_outbound_message_id(self, db_session: Session):
        store = DbConversationStateStore(db_session)
        state = ConversationState(oportunidad_id=1, last_outbound_message_id=100)
        store.save(state)
        db_session.commit()

        loaded = store.load(1)
        assert loaded.last_outbound_message_id == 100


# ===========================================================================
# DbProcessRequestStore
# ===========================================================================

class TestDbProcessRequestStore:

    def test_load_retorna_none_si_no_existe(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        result = store.load(oportunidad_id=99)
        assert result is None

    def test_load_active_retorna_none_si_no_existe(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        result = store.load_active(oportunidad_id=99)
        assert result is None

    def test_save_y_load_roundtrip(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        item = MaterialItem(
            item_id="item-1",
            descripcion="2 bolsas de cemento",
            cantidad=2,
            unidad="bolsa",
            familia="cementicios",
        )
        state = _make_request_state(oportunidad_id=1, items=[item])
        store.save(state, ultimo_mensaje_id=10)
        db_session.commit()

        loaded = store.load(oportunidad_id=1)
        assert loaded is not None
        assert loaded.activa is True
        assert loaded.estado_solicitud == "draft"
        assert len(loaded.items) == 1, f"Items esperados: 1, obtenidos: {loaded.items}"
        assert loaded.items[0].descripcion == "2 bolsas de cemento"
        assert loaded.items[0].cantidad == 2
        assert loaded.ultimo_mensaje_id == 10

    def test_save_incrementa_version(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        state = _make_request_state(oportunidad_id=1)
        store.save(state, ultimo_mensaje_id=1)
        db_session.commit()
        assert state.version == 1

        state.estado_solicitud = "needs_clarification"
        store.save(state, ultimo_mensaje_id=2)
        db_session.commit()
        assert state.version == 2

    def test_save_actualiza_fila_existente(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        state = _make_request_state(oportunidad_id=1)
        store.save(state, ultimo_mensaje_id=1)
        db_session.commit()

        state.estado_solicitud = "needs_clarification"
        state.items = [MaterialItem(item_id="x", descripcion="hierro", cantidad=4, unidad="barra", familia="acero_refuerzo")]
        store.save(state, ultimo_mensaje_id=2)
        db_session.commit()

        loaded = store.load(oportunidad_id=1)
        assert loaded.estado_solicitud == "needs_clarification"
        assert len(loaded.items) == 1
        assert loaded.items[0].descripcion == "hierro"

    def test_load_active_retorna_none_cuando_inactiva(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        state = _make_request_state(oportunidad_id=1, activa=False)  # activa=False keyword only
        store.save(state, ultimo_mensaje_id=1)
        db_session.commit()

        assert store.load_active(oportunidad_id=1) is None

    def test_load_active_retorna_state_cuando_activa(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        state = _make_request_state(oportunidad_id=1, activa=True)
        store.save(state, ultimo_mensaje_id=1)
        db_session.commit()

        loaded = store.load_active(oportunidad_id=1)
        assert loaded is not None
        assert loaded.activa is True

    def test_items_con_atributos_se_preservan(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        item = MaterialItem(
            item_id="item-abc",
            descripcion="barras hierro 12",
            cantidad=4,
            unidad="barra",
            familia="acero_refuerzo",
            atributos={"diametro_mm": 12, "largo_m": 6},
        )
        state = _make_request_state(oportunidad_id=1, items=[item])  # items keyword only
        store.save(state, ultimo_mensaje_id=5)
        db_session.commit()

        loaded = store.load(oportunidad_id=1)
        assert loaded.items[0].atributos["diametro_mm"] == 12
        assert loaded.items[0].atributos["largo_m"] == 6

    def test_observaciones_se_preservan(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        state = _make_request_state(oportunidad_id=1, observaciones=["Urgente", "Obra norte"])  # observaciones keyword only
        store.save(state, ultimo_mensaje_id=1)
        db_session.commit()

        loaded = store.load(oportunidad_id=1)
        assert loaded.observaciones == ["Urgente", "Obra norte"]

    def test_oportunidades_distintas_no_interfieren(self, db_session: Session):
        store = DbProcessRequestStore(db_session)
        state1 = _make_request_state(oportunidad_id=1, estado_solicitud="draft")  # keyword only
        state2 = _make_request_state(oportunidad_id=2, estado_solicitud="ready")  # keyword only
        store.save(state1, ultimo_mensaje_id=1)
        store.save(state2, ultimo_mensaje_id=2)
        db_session.commit()

        assert store.load(1).estado_solicitud == "draft"
        assert store.load(2).estado_solicitud == "ready"

    def test_created_at_se_preserva_en_updates(self, db_session: Session):
        """created_at no cambia en actualizaciones subsecuentes."""
        store = DbProcessRequestStore(db_session)
        state = _make_request_state(oportunidad_id=1)
        store.save(state, ultimo_mensaje_id=1)
        db_session.commit()
        # Normalizar quitando offset para comparar correctamente con SQLite
        # (SQLite no preserva timezone en datetimes)
        created_at_original = state.created_at.replace("+00:00", "")

        state.estado_solicitud = "ready"
        store.save(state, ultimo_mensaje_id=2)
        db_session.commit()

        assert state.created_at.replace("+00:00", "") == created_at_original
