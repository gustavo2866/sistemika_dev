import json
from datetime import date
from decimal import Decimal

from starlette.requests import Request
from starlette.responses import Response

from app.models import (
    EstadoParteDiario,
    Nomina,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
    Proyecto,
    User,
)
from app.models.nomina_catalogos import NominaCategoria, NominaTarea
from app.models.tarja import Tarja, TarjaDetalle, TarjaNomina
from app.routers.tarja_detalle_router import (
    get_tarja_detalle_novedad,
    list_tarja_detalle,
)


def test_tarja_detalle_list_muestra_nomina_sin_detalles(db_session):
    user = User(nombre="Tester", email="tarja-detalle-list@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra Detalle", responsable_id=user.id)
    categoria = NominaCategoria(codigo="OF", descripcion="Oficial")
    tarea = NominaTarea(codigo="ALB", descripcion="Albanileria")
    db_session.add_all([proyecto, categoria, tarea])
    db_session.flush()
    empleado = Nomina(
        nombre="Juan",
        apellido="Perez",
        dni="12345678",
        nro_legajo="L-001",
        idproyecto=proyecto.id,
    )
    db_session.add(empleado)
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )
    db_session.add(tarja)
    db_session.flush()
    registro = TarjaNomina(
        tarja_id=tarja.id,
        nomina_id=empleado.id,
        nomina_categoria_id=categoria.id,
        nomina_tarea_id=tarea.id,
        presentismo=True,
        adicional_importe=Decimal("100"),
        fecha_desde=tarja.fechainicio,
        fecha_hasta=tarja.fechafinal,
    )
    db_session.add(registro)
    db_session.commit()

    request = Request({"type": "http", "query_string": f"tarja_id={tarja.id}".encode()})
    response = Response()

    rows = list_tarja_detalle(
        request,
        response,
        db_session,
        sort=None,
        range=None,
        filter=None,
        q=None,
    )

    assert response.headers["Content-Range"] == "items 0-0/1"
    assert len(rows) == 1
    assert rows[0]["idnomina"] == empleado.id
    assert rows[0]["empleado"] == "Perez, Juan"
    assert rows[0]["nro_legajo"] == "L-001"
    assert rows[0]["obra"] == "Obra Detalle"
    assert rows[0]["categoria_codigo"] == "OF"
    assert rows[0]["actividad_codigo"] == "ALB"
    assert rows[0]["novedad"]["id"] == registro.id
    assert rows[0]["novedad"]["presentismo"] is True
    assert rows[0]["D01"] == {
        "detalle_id": None,
        "fecha": "2026-09-01",
        "horas": None,
        "idestado": None,
        "estado": None,
        "estado_nombre": None,
        "descripcion": None,
    }


def test_tarja_detalle_muestra_alta_y_la_incluye_en_filtro_novedades(db_session):
    user = User(nombre="Tester", email="tarja-detalle-alta@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra Alta", responsable_id=user.id)
    db_session.add(proyecto)
    db_session.flush()
    alta = Nomina(nombre="Rodrigo", apellido="Neto", dni="20551562", idproyecto=proyecto.id)
    presente = Nomina(nombre="Juan", apellido="Perez", dni="20999999", idproyecto=proyecto.id)
    estado_alta = ParteDiarioEstado(abreviatura="ALT", nombre="ALTA", activo=False)
    estado_presente = ParteDiarioEstado(abreviatura="P", nombre="PRESENTE")
    db_session.add_all([alta, presente, estado_alta, estado_presente])
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 8, 26),
        fechafinal=date(2026, 9, 10),
    )
    db_session.add(tarja)
    db_session.flush()
    db_session.add_all([
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=alta.id,
            fecha_desde=date(2026, 8, 28),
            fecha_hasta=tarja.fechafinal,
        ),
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=presente.id,
            fecha_desde=tarja.fechainicio,
            fecha_hasta=tarja.fechafinal,
        ),
    ])
    parte = ParteDiario(
        idproyecto=proyecto.id,
        fecha=date(2026, 8, 28),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.flush()
    detalle_alta = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=alta.id,
        idestado=estado_alta.id,
        horas=Decimal("0"),
        descripcion="1",
    )
    db_session.add(detalle_alta)
    db_session.flush()
    tarja_detalle_alta = TarjaDetalle(
        tarja_id=tarja.id,
        idnomina=alta.id,
        fecha=parte.fecha,
        idestado=estado_presente.id,
        horas=Decimal("9"),
        parte_diario_detalle_id=detalle_alta.id,
    )
    db_session.add_all([
        tarja_detalle_alta,
        TarjaDetalle(
            tarja_id=tarja.id,
            idnomina=presente.id,
            fecha=parte.fecha,
            idestado=estado_presente.id,
            horas=Decimal("9"),
        ),
    ])
    db_session.commit()
    response = Response()

    rows = list_tarja_detalle(
        Request({"type": "http", "query_string": b""}),
        response,
        db_session,
        sort=None,
        range=None,
        filter=json.dumps({"tarja_id": tarja.id, "parte_novedades": True}),
        q=None,
    )

    assert response.headers["Content-Range"] == "items 0-0/1"
    assert len(rows) == 1
    assert rows[0]["empleado"] == "Neto, Rodrigo"
    assert rows[0]["D03"] == {
        "detalle_id": tarja_detalle_alta.id,
        "fecha": "2026-08-28",
        "horas": 9.0,
        "idestado": estado_alta.id,
        "estado": "ALT",
        "estado_nombre": "ALTA",
        "descripcion": None,
    }


def test_detalle_novedad_incluye_nomina_y_novedad_complementaria(db_session):
    user = User(nombre="Tester", email="detalle-novedad@example.com")
    db_session.add(user)
    db_session.flush()
    origen = Proyecto(nombre="Obra origen", responsable_id=user.id)
    destino = Proyecto(nombre="Obra destino", responsable_id=user.id)
    db_session.add_all([origen, destino])
    db_session.flush()
    empleado = Nomina(
        nombre="Juan",
        apellido="Perez",
        dni="30111222",
        nro_legajo="L-10",
        idproyecto=origen.id,
        fecha_ingreso=date(2026, 8, 1),
        fecha_egreso=date(2026, 12, 31),
    )
    presente = ParteDiarioEstado(abreviatura="P", nombre="PRESENTE")
    db_session.add_all([empleado, presente])
    db_session.flush()
    tarja = Tarja(
        idproyecto=origen.id,
        fechainicio=date(2026, 9, 11),
        fechafinal=date(2026, 9, 25),
    )
    db_session.add(tarja)
    db_session.flush()
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=empleado.id,
            fecha_desde=date(2026, 9, 11),
            fecha_hasta=date(2026, 9, 25),
        )
    )
    parte_origen = ParteDiario(
        idproyecto=origen.id,
        fecha=date(2026, 9, 17),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    parte_destino = ParteDiario(
        idproyecto=destino.id,
        fecha=date(2026, 9, 17),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add_all([parte_origen, parte_destino])
    db_session.flush()
    detalle_destino = ParteDiarioDetalle(
        parte_diario_id=parte_destino.id,
        idnomina=empleado.id,
        idestado=presente.id,
        horas=Decimal("4"),
        descripcion=f"Trabajo temporal desde obra #{origen.id}",
    )
    detalle_origen = ParteDiarioDetalle(
        parte_diario_id=parte_origen.id,
        idnomina=empleado.id,
        idestado=presente.id,
        horas=Decimal("5"),
        descripcion=(
            json.dumps(
                {
                    "tipo": "trabajo_destino",
                    "horas": 4,
                    "destino": {"idproyecto": destino.id, "obra": destino.nombre},
                }
            )
            + f" [parte_diario_destino_id={parte_destino.id}]"
        ),
    )
    db_session.add_all([detalle_origen, detalle_destino])
    db_session.flush()
    detalle_tarja = TarjaDetalle(
        tarja_id=tarja.id,
        idnomina=empleado.id,
        fecha=date(2026, 9, 17),
        idestado=presente.id,
        horas=Decimal("5"),
        descripcion=detalle_origen.descripcion,
        parte_diario_detalle_id=detalle_origen.id,
    )
    db_session.add(detalle_tarja)
    db_session.commit()

    result = get_tarja_detalle_novedad(int(detalle_tarja.id), db_session)

    assert result["novedad"]["codigo"] == "OTR"
    assert result["novedad"]["parte"]["obra"] == "Obra origen"
    assert result["complementaria"]["id"] == detalle_destino.id
    assert result["complementaria"]["parte"]["obra"] == "Obra destino"
    assert result["complementaria"]["horas"] == 4.0
    assert result["nomina"]["fecha_ingreso"] == "2026-08-01"
    assert result["nomina"]["fecha_egreso"] == "2026-12-31"
    assert result["nomina"]["vigencia_tarja_desde"] == "2026-09-11"


def test_horas_superiores_a_la_jornada_se_muestran_como_ext(db_session):
    user = User(nombre="Tester", email="horas-extra@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra extras", responsable_id=user.id)
    db_session.add(proyecto)
    db_session.flush()
    empleado = Nomina(
        nombre="Xavier",
        apellido="Delgado",
        dni="42253181",
        idproyecto=proyecto.id,
    )
    presente = ParteDiarioEstado(abreviatura="P", nombre="PRESENTE")
    db_session.add_all([empleado, presente])
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 8, 26),
        fechafinal=date(2026, 9, 10),
    )
    db_session.add(tarja)
    db_session.flush()
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=empleado.id,
            fecha_desde=tarja.fechainicio,
            fecha_hasta=tarja.fechafinal,
        )
    )
    parte = ParteDiario(
        idproyecto=proyecto.id,
        fecha=date(2026, 9, 1),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.flush()
    detalle_parte = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=empleado.id,
        idestado=presente.id,
        horas=Decimal("12"),
    )
    db_session.add(detalle_parte)
    db_session.flush()
    detalle_tarja = TarjaDetalle(
        tarja_id=tarja.id,
        idnomina=empleado.id,
        fecha=parte.fecha,
        idestado=presente.id,
        horas=Decimal("12"),
        parte_diario_detalle_id=detalle_parte.id,
    )
    db_session.add(detalle_tarja)
    db_session.commit()

    response = Response()
    rows = list_tarja_detalle(
        Request({"type": "http", "query_string": b""}),
        response,
        db_session,
        sort=None,
        range=None,
        filter=json.dumps({"tarja_id": tarja.id, "parte_novedades": True}),
        q=None,
    )
    result = get_tarja_detalle_novedad(int(detalle_tarja.id), db_session)

    assert [row["idnomina"] for row in rows] == [empleado.id]
    assert result["novedad"]["codigo"] == "EXT"
    assert result["novedad"]["estado"] == "HORAS EXTRAS"
    assert result["novedad"]["jornada_esperada"] == 9.0
    assert result["novedad"]["horas_extra"] == 3.0
