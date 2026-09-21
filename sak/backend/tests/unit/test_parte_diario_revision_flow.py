"""Revision, persistencia transaccional, salida y continuacion del parte diario."""

from copy import deepcopy
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlmodel import select

from agente.v3.contracts import V3ConversationContext
from agente.v3.subprocesses.parte_diario.domain import parte_diario
from agente.v3.subprocesses.parte_diario.domain.models import NovedadPersonal
from agente.v3.subprocesses.parte_diario.utils import calendario
from app.models import (
    CRMMensaje,
    EstadoParteDiario,
    OrigenDetalle,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
)
from app.services.parte_diario_service import parte_diario_service
from tests.unit.test_parte_diario_carga_flow import FakeLLM, datos, estado, plan, proceso
from tests.unit.test_parte_diario_handler_inicial import contexto, escenario, mensaje


# Asigna identidad propia a cada mensaje, como ocurre al recibirlo desde WhatsApp.
def turno(text):
    message = mensaje(text)
    message.id = message.external_message_id = str(uuid4())
    return message


# La eleccion en revision persiste sin LLM ni confirmaciones adicionales.
@pytest.mark.asyncio
@pytest.mark.parametrize("fecha,expected", [("2026-09-12", EstadoParteDiario.BORRADOR),
                                           ("2026-09-11", EstadoParteDiario.CONFIRMADO)])
@pytest.mark.parametrize("command", ["1", "guardar", "cerrar", "guardar borrador", "ok"])
async def test_revision_persiste_parte_detalle_y_mensaje(datos, db_session, fecha, expected, command):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")))
    process = proceso(llm)
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = fecha
    result = await process.handle(turno("Medina enfermo"), ctx)
    result = await process.handle(turno("listo"), result.context)
    assert estado(result).etapa == "revision"
    assert "1. Guardar\n2. Volver a carga" in result.reply_text
    assert "Cerrar parte" not in result.reply_text
    assert "Guardar borrador" not in result.reply_text
    assert not db_session.exec(select(ParteDiario)).all()
    result = await process.handle(turno(command), result.context)
    saved = db_session.exec(select(ParteDiario)).one()
    detail = db_session.exec(select(ParteDiarioDetalle)).one()
    crm = db_session.exec(select(CRMMensaje)).one()
    assert saved.estado == expected
    assert detail.parte_diario_id == saved.id
    assert detail.idnomina == datos.empleados[0].id
    assert detail.horas == 0
    assert saved.mensaje_origen_id == crm.id
    assert crm.metadata_json["agent_v3"]["parte_diario_id"] == saved.id
    assert result.metadata["parte_diario_id"] == saved.id
    assert result.context.active_process == "general"
    assert result.context.process_state == {}
    resultado = (
        "Parte diario confirmado."
        if expected == EstadoParteDiario.CONFIRMADO
        else "Parte diario guardado como borrador."
    )
    assert result.reply_text == f"{resultado}\nObra: Francia\nFecha: {fecha}"
    assert len(llm.calls) == 1


# Volver a carga conserva las novedades y permite corregir antes de confirmar.
@pytest.mark.asyncio
async def test_revision_volver_conserva_borrador(datos, db_session):
    process = proceso(FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF"))))
    result = await process.handle(turno("Medina enfermo"), contexto(datos.obra))
    result = await process.handle(turno("listo"), result.context)
    snapshot = estado(result).draft().to_dict()
    result = await process.handle(turno("2"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().to_dict() == snapshot
    assert not db_session.exec(select(ParteDiario)).all()


# El resumen vacio se confirma como sin novedades al elegir guardar o cerrar.
@pytest.mark.asyncio
@pytest.mark.parametrize("command", ["guardar", "cerrar"])
async def test_revision_confirma_sin_novedades_sin_pregunta_extra(datos, db_session, command):
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["sin_novedades_informado"] = False
    process = proceso(FakeLLM())
    result = await process.handle(turno("no"), ctx)
    assert "Sin novedades. Todos presentes." in result.reply_text
    result = await process.handle(turno(command), result.context)
    assert db_session.exec(select(ParteDiario)).one()
    assert not db_session.exec(select(ParteDiarioDetalle)).all()
    assert result.metadata["result"]["sin_novedades_informado"]


@pytest.mark.asyncio
async def test_revision_no_reenvia_novedad_interna_al_guardar(datos, db_session):
    alta = ParteDiarioEstado(abreviatura="ALT", nombre="ALTA", activo=False)
    parte = ParteDiario(
        idproyecto=datos.obra.proyecto_id,
        contacto_id=datos.obra.contacto_id,
        fecha=date(2026, 9, 11),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add_all([alta, parte])
    db_session.flush()
    detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=datos.empleados[0].id,
        idestado=alta.id,
        horas=Decimal("9"),
        descripcion="17",
        origen=OrigenDetalle.AGENTE,
    )
    db_session.add(detalle)
    db_session.commit()
    ctx = contexto(datos.obra, "revision")
    ctx.process_state["parte_state"].update(
        parte_id=parte.id,
        novedades_internas=[
            NovedadPersonal(
                nombre="Medina, Ivan",
                idnomina=datos.empleados[0].id,
                idestado=alta.id,
                estado_codigo="ALT",
                horas=9,
            ).to_dict()
        ],
        sin_novedades_informado=False,
    )

    result = await proceso(FakeLLM()).handle(turno("1"), ctx)

    assert result.metadata["status"] == "confirmed"
    assert result.metadata["result"]["novedades"] == []
    assert result.metadata["result"]["sin_novedades_informado"] is True
    detalles = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).all()
    assert detalles == [detalle]
    assert detalles[0].idestado == alta.id


# Un borrador guardado se puede retomar y actualizar sin duplicar parte ni detalles.
@pytest.mark.asyncio
async def test_guardar_retomar_y_confirmar_al_dia_siguiente(datos, db_session, monkeypatch):
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")),
        plan(dict(type="modificar_novedad", nombre="Medina", estado_codigo="ACC")),
    )
    process = proceso(llm)
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = "2026-09-12"
    result = await process.handle(turno("Medina enfermo"), ctx)
    result = await process.handle(turno("listo"), result.context)
    result = await process.handle(turno("1"), result.context)
    parte_id = result.metadata["parte_diario_id"]
    result = await process.handle(turno("parte diario 12/09/2026"), V3ConversationContext(conversation_id="conv"))
    assert estado(result).draft().parte_id == parte_id
    result = await process.handle(turno("corregi Medina, accidente"), result.context)
    expected_estado = estado(result).draft().novedades[0].idestado
    result = await process.handle(turno("cerrar"), result.context)
    monkeypatch.setattr(calendario, "hoy", lambda: date(2026, 9, 13))
    result = await process.handle(turno("1"), result.context)
    db_session.expire_all()
    saved = db_session.exec(select(ParteDiario)).one()
    assert saved.id == parte_id
    assert saved.estado == EstadoParteDiario.CONFIRMADO
    detail = db_session.exec(select(ParteDiarioDetalle)).one()
    assert detail.idestado == expected_estado
    assert len(db_session.exec(select(CRMMensaje)).all()) == 2


# Un reintento del mismo mensaje de confirmacion reutiliza la persistencia existente.
@pytest.mark.asyncio
async def test_confirmacion_repetida_es_idempotente(datos, db_session):
    process = proceso(FakeLLM())
    opened = await process.handle(turno("cerrar"), contexto(datos.obra))
    confirmation = turno("1")
    first = await process.handle(confirmation, opened.context)
    second = await process.handle(confirmation, opened.context)
    assert first.metadata["parte_diario_id"] == second.metadata["parte_diario_id"]
    assert len(db_session.exec(select(ParteDiario)).all()) == 1
    assert len(db_session.exec(select(CRMMensaje)).all()) == 1


# Los controles finales bloquean la persistencia sin reparar ni cambiar el estado.
@pytest.mark.asyncio
@pytest.mark.parametrize("problem", ["sin_fecha", "futura", "cambio_fecha", "cerrado"])
async def test_revision_rechaza_integridad_final(datos, db_session, problem):
    ctx = contexto(datos.obra, "revision")
    draft = ctx.process_state["parte_state"]
    if problem == "sin_fecha":
        draft["fecha"] = None
    elif problem == "futura":
        draft["fecha"] = "2026-09-20"
    elif problem == "cambio_fecha":
        draft["fecha_propuesta"] = "2026-09-10"
    else:
        saved = ParteDiario(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                            fecha=date(2026, 9, 11), estado=EstadoParteDiario.CERRADO)
        db_session.add(saved)
        db_session.commit()
    snapshot = deepcopy(ctx.process_state)
    result = await proceso(FakeLLM()).handle(turno("cerrar"), ctx)
    assert result.metadata["status"] == "save_rejected"
    assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    assert not db_session.exec(select(CRMMensaje)).all()
    assert not db_session.exec(select(ParteDiarioDetalle)).all()


# Un fallo luego de escribir la cabecera revierte todo y conserva el borrador para reintentar.
@pytest.mark.asyncio
async def test_error_persistencia_revierte_y_permite_reintentar(datos, db_session, monkeypatch):
    process = proceso(FakeLLM())
    opened = await process.handle(turno("listo"), contexto(datos.obra))
    snapshot = deepcopy(opened.context.process_state)
    confirmation = turno("1")

    def fail_materialization(*args, **kwargs):
        raise RuntimeError("fallo transaccional simulado")

    with monkeypatch.context() as patch:
        patch.setattr(parte_diario_service, "_materialize_destination_novedades", fail_materialization)
        result = await process.handle(confirmation, opened.context)
    assert result.metadata["status"] == "persistence_error"
    assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    assert not db_session.exec(select(ParteDiario)).all()
    assert not db_session.exec(select(CRMMensaje)).all()
    result = await process.handle(confirmation, result.context)
    assert result.metadata["status"] == "confirmed"
    assert len(db_session.exec(select(ParteDiario)).all()) == 1


# La confirmacion materializa tanto la novedad de origen como la de destino.
@pytest.mark.asyncio
async def test_revision_persiste_trabajo_en_otra_obra(datos, db_session):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=4,
                           fuera_de_proyecto=True, nombre_proyecto=datos.destino.nombre)))
    process = proceso(llm)
    result = await process.handle(turno(f"Medina trabajo 4hs en {datos.destino.nombre}"), contexto(datos.obra))
    result = await process.handle(turno("1"), result.context)
    assert estado(result).etapa == "carga_validar_estado"
    result = await process.handle(turno("permiso"), result.context)
    result = await process.handle(turno("cerrar"), result.context)
    result = await process.handle(turno("1"), result.context)
    assert result.metadata["status"] == "confirmed"
    parts = db_session.exec(select(ParteDiario)).all()
    assert {part.idproyecto for part in parts} == {datos.obra.proyecto_id, datos.destino.id}
    details = db_session.exec(select(ParteDiarioDetalle)).all()
    assert len(details) == 2


# La opcion explicita de persona sin validar se conserva como detalle provisorio.
@pytest.mark.asyncio
async def test_revision_guarda_persona_sin_validar(datos, db_session):
    process = proceso(FakeLLM(plan(dict(type="agregar_novedad", nombre="zzzzz", estado_codigo="ENF"))))
    result = await process.handle(turno("zzzzz enfermo"), contexto(datos.obra))
    result = await process.handle(turno("ninguno"), result.context)
    result = await process.handle(turno("listo"), result.context)
    result = await process.handle(turno("1"), result.context)
    assert result.metadata["status"] == "confirmed"
    detail = db_session.exec(select(ParteDiarioDetalle)).one()
    assert detail.idnomina is None
    assert detail.nombre_provisorio == "zzzzz"


# Cancelar la salida regresa a la pregunta activa, no a un estado calculado por pendientes.
@pytest.mark.asyncio
async def test_salida_desde_validacion_vuelve_a_misma_pregunta(datos, db_session):
    process = proceso(FakeLLM(plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="ENF"))))
    result = await process.handle(turno("Perez enfermo"), contexto(datos.obra))
    result = await process.handle(turno("salir"), result.context)
    assert estado(result).salida_origen == "carga_validar_empleado"
    assert estado(result).etapa == "confirmar_salida"
    result = await process.handle(turno("2"), result.context)
    assert estado(result).etapa == "carga_validar_empleado"
    assert "Perez" in result.reply_text
    result = await process.handle(turno("1"), result.context)
    assert estado(result).etapa == "carga"
    assert len(estado(result).draft().novedades) == 1
    assert not db_session.exec(select(ParteDiario)).all()


# Descartar no elimina un parte previamente guardado ni sus detalles.
@pytest.mark.asyncio
async def test_descartar_no_borra_datos_guardados(datos, db_session):
    process = proceso(FakeLLM())
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = "2026-09-12"
    result = await process.handle(turno("listo"), ctx)
    result = await process.handle(turno("1"), result.context)
    parte_id = result.metadata["parte_diario_id"]
    result = await process.handle(turno("parte diario 12/09/2026"), V3ConversationContext(conversation_id="conv"))
    result = await process.handle(turno("salir"), result.context)
    result = await process.handle(turno("1"), result.context)
    assert result.context.active_process == "general"
    assert result.context.process_state == {}
    assert result.metadata["accion_cierre"] == "descartar"
    assert result.reply_text == (
        "Cambios no guardados descartados. Los datos guardados no se modificaron."
    )
    assert "PEDIDO OBRA" not in result.reply_text
    assert db_session.get(ParteDiario, parte_id) is not None


# Guardar desde carga termina en un turno sin LLM ni consulta de otra fecha.
@pytest.mark.asyncio
@pytest.mark.parametrize("fecha,expected", [("2026-09-12", "saved"), ("2026-09-11", "confirmed")])
@pytest.mark.parametrize("command", ["guardar", "guardar borrador"])
async def test_guardar_directo_finaliza_sin_ofrecer_otro_parte(datos, db_session, monkeypatch, fecha, expected, command):
    # Detecta cualquier intento de proponer otra fecha despues del guardado.
    def no_consultar_fechas(*args, **kwargs):
        pytest.fail("Guardar no debe consultar otra fecha")

    monkeypatch.setattr(parte_diario, "pending_parts_last_days_options", no_consultar_fechas)
    llm = FakeLLM()
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = fecha
    ctx.process_state["parte_state"]["sin_novedades_informado"] = False
    result = await proceso(llm).handle(turno(command), ctx)
    assert result.metadata["status"] == expected
    assert result.context.active_process == "general"
    assert result.context.process_state == {}
    assert len(db_session.exec(select(ParteDiario)).all()) == 1
    assert len(db_session.exec(select(CRMMensaje)).all()) == 1
    assert result.metadata["result"]["sin_novedades_informado"]
    assert not llm.calls


# Un fallo del guardado directo conserva novedades y permite reintentar desde revision.
@pytest.mark.asyncio
async def test_guardar_directo_falla_y_reintenta(datos, db_session, monkeypatch):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")))
    process = proceso(llm)
    loaded = await process.handle(turno("Medina enfermo"), contexto(datos.obra))
    snapshot = estado(loaded).draft().to_dict()

    # Simula un error despues de escribir la cabecera para verificar el rollback.
    def fallar(*args, **kwargs):
        raise RuntimeError("fallo simulado")

    with monkeypatch.context() as patch:
        patch.setattr(parte_diario_service, "_materialize_destination_novedades", fallar)
        result = await process.handle(turno("guardar"), loaded.context)
    assert result.metadata["status"] == "persistence_error"
    assert estado(result).etapa == "revision"
    assert estado(result).draft().to_dict() == snapshot
    assert not db_session.exec(select(ParteDiario)).all()
    result = await process.handle(turno("1"), result.context)
    assert result.context.active_process == "general"
    assert result.context.process_state == {}
    assert db_session.exec(select(ParteDiarioDetalle)).one().idnomina == datos.empleados[0].id
    assert len(llm.calls) == 1


# NO conserva la revision previa; el guardado finaliza sin pedir otra respuesta.
@pytest.mark.asyncio
async def test_no_revision_guardar_finaliza(datos, db_session):
    llm = FakeLLM()
    process = proceso(llm)
    result = await process.handle(turno("no"), contexto(datos.obra))
    assert estado(result).etapa == "revision"
    assert not db_session.exec(select(ParteDiario)).all()
    result = await process.handle(turno("1"), result.context)
    assert result.context.active_process == "general"
    assert result.context.process_state == {}
    assert len(db_session.exec(select(ParteDiario)).all()) == 1
    assert not llm.calls


# Una intencion de cancelar interpretada por el LLM no descarta antes de pedir permiso.
@pytest.mark.asyncio
async def test_cancelacion_interpretada_conserva_borrador_hasta_confirmar(datos):
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")),
        plan(dict(type="solicitar_cancelacion")),
    )
    process = proceso(llm)
    result = await process.handle(turno("Medina enfermo"), contexto(datos.obra))
    snapshot = estado(result).draft().to_dict()
    result = await process.handle(turno("no quiero continuar con este parte"), result.context)
    assert estado(result).etapa == "confirmar_salida"
    assert estado(result).draft().to_dict() == snapshot
    result = await process.handle(turno("no"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().to_dict() == snapshot


# Cancelar una salida desde revision conserva tambien la accion elegida y el resumen.
@pytest.mark.asyncio
async def test_salida_desde_revision_vuelve_a_revision(datos):
    process = proceso(FakeLLM())
    result = await process.handle(turno("cerrar"), contexto(datos.obra))
    result = await process.handle(turno("salir"), result.context)
    result = await process.handle(turno("volver"), result.context)
    assert estado(result).etapa == "revision"
    assert estado(result).accion_cierre == "guardar"
    assert "1. Guardar" in result.reply_text


# Un parte confirmado por otro usuario durante revision no se sobrescribe.
@pytest.mark.asyncio
async def test_cierre_concurrente_impide_sobrescribir_borrador(datos, db_session):
    process = proceso(FakeLLM())
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = "2026-09-12"
    result = await process.handle(turno("listo"), ctx)
    result = await process.handle(turno("1"), result.context)
    saved = db_session.get(ParteDiario, result.metadata["parte_diario_id"])
    result = await process.handle(turno("parte diario 12/09/2026"), V3ConversationContext(conversation_id="conv"))
    result = await process.handle(turno("cerrar"), result.context)
    saved.estado = EstadoParteDiario.CONFIRMADO
    db_session.add(saved)
    db_session.commit()
    snapshot = deepcopy(result.context.process_state)
    result = await process.handle(turno("1"), result.context)
    assert result.metadata["status"] == "save_rejected"
    assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    assert len(db_session.exec(select(CRMMensaje)).all()) == 1
