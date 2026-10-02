"""Limites de la nomina habilitada para cargar novedades del parte."""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlmodel import select

from agente.v3.subprocesses.parte_diario.domain import empleados, novedades
from agente.v3.subprocesses.parte_diario.domain.models import NominaItem, NovedadPersonal, ParteDiarioDraft
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from app.models import (
    EstadoParteDiario,
    OrigenDetalle,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
    Tarja,
    TarjaNomina,
)
from app.services.parte_diario_service import parte_diario_service
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


# La ausencia total se autocura materializando la nomina base en TarjaNomina.
@pytest.mark.parametrize("vacia", [False, True])
def test_sin_nomina_tarja_se_inicializa_desde_la_asignacion_base(datos, db_session, vacia):
    if vacia:
        db_session.add(Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
            fechainicio=date(2026, 9, 11), fechafinal=date(2026, 9, 25)))
        db_session.commit()
    locales, globales = empleados.cargar_referencias(db_session, datos.obra.proyecto_id,
        contacto_id=datos.obra.contacto_id, fecha=date(2026, 9, 11))
    assert {item.idnomina for item in locales} == {item.id for item in datos.empleados}
    assert globales
    assert empleados.NominaResolver.resolve("Medina", locales, globales).match.idnomina == datos.empleados[0].id
    tarja = db_session.exec(select(Tarja).where(
        Tarja.idproyecto == datos.obra.proyecto_id,
        Tarja.contacto_id == datos.obra.contacto_id,
        Tarja.fechainicio == date(2026, 9, 11),
        Tarja.fechafinal == date(2026, 9, 25),
    )).one()
    assert {item.nomina_id for item in db_session.exec(select(TarjaNomina).where(
        TarjaNomina.tarja_id == tarja.id,
        TarjaNomina.deleted_at.is_(None),
    )).all()} == {item.id for item in datos.empleados}


# Una nomina parcial es un snapshot intencional y no se completa silenciosamente.
def test_nomina_parcial_no_se_reconcilia_con_asignacion_base(datos, db_session):
    tarja = Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                  fechainicio=date(2026, 9, 11), fechafinal=date(2026, 9, 25))
    db_session.add(tarja)
    db_session.flush()
    db_session.add(TarjaNomina(tarja_id=tarja.id, nomina_id=datos.empleados[0].id,
        fecha_desde=date(2026, 9, 11), fecha_hasta=date(2026, 9, 25)))
    db_session.commit()

    locales, _ = empleados.cargar_referencias(db_session, datos.obra.proyecto_id,
        contacto_id=datos.obra.contacto_id, fecha=date(2026, 9, 11))

    assert [item.idnomina for item in locales] == [datos.empleados[0].id]
    assert len(db_session.exec(select(TarjaNomina).where(
        TarjaNomina.tarja_id == tarja.id,
        TarjaNomina.deleted_at.is_(None),
    )).all()) == 1


# Los registros eliminados expresan una decision previa y no se restauran solos.
def test_nomina_eliminada_no_se_revive(datos, db_session):
    tarja = Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                  fechainicio=date(2026, 9, 11), fechafinal=date(2026, 9, 25))
    db_session.add(tarja)
    db_session.flush()
    registro = TarjaNomina(tarja_id=tarja.id, nomina_id=datos.empleados[0].id,
        fecha_desde=date(2026, 9, 11), fecha_hasta=date(2026, 9, 25),
        deleted_at=datetime.now(UTC))
    db_session.add(registro)
    db_session.commit()

    locales, _ = empleados.cargar_referencias(db_session, datos.obra.proyecto_id,
        contacto_id=datos.obra.contacto_id, fecha=date(2026, 9, 11))

    db_session.refresh(registro)
    assert not locales
    assert registro.deleted_at is not None
    assert len(db_session.exec(select(TarjaNomina).where(
        TarjaNomina.tarja_id == tarja.id,
    )).all()) == 1


# Una tarja del esquema historico no reemplaza la cabecera canonica 11-25.
def test_tarja_legacy_no_impide_crear_quincena_canonica(datos, db_session):
    legacy = Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                   fechainicio=date(2026, 9, 1), fechafinal=date(2026, 9, 15))
    db_session.add(legacy)
    db_session.commit()

    locales, _ = empleados.cargar_referencias(db_session, datos.obra.proyecto_id,
        contacto_id=datos.obra.contacto_id, fecha=date(2026, 9, 11))

    assert {item.idnomina for item in locales} == {item.id for item in datos.empleados}
    tarjas = db_session.exec(select(Tarja).where(
        Tarja.idproyecto == datos.obra.proyecto_id,
        Tarja.contacto_id == datos.obra.contacto_id,
    )).all()
    assert {(item.fechainicio, item.fechafinal) for item in tarjas} == {
        (date(2026, 9, 1), date(2026, 9, 15)),
        (date(2026, 9, 11), date(2026, 9, 25)),
    }


# Sin una asignacion base valida no se deja una cabecera vacia como efecto lateral.
def test_sin_nomina_base_no_crea_tarja(escenario, db_session):
    locales, _ = empleados.cargar_referencias(db_session, escenario.proyecto_id,
        contacto_id=escenario.contacto_id, fecha=date(2026, 9, 11))

    assert not locales
    assert not db_session.exec(select(Tarja).where(
        Tarja.idproyecto == escenario.proyecto_id,
        Tarja.contacto_id == escenario.contacto_id,
    )).all()


# Un encargado no puede cargar empleados de otra nomina aunque el nombre sea unico.
@pytest.mark.asyncio
async def test_empleado_ajeno_no_se_resuelve_fuera_de_la_nomina_local(nomina, db_session):
    vera = nomina.empleados[1]
    vera.idproyecto = nomina.destino.id
    db_session.add(vera)
    db_session.commit()
    process = proceso(FakeLLM(plan(dict(type="agregar_novedad", nombre="Vera", estado_codigo="ENF"))))
    result = await process.handle(turno("Vera enfermo"), contexto(nomina.obra))
    draft = estado(result).draft()
    assert not draft.novedades
    assert estado(result).etapa == "carga_validar_empleado"
    assert draft.pendientes_ambiguos[0].nombre_no_encontrado is True
    assert not draft.pendientes_ambiguos[0].candidatos_externos


# Una coincidencia de la nomina actual prevalece sobre homonimos externos.
def test_resolucion_prioriza_coincidencia_local():
    local = NominaItem(idnomina=1, nombre="Jorge", apellido="Sosa")
    externo = NominaItem(
        idnomina=9, nombre="Jorge", apellido="Sosa",
        idproyecto=2, nombre_proyecto="Buenos Aires 744", fuera_de_proyecto=True,
    )
    resolved = empleados.NominaResolver.resolve("Sosa", [local], [local, externo])
    assert resolved.match == local
    assert not resolved.ambiguo


# Las coincidencias aproximadas tampoco salen de la nomina local.
def test_similares_no_buscan_empleados_externos():
    local = NominaItem(idnomina=1, nombre="Jorge", apellido="Sosa")
    externo = NominaItem(idnomina=9, nombre="Jose", apellido="Perez", fuera_de_proyecto=True)
    assert empleados.NominaResolver.find_similar("Sossa", [local], [local, externo]) == [local]
    assert empleados.NominaResolver.find_similar("Peres", [local], [local, externo]) == []


# Una novedad derivada ya visible queda bajo el alcance editable del parte destino.
@pytest.mark.parametrize("action", ["modificar", "eliminar"])
def test_novedad_derivada_es_editable_desde_parte_destino(action):
    local = NominaItem(idnomina=1, nombre="Jorge", apellido="Sosa")
    externo = NominaItem(idnomina=9, nombre="Jose", apellido="Perez", fuera_de_proyecto=True)
    draft = ParteDiarioDraft(
        oportunidad_id=1,
        idproyecto=2,
        fecha="2026-09-12",
        novedades=[
            NovedadPersonal(
                nombre="Perez, Jose",
                idnomina=externo.idnomina,
                estado_codigo="P",
                horas=4,
                fuera_de_proyecto=True,
                nombre_proyecto="Obra origen",
            )
        ],
    )

    operation = (
        dict(type="modificar_novedad", nombre="Perez", horas=8)
        if action == "modificar"
        else dict(type="eliminar_novedad", nombre="Perez")
    )
    result = novedades.execute_plan(
        draft,
        plan(operation),
        [local],
        [local, externo],
        [],
    )

    assert not result.errors
    expected = [(9, 8)] if action == "modificar" else []
    assert [(item.idnomina, item.horas) for item in result.next_state.novedades] == expected


# El flujo conversacional aplica la misma regla al borrador recuperado.
@pytest.mark.asyncio
@pytest.mark.parametrize("action", ["modificar", "eliminar"])
async def test_borrador_recuperado_edita_empleado_de_otra_nomina(nomina, db_session, action):
    externo = nomina.empleados[1]
    externo.idproyecto = nomina.destino.id
    externo.encargado_contacto_id = nomina.encargados[0].id
    db_session.add(externo)
    db_session.commit()

    context = contexto(nomina.obra)
    current = ParteDiarioV3State.from_dict(context.process_state)
    draft = current.draft()
    draft.fecha = "2026-09-12"
    draft.novedades = [
        NovedadPersonal(
            nombre=f"{externo.apellido}, {externo.nombre}",
            idnomina=externo.id,
            estado_codigo="P",
            horas=6,
            fuera_de_proyecto=True,
            nombre_proyecto=nomina.obra.nombre,
        )
    ]
    current.set_draft(draft)
    context.process_state = current.to_dict()
    operation = (
        dict(type="modificar_novedad", nombre=externo.apellido, horas=8)
        if action == "modificar"
        else dict(type="eliminar_novedad", nombre=externo.apellido)
    )

    result = await proceso(FakeLLM(plan(operation))).handle(
        turno("Vera trabajo 8hs" if action == "modificar" else "quitar a Vera"),
        context,
    )

    expected = [(externo.id, 8)] if action == "modificar" else []
    assert [(item.idnomina, item.horas) for item in estado(result).draft().novedades] == expected
    assert "no pertenece" not in result.reply_text.lower()


# Al guardar desde destino, horas y eliminacion se propagan a la contraparte de origen.
@pytest.mark.parametrize("action", ["modificar", "eliminar"])
def test_guardado_destino_sincroniza_novedad_derivada(nomina, db_session, action):
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    empleado = nomina.empleados[0]
    origin = ParteDiario(
        idproyecto=nomina.obra.proyecto_id,
        contacto_id=nomina.obra.contacto_id,
        fecha=date(2026, 9, 12),
        estado=EstadoParteDiario.BORRADOR,
    )
    destination = ParteDiario(
        idproyecto=nomina.destino.id,
        contacto_id=nomina.encargados[0].id,
        fecha=date(2026, 9, 12),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add_all([origin, destination])
    db_session.flush()
    db_session.add_all([
        ParteDiarioDetalle(
            parte_diario_id=origin.id,
            idnomina=empleado.id,
            idestado=presente.id,
            horas=Decimal("0"),
            descripcion=f"Trabajo temporal [parte_diario_destino_id={destination.id}]",
            origen=OrigenDetalle.AGENTE,
        ),
        ParteDiarioDetalle(
            parte_diario_id=destination.id,
            idnomina=empleado.id,
            idestado=presente.id,
            horas=Decimal("6"),
            origen=OrigenDetalle.AGENTE,
        ),
    ])
    db_session.commit()

    novedades_destino = []
    if action == "modificar":
        novedades_destino.append({
            "nombre": f"{empleado.apellido}, {empleado.nombre}",
            "idnomina": empleado.id,
            "idestado": presente.id,
            "estado_codigo": "P",
            "horas": 4,
            "fuera_de_proyecto": True,
            "nombre_proyecto": nomina.obra.nombre,
        })
    parte_diario_service._create_or_update_from_result(
        db_session,
        {
            "parte_listo": True,
            "idproyecto": destination.idproyecto,
            "contacto_id": destination.contacto_id,
            "fecha": destination.fecha.isoformat(),
            "parte_id_existente": destination.id,
            "novedades": novedades_destino,
            "pendientes_ambiguos": [],
            "conflictos_novedad": [],
            "sin_novedades_informado": action == "eliminar",
        },
        mensaje_id=None,
    )
    db_session.commit()

    origin_rows = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == origin.id)
    ).all()
    destination_rows = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == destination.id)
    ).all()
    if action == "modificar":
        assert [row.horas for row in origin_rows] == [Decimal("2.00")]
        assert [row.horas for row in destination_rows] == [Decimal("4.00")]
    else:
        assert origin_rows == []
        assert destination_rows == []


# La TarjaNomina vigente define pertenencia local aunque Nomina ya apunte a otra obra.
def test_tarja_actual_prevalece_sobre_asignacion_base_transferida(nomina, db_session):
    medina = nomina.empleados[0]
    medina.idproyecto = nomina.destino.id
    db_session.add(medina)
    db_session.commit()

    locales, globales = empleados.cargar_referencias(
        db_session,
        nomina.obra.proyecto_id,
        contacto_id=nomina.obra.contacto_id,
        fecha=date(2026, 9, 11),
    )

    local = next(item for item in locales if item.idnomina == medina.id)
    assert local.idproyecto == nomina.obra.proyecto_id
    assert local.nombre_proyecto == nomina.obra.nombre
    assert local.fuera_de_proyecto is False
    assert empleados.NominaResolver.resolve("Medina", locales, globales).match == local


# Corregir un lote usa al Sosa local aun si su asignacion base ya cambio de obra.
@pytest.mark.asyncio
async def test_sosa_local_no_se_confunde_con_otra_obra_al_quitar_otra_novedad(nomina, db_session):
    sosa = nomina.empleados[0]
    cajal = nomina.empleados[2]
    sosa.nombre = "Jorge Jesus"
    sosa.apellido = "Sosa"
    sosa.idproyecto = nomina.destino.id
    cajal.nombre = "Ismael"
    cajal.apellido = "Cajal"
    db_session.add_all([sosa, cajal])
    db_session.commit()
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Cajal", estado_codigo="ENF")),
        plan(
            dict(type="agregar_novedad", nombre="Sosa", estado_codigo="P", horas=12),
            dict(type="eliminar_novedad", nombre="Cajal"),
        ),
    )
    process = proceso(llm)
    loaded = await process.handle(turno("Cajal enfermo"), contexto(nomina.obra))

    result = await process.handle(turno("Sosa trabajo 12hs, quitar Cajal"), loaded.context)

    assert "no tiene un encargado definido" not in result.reply_text
    assert len(estado(result).draft().novedades) == 1
    novedad = estado(result).draft().novedades[0]
    assert novedad.idnomina == sosa.id
    assert novedad.horas == 12
    assert novedad.fuera_de_proyecto is False
    assert novedad.idproyecto_destino is None


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
    assert "A cual Perez te referis?" in result.reply_text
    for index, candidate in enumerate(pending.candidatos, start=1):
        assert f"{index}. {candidate.nombre_completo}" in result.reply_text
    assert "NO para descartar la novedad." in result.reply_text
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
    assert estado(result).etapa == "carga_validar_estado"
    result = await process.handle(turno("permiso"), result.context)
    assert estado(result).etapa == "carga"
    result = await process.handle(turno("guardar"), result.context)
    assert result.metadata["status"] == "confirmed"
    assert {p.idproyecto for p in db_session.exec(select(ParteDiario)).all()} == {
        nomina.obra.proyecto_id, nomina.destino.id,
    }
    assert len(db_session.exec(select(ParteDiarioDetalle)).all()) == 2
