"""Apertura diaria anterior/hoy frente a la apertura de una fecha puntual."""

from datetime import date

import pytest
from sqlmodel import select

from agente.v3.contracts import V3ConversationContext
from agente.v3.subprocesses.parte_diario.utils import calendario
from agente.v3.subprocesses.parte_diario.domain import parte_diario
from app.models import EstadoParteDiario, ParteDiario, ParteDiarioDetalle, ParteDiarioEstado
from tests.unit.test_parte_diario_carga_flow import FakeLLM, datos, estado, plan, proceso
from tests.unit.test_parte_diario_handler_inicial import escenario
from tests.unit.test_parte_diario_revision_flow import turno


# Crea un parte persistido con una novedad para comprobar recuperacion y aislamiento.
def crear_parte(datos, session, fecha, empleado, estado_parte=EstadoParteDiario.BORRADOR):
    motivo = session.exec(select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "ENF")).one()
    parte = ParteDiario(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                        fecha=date.fromisoformat(fecha), estado=estado_parte)
    session.add(parte)
    session.flush()
    session.add(ParteDiarioDetalle(parte_diario_id=parte.id, idnomina=empleado.id,
                                  idestado=motivo.id, horas=0))
    session.commit()
    return parte


# El ciclo confirma el anterior, recupera hoy sin mezclar novedades y termina al guardar hoy.
@pytest.mark.asyncio
@pytest.mark.parametrize("hoy,anterior", [("2026-09-12", "2026-09-11"), ("2026-09-14", "2026-09-12")])
async def test_ciclo_diario_recupera_anterior_y_hoy(datos, db_session, monkeypatch, hoy, anterior):
    monkeypatch.setattr(calendario, "hoy", lambda: date.fromisoformat(hoy))
    previo = crear_parte(datos, db_session, anterior, datos.empleados[0])
    actual = crear_parte(datos, db_session, hoy, datos.empleados[1])
    llm = FakeLLM(plan(dict(type="modificar_novedad", nombre="Medina", estado_codigo="ACC")))
    process = proceso(llm)
    menu = await process.handle(turno("parte diario"), V3ConversationContext(conversation_id="conv"))
    result = await process.handle(turno("1"), menu.context)
    assert estado(result).modo_apertura == "diario"
    assert estado(result).draft().parte_id == previo.id
    result = await process.handle(turno("Medina tuvo un accidente"), result.context)
    result = await process.handle(turno("guardar"), result.context)
    db_session.refresh(previo)
    assert previo.estado == EstadoParteDiario.CONFIRMADO
    assert result.metadata["parte_diario_id"] == previo.id
    assert "Parte diario confirmado." in result.reply_text
    assert estado(result).etapa == "carga"
    assert estado(result).modo_apertura == "diario"
    assert estado(result).draft().parte_id == actual.id
    assert [n.idnomina for n in estado(result).draft().novedades] == [datos.empleados[1].id]
    result = await process.handle(turno("guardar"), result.context)
    db_session.refresh(actual)
    assert actual.estado == EstadoParteDiario.BORRADOR
    assert result.context.active_process == "general"
    assert result.context.process_state == {}
    assert "1: REPORTAR" not in result.reply_text
    assert len(llm.calls) == 1
    assert len(db_session.exec(select(ParteDiario)).all()) == 2


# Un anterior sin cargar se prepara vacio; solo el usuario decide guardarlo sin novedades.
@pytest.mark.asyncio
async def test_ciclo_sin_anterior_prepara_vacio_y_abre_hoy(datos, db_session):
    process = proceso(FakeLLM())
    result = await process.handle(turno("reportar"), V3ConversationContext(conversation_id="conv"))
    assert estado(result).draft().fecha == "2026-09-11"
    assert not estado(result).draft().sin_novedades_informado
    assert not db_session.exec(select(ParteDiario)).all()
    result = await process.handle(turno("no"), result.context)
    result = await process.handle(turno("1"), result.context)
    assert estado(result).draft().fecha == "2026-09-12"
    assert not estado(result).draft().sin_novedades_informado
    assert not estado(result).draft().novedades
    assert db_session.exec(select(ParteDiario)).one().estado == EstadoParteDiario.CONFIRMADO


# No vuelve a abrir el anterior ya confirmado/cerrado: comienza directamente en hoy.
@pytest.mark.asyncio
@pytest.mark.parametrize("estado_previo", [EstadoParteDiario.CONFIRMADO, EstadoParteDiario.CERRADO])
async def test_ciclo_anterior_completado_va_a_hoy(datos, db_session, estado_previo):
    previo = crear_parte(datos, db_session, "2026-09-11", datos.empleados[0], estado_previo)
    process = proceso(FakeLLM())
    result = await process.handle(turno("reportar"), V3ConversationContext(conversation_id="conv"))
    assert estado(result).modo_apertura == "diario"
    assert estado(result).draft().fecha == "2026-09-12"
    result = await process.handle(turno("guardar"), result.context)
    assert result.context.active_process == "general"
    db_session.refresh(previo)
    assert previo.estado == estado_previo


# Pedir una fecha, incluso relativa, no inicia el ciclo automatico anterior/hoy.
@pytest.mark.asyncio
@pytest.mark.parametrize("texto", ["parte diario 11/09/2026", "parte diario ayer"])
async def test_apertura_puntual_guarda_solo_fecha_pedida(datos, db_session, texto):
    process = proceso(FakeLLM())
    result = await process.handle(turno(texto), V3ConversationContext(conversation_id="conv"))
    assert estado(result).modo_apertura == "puntual"
    result = await process.handle(turno("guardar"), result.context)
    assert result.context.active_process == "general"
    parte = db_session.exec(select(ParteDiario)).one()
    assert parte.fecha == date(2026, 9, 11)
    assert parte.estado == EstadoParteDiario.CONFIRMADO


# Si no se guarda el anterior, el ciclo conserva la fecha para reintentar.
@pytest.mark.asyncio
async def test_ciclo_error_guardado_no_abre_hoy(datos, monkeypatch):
    process = proceso(FakeLLM())
    result = await process.handle(turno("reportar"), V3ConversationContext(conversation_id="conv"))

    # Rechaza el guardado sin escribir datos ni preparar el siguiente parte.
    def rechazar(*args, **kwargs):
        raise ValueError("No se pudo guardar")

    monkeypatch.setattr(parte_diario, "persistir_borrador", rechazar)
    result = await process.handle(turno("guardar"), result.context)
    assert result.metadata["status"] == "save_rejected"
    assert estado(result).etapa == "revision"
    assert estado(result).modo_apertura == "diario"
    assert estado(result).draft().fecha == "2026-09-11"
