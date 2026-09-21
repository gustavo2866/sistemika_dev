"""Vigencia diaria del contexto, independiente de las fechas del dominio."""

from datetime import datetime

import pytest

from agente.v3.contracts import V3ConversationContext
from agente.v3.orchestrator import context_store


# Reemplaza conversaciones de ayer aunque se actualizaran hoy o su parte sea de hoy.
@pytest.mark.asyncio
async def test_descarta_contexto_anterior_por_fecha_de_creacion(monkeypatch):
    now = datetime.fromisoformat("2026-09-12T12:00:00+00:00")
    monkeypatch.setattr(context_store, "utc_now", lambda: now)
    store = context_store.V3ContextStore()
    original = V3ConversationContext(
        conversation_id="conv", active_process="parteDiario",
        created_at=datetime.fromisoformat("2026-09-11T12:00:00+00:00"),
        process_state={"etapa": "revision", "parte_state": {"fecha": "2026-09-12"}},
        debug_timings={"anterior": 1}, last_inbound_message_id="old-in", last_outbound_message_id="old-out",
    )
    await store.save(original)
    assert original.updated_at == now
    current = await store.load_or_create("conv")
    assert current == V3ConversationContext(conversation_id="conv", created_at=now, updated_at=now)
    snapshot = await store.snapshot()
    assert snapshot["count"] == 1
    assert snapshot["contexts"][0]["process_state"] == {}
    assert original.process_state["etapa"] == "revision"


# Una conversacion de hoy mantiene el parte de un dia anterior sin reinterpretar su fecha.
@pytest.mark.asyncio
async def test_conserva_conversacion_de_hoy_con_parte_anterior(monkeypatch):
    now = datetime.fromisoformat("2026-09-12T15:00:00+00:00")
    monkeypatch.setattr(context_store, "utc_now", lambda: now)
    store = context_store.V3ContextStore()
    original = V3ConversationContext(
        conversation_id="conv", active_process="parteDiario",
        created_at=datetime.fromisoformat("2026-09-12T12:00:00+00:00"),
        process_state={"etapa": "carga", "parte_state": {"fecha": "2026-09-07"}},
    )
    await store.save(original)
    current = await store.load_or_create("conv")
    assert current == original
    assert current is not original


# El corte diario ocurre a medianoche de Buenos Aires, no a medianoche UTC.
@pytest.mark.asyncio
@pytest.mark.parametrize("created,now,expired", [
    ("2026-09-12T23:59:00+00:00", "2026-09-13T00:01:00+00:00", False),
    ("2026-09-13T02:59:00+00:00", "2026-09-13T03:00:00+00:00", True),
])
async def test_vencimiento_respeta_medianoche_local(monkeypatch, created, now, expired):
    instant = datetime.fromisoformat(now)
    monkeypatch.setattr(context_store, "utc_now", lambda: instant)
    store = context_store.V3ContextStore()
    original = V3ConversationContext(
        conversation_id="conv", active_process="pedidoObra",
        created_at=datetime.fromisoformat(created), process_state={"etapa": "carga"},
    )
    await store.save(original)
    current = await store.load_or_create("conv")
    assert (current.active_process is None) == expired
    assert current.created_at == (instant if expired else original.created_at)


# Un contexto nuevo toma la fecha real una sola vez y se conserva en lecturas sucesivas.
@pytest.mark.asyncio
async def test_crea_y_recupera_contexto_del_dia(monkeypatch):
    now = datetime.fromisoformat("2026-09-12T12:00:00+00:00")
    monkeypatch.setattr(context_store, "utc_now", lambda: now)
    store = context_store.V3ContextStore()
    first = await store.load_or_create("conv")
    second = await store.load_or_create("conv")
    assert first.created_at == first.updated_at == now
    assert first == second
    assert first is not second
