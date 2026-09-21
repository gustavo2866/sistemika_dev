"""Jornada por fecha en carga, aclaraciones, persistencia y consultas."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlmodel import select

from app.models import ParteDiario, ParteDiarioDetalle, ParteDiarioEstado, ProyectoEncargado
from app.services.parte_diario_service import (
    ParteDiarioService,
    _destination_hours,
    _destination_work_hours,
    _provisional_hours,
)
from app.utils.jornada import get_jornada_esperada
from agente.v3.subprocesses.parte_diario.domain import novedades
from agente.v3.subprocesses.parte_diario.domain.models import PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.domain.parte_diario import ParteDiarioQueryService
from agente.v3.subprocesses.parte_diario.utils import renderer
from tests.unit.test_parte_diario_carga_flow import FakeLLM, datos, estado, plan, proceso
from tests.unit.test_parte_diario_handler_inicial import contexto, escenario
from tests.unit.test_parte_diario_revision_flow import turno


# La regla compartida cubre toda la semana y acepta la fecha ISO del borrador.
@pytest.mark.parametrize("dia,horas", enumerate([9, 9, 9, 9, 9, 6, 0]))
def test_jornada_semanal(dia, horas):
    fecha = date(2026, 9, 7) + timedelta(days=dia)
    assert get_jornada_esperada(fecha) == Decimal(horas)
    assert get_jornada_esperada(fecha.isoformat()) == Decimal(horas)


# Todos los defaults usan la misma base, sin alterar horas explicitas ni ausencias.
@pytest.mark.parametrize("fecha,base", [("2026-09-11", 9), ("2026-09-12", 6)])
def test_defaults_normalizacion_y_presentacion(fecha, base):
    for horas, extras, codigo, esperado in [
        (None, None, "P", base), (None, 2, "P", base + 2),
        (4, None, "P", 4), (0, None, "P", 0), (None, None, "ENF", 0),
    ]:
        assert novedades.normalizar_horas(
            fecha=fecha, horas=horas, horas_extra=extras,
            estado_codigo=codigo, fuera_de_proyecto=False,
        ) == esperado
        item = dict(horas=horas, horas_extra=extras, estado_codigo=codigo)
        assert _provisional_hours(item, fecha) == esperado
        assert renderer._pending_hours(PendienteAmbiguo("Medina", **item), fecha) == esperado
    assert _destination_hours(dict(estado_codigo="P"), fecha) == base
    assert _destination_hours(dict(estado_codigo="P", horas=0), fecha) == 0
    assert _destination_hours(dict(estado_codigo="P", horas=12), fecha) == 12


# Agente y formulario manual comparten la distribucion de horas entre obras.
@pytest.mark.parametrize(
    "horas_destino,horas_origen",
    [(9, 0), (4, 5), (12, 0)],
)
def test_distribucion_horas_trabajo_destino(horas_destino, horas_origen):
    assert _destination_work_hours(
        {"estado_codigo": "P", "fuera_de_proyecto": True, "horas": horas_destino},
        "2026-09-11",
    ) == (horas_origen, horas_destino)


def test_distribucion_horas_trabajo_destino_rechaza_fuera_de_rango():
    with pytest.raises(ValueError, match="entre 0 y 24"):
        _destination_work_hours(
            {"estado_codigo": "P", "fuera_de_proyecto": True, "horas": 25},
            "2026-09-11",
        )


# La base tambien decide jornada parcial y el maximo permitido al sumar extras.
@pytest.mark.parametrize("fecha,base", [("2026-09-11", 9), ("2026-09-12", 6)])
def test_validaciones_usan_jornada_del_parte(fecha, base):
    pending = PendienteAmbiguo("Medina", idestado=1, estado_codigo="P", horas=base)
    assert novedades._validate_pending_business_rules(pending, fecha) is None
    pending.horas = base - 1
    assert f"menor a {base} horas" in novedades._validate_pending_business_rules(pending, fecha)
    valid = plan(dict(type="agregar_novedad", nombre="Medina", horas_extra=24-base))
    assert novedades._validate_plan(valid, fecha) is None
    valid.operations[0].horas_extra += 1
    assert "24 horas" in novedades._validate_plan(valid, fecha)
    item = dict(idnomina=1, idestado=1, horas=base)
    ParteDiarioService._validate_novedades(
        [item], fecha=date.fromisoformat(fecha), present_id=1, require_close_rules=True,
    )
    item["horas"] -= 1
    with pytest.raises(ValueError, match=f"al menos {base} horas"):
        ParteDiarioService._validate_novedades(
            [item], fecha=date.fromisoformat(fecha), present_id=1, require_close_rules=True,
        )


# La transferencia usa la fecha del parte, incluso si se carga un sabado anterior.
@pytest.mark.asyncio
@pytest.mark.parametrize("fecha,base", [("2026-09-05", 6), ("2026-09-11", 9), ("2026-09-12", 6)])
@pytest.mark.parametrize("encargados", [1, 2])
async def test_transferencia_default_hasta_guardado(datos, db_session, fecha, base, encargados):
    if encargados == 1:
        assignment = db_session.exec(select(ProyectoEncargado).where(
            ProyectoEncargado.contacto_id == datos.encargados[1].id,
        )).one()
        db_session.delete(assignment)
        db_session.commit()
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = fecha
    process = proceso(FakeLLM(plan(dict(
        type="agregar_novedad", nombre="Medina", estado_codigo="P",
        fuera_de_proyecto=True, nombre_proyecto=datos.destino.nombre,
    ))))
    result = await process.handle(turno(f"Medina trabajo en {datos.destino.nombre}"), ctx)
    if encargados == 2:
        assert estado(result).etapa == "carga_validar_encargado"
        result = await process.handle(turno("1"), result.context)
    assert estado(result).draft().novedades[0].horas == base
    result = await process.handle(turno("listo"), result.context)
    result = await process.handle(turno("1"), result.context)
    assert result.metadata["status"] == ("saved" if fecha == "2026-09-12" else "confirmed")
    rows = db_session.exec(select(ParteDiario, ParteDiarioDetalle).join(
        ParteDiarioDetalle, ParteDiarioDetalle.parte_diario_id == ParteDiario.id,
    )).all()
    por_obra = {parte.idproyecto: detalle.horas for parte, detalle in rows}
    assert por_obra == {datos.obra.proyecto_id: 0, datos.destino.id: base}
    assert all(parte.fecha.isoformat() == fecha for parte, _ in rows)


# Las horas indicadas se conservan; solo el remanente en origen depende de la jornada.
@pytest.mark.asyncio
@pytest.mark.parametrize("horas,origen", [(0, 6), (4, 2), (12, 0)])
async def test_transferencia_sabado_con_horas_explicitas(datos, db_session, horas, origen):
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = "2026-09-12"
    process = proceso(FakeLLM(plan(dict(
        type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=horas,
        fuera_de_proyecto=True, nombre_proyecto=datos.destino.nombre,
    ))))
    result = await process.handle(turno(f"Medina trabajo {horas}hs en {datos.destino.nombre}"), ctx)
    result = await process.handle(turno("1"), result.context)
    if horas < 6:
        assert estado(result).etapa == "carga_validar_estado"
        result = await process.handle(turno("permiso"), result.context)
    result = await process.handle(turno("listo"), result.context)
    result = await process.handle(turno("1"), result.context)
    rows = db_session.exec(select(ParteDiario, ParteDiarioDetalle).join(
        ParteDiarioDetalle, ParteDiarioDetalle.parte_diario_id == ParteDiario.id,
    )).all()
    assert {parte.idproyecto: detalle.horas for parte, detalle in rows} == {
        datos.obra.proyecto_id: origen, datos.destino.id: horas,
    }


# Resolver un homonimo un sabado no convierte seis horas en jornada parcial.
@pytest.mark.asyncio
async def test_sabado_empleado_ambiguo_y_modificacion_con_extras(datos):
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = "2026-09-12"
    process = proceso(FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="P", horas=6)),
        plan(dict(type="modificar_novedad", nombre="Juan Perez", estado_codigo="P", horas_extra=2)),
    ))
    result = await process.handle(turno("Perez trabajo 6hs"), ctx)
    assert estado(result).etapa == "carga_validar_empleado"
    result = await process.handle(turno("Juan Perez"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().novedades[0].horas == 6
    result = await process.handle(turno("corregi Juan Perez, hizo 2 horas extra"), result.context)
    assert estado(result).draft().novedades[0].horas == 8
    assert "Horas extra\n- Perez, Juan (2)" in renderer.resumen_revision(estado(result).draft())


# Cada fila de una consulta de varios dias descuenta la jornada de su propia fecha.
@pytest.mark.parametrize("agrupacion", ["fecha", "persona"])
def test_consulta_extras_y_presentes_por_fecha(datos, db_session, agrupacion):
    present = db_session.exec(select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")).one()
    for fecha, base in [(date(2026, 9, 11), 9), (date(2026, 9, 12), 6)]:
        parte = ParteDiario(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id, fecha=fecha)
        db_session.add(parte)
        db_session.flush()
        for empleado, horas in zip(datos.empleados[:2], [base, base + 2]):
            db_session.add(ParteDiarioDetalle(
                parte_diario_id=parte.id, idnomina=empleado.id, idestado=present.id, horas=Decimal(horas),
            ))
    db_session.commit()
    service = ParteDiarioQueryService(
        session=db_session, proyecto_id=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
        nombre_obra=datos.obra.nombre, fecha="2026-09-12",
    )
    reply = service.consultar_novedades(desde="2026-09-11", hasta="2026-09-12")
    assert "Medina" not in reply
    reply = service.consultar_novedades(
        desde="2026-09-11", hasta="2026-09-12", solo_horas_extras=True, agrupar_por=agrupacion,
    )
    assert "Medina" not in reply
    assert "11/09/2026" in reply and "12/09/2026" in reply
    assert reply.count("2h extras") == 2
