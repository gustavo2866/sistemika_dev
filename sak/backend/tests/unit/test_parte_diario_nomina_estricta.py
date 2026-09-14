"""Limites de la nomina habilitada para cargar novedades del parte."""

from datetime import date

import pytest
from sqlmodel import select

from agente.v3.subprocesses.parte_diario.domain import empleados
from agente.v3.subprocesses.parte_diario.domain.models import NominaItem
from app.models import ParteDiario, ParteDiarioDetalle, Tarja, TarjaNomina
from tests.unit.test_parte_diario_carga_flow import FakeLLM, datos, estado, plan, proceso
from tests.unit.test_parte_diario_handler_inicial import contexto, escenario
from tests.unit.test_parte_diario_revision_flow import turno


# Solo Medina y Juan Perez estan vigentes en la tarja propia el 11 de septiembre.
@pytest.fixture
def nomina(datos, db_session):
    propia = Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                   fechainicio=date(2026, 9, 11), fechafinal=date(2026, 9, 25))
    ajena = Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.encargados[0].id,
                 fechainicio=date(2026, 9, 11), fechafinal=date(2026, 9, 25))
    db_session.add_all([propia, ajena])
    db_session.flush()
    for empleado, tarja, desde, hasta in [
        (datos.empleados[0], propia, 11, 25),
        (datos.empleados[2], propia, 11, 11),
        (datos.empleados[3], propia, 12, 25),
        (datos.empleados[3], ajena, 11, 25),
    ]:
        db_session.add(TarjaNomina(tarja_id=tarja.id, nomina_id=empleado.id,
            fecha_desde=date(2026, 9, desde), fecha_hasta=date(2026, 9, hasta)))
    db_session.commit()
    return datos


# Texto libre resuelve al unico Perez local y LISTADO muestra exactamente la misma nomina.
@pytest.mark.asyncio
async def test_perez_unico_y_listado_misma_nomina(nomina):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="ENF")))
    process = proceso(llm)
    result = await process.handle(turno("Perez enfermo"), contexto(nomina.obra))
    assert estado(result).etapa == "carga"
    assert estado(result).draft().novedades[0].idnomina == nomina.empleados[2].id
    result = await process.handle(turno("listado"), result.context)
    assert {p.idnomina for p in estado(result).asistencia_opciones} == {
        nomina.empleados[0].id, nomina.empleados[2].id,
    }


# La vigencia se evalua contra el parte y ambos limites son inclusivos.
@pytest.mark.parametrize("dia,perez", [(11, 2), (12, 3), (25, 3)])
def test_vigencia_tarja_por_fecha(nomina, db_session, dia, perez):
    locales, globales = empleados.cargar_referencias(db_session, nomina.obra.proyecto_id,
        contacto_id=nomina.obra.contacto_id, fecha=date(2026, 9, dia))
    resolved = empleados.NominaResolver.resolve("Perez", locales, globales)
    assert resolved.match.idnomina == nomina.empleados[perez].id
    assert not resolved.ambiguo


# Ni la ausencia de tarja ni una tarja vacia habilitan la asignacion general de empleados.
@pytest.mark.parametrize("vacia", [False, True])
def test_sin_nomina_tarja_no_hay_fallback(datos, db_session, vacia):
    if vacia:
        db_session.add(Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
            fechainicio=date(2026, 9, 11), fechafinal=date(2026, 9, 25)))
        db_session.commit()
    locales, globales = empleados.cargar_referencias(db_session, datos.obra.proyecto_id,
        contacto_id=datos.obra.contacto_id, fecha=date(2026, 9, 11))
    assert not locales
    assert globales
    assert empleados.NominaResolver.resolve("Medina", locales, globales).error


# Un ID global o un nombre externo no habilitan el alta ni la opcion de registrar sin validar.
@pytest.mark.asyncio
@pytest.mark.parametrize("por_id", [False, True])
async def test_empleado_ajeno_no_se_puede_agregar(nomina, por_id):
    operation = dict(type="agregar_novedad", nombre="Vera", estado_codigo="ENF")
    if por_id:
        operation["idnomina"] = nomina.empleados[1].id
    process = proceso(FakeLLM(plan(operation)))
    result = await process.handle(turno("Vera enfermo"), contexto(nomina.obra))
    assert not estado(result).draft().novedades
    if not por_id:
        assert estado(result).etapa == "carga_validar_empleado"
        result = await process.handle(turno("registrar sin validar"), result.context)
        assert not estado(result).draft().novedades
        result = await process.handle(turno("ninguno"), result.context)
        assert estado(result).etapa == "carga"
        assert not estado(result).draft().novedades


# Las similitudes nunca proponen una persona de otra nomina.
def test_similares_solo_locales():
    externo = NominaItem(idnomina=9, nombre="Jose", apellido="Perez")
    assert empleados.NominaResolver.find_similar("Peres", [], [externo]) == []


# Dos homonimos vigentes producen menu y la seleccion se aplica dentro de la misma nomina.
@pytest.mark.asyncio
async def test_homonimos_locales_seleccion_validada(nomina, db_session):
    asignacion = db_session.exec(select(TarjaNomina).join(Tarja).where(
        Tarja.contacto_id == nomina.obra.contacto_id,
        TarjaNomina.nomina_id == nomina.empleados[3].id,
    )).one()
    asignacion.fecha_desde = date(2026, 9, 11)
    db_session.add(asignacion)
    db_session.commit()
    process = proceso(FakeLLM(plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="ENF"))))
    result = await process.handle(turno("Perez enfermo"), contexto(nomina.obra))
    assert estado(result).etapa == "carga_validar_empleado"
    pending = estado(result).draft().pendientes_ambiguos[0]
    assert {p.idnomina for p in pending.candidatos} == {p.id for p in nomina.empleados[2:]}
    assert not pending.candidatos_externos
    assert "sin validar" not in result.reply_text
    result = await process.handle(turno("1"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().novedades[0].idnomina in {p.id for p in nomina.empleados[2:]}


# El encargado de origen puede seguir informando trabajo en destino y guardando ambos partes.
@pytest.mark.asyncio
async def test_transferencia_desde_nomina_origen(nomina, db_session):
    process = proceso(FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="P",
        horas=4, fuera_de_proyecto=True, nombre_proyecto=nomina.destino.nombre))))
    result = await process.handle(turno("Medina trabajo 4hs en destino"), contexto(nomina.obra))
    assert estado(result).etapa == "carga_validar_encargado"
    result = await process.handle(turno("1"), result.context)
    assert estado(result).etapa == "carga"
    result = await process.handle(turno("guardar"), result.context)
    assert result.metadata["status"] == "confirmed"
    assert {p.idproyecto for p in db_session.exec(select(ParteDiario)).all()} == {
        nomina.obra.proyecto_id, nomina.destino.id,
    }
    assert len(db_session.exec(select(ParteDiarioDetalle)).all()) == 2
