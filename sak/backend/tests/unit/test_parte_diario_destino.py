"""Guardado de transferencias contra partes de destino existentes."""

from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models import EstadoParteDiario, ParteDiario, ParteDiarioDetalle, ParteDiarioEstado
from tests.unit.test_parte_diario_carga_flow import FakeLLM, datos, estado, plan, proceso
from tests.unit.test_parte_diario_handler_inicial import contexto, escenario
from tests.unit.test_parte_diario_revision_flow import turno


# Reabre solo el destino confirmado y conserva novedades, encargado y fecha.
@pytest.mark.asyncio
@pytest.mark.parametrize("fecha", ["2026-09-11", "2026-09-12"])
@pytest.mark.parametrize("estado_destino", list(EstadoParteDiario))
async def test_guardar_transferencia_con_destino_existente(datos, db_session, fecha, estado_destino):
    presente = db_session.exec(select(ParteDiarioEstado).where(
        ParteDiarioEstado.abreviatura == "P",
    )).one()
    destino = ParteDiario(
        idproyecto=datos.destino.id, contacto_id=datos.encargados[0].id,
        fecha=date.fromisoformat(fecha), estado=estado_destino,
    )
    otro_encargado = ParteDiario(
        idproyecto=datos.destino.id, contacto_id=datos.encargados[1].id,
        fecha=date.fromisoformat(fecha), estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add_all([destino, otro_encargado])
    db_session.flush()
    previo = ParteDiarioDetalle(
        parte_diario_id=destino.id, idnomina=datos.empleados[1].id,
        idestado=presente.id, horas=Decimal("4"), descripcion="Novedad anterior",
    )
    db_session.add(previo)
    db_session.commit()
    previo_id = previo.id

    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = fecha
    process = proceso(FakeLLM(plan(dict(
        type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=5,
        fuera_de_proyecto=True, nombre_proyecto=datos.destino.nombre,
    ))))
    result = await process.handle(turno("Medina trabajo 5hs en otra obra"), ctx)
    assert estado(result).etapa == "carga_validar_encargado"
    result = await process.handle(turno("1"), result.context)
    result = await process.handle(turno("listo"), result.context)
    result = await process.handle(turno("1"), result.context)

    db_session.expire_all()
    origen = db_session.exec(select(ParteDiario).where(
        ParteDiario.idproyecto == datos.obra.proyecto_id,
        ParteDiario.fecha == date.fromisoformat(fecha),
    )).first()
    detalles = db_session.exec(select(ParteDiarioDetalle).where(
        ParteDiarioDetalle.parte_diario_id == destino.id,
    )).all()
    assert otro_encargado.estado == EstadoParteDiario.CONFIRMADO
    assert destino.contacto_id == datos.encargados[0].id
    assert destino.fecha.isoformat() == fecha
    assert db_session.get(ParteDiarioDetalle, previo_id).descripcion == "Novedad anterior"

    if estado_destino == EstadoParteDiario.CERRADO:
        assert estado(result).etapa == "revision"
        assert len(estado(result).draft().novedades) == 1
        assert origen is None
        assert destino.estado == EstadoParteDiario.CERRADO
        assert [(d.idnomina, d.horas) for d in detalles] == [(datos.empleados[1].id, 4)]
    else:
        assert result.metadata["status"] == ("saved" if fecha == "2026-09-12" else "confirmed")
        assert origen.estado == (
            EstadoParteDiario.BORRADOR if fecha == "2026-09-12" else EstadoParteDiario.CONFIRMADO
        )
        assert destino.estado == EstadoParteDiario.BORRADOR
        assert {d.idnomina: d.horas for d in detalles} == {
            datos.empleados[0].id: 5, datos.empleados[1].id: 4,
        }
