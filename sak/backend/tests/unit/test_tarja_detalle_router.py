from datetime import date
from decimal import Decimal

from starlette.requests import Request
from starlette.responses import Response

from app.models import Nomina, Proyecto, User
from app.models.nomina_catalogos import NominaCategoria, NominaTarea
from app.models.tarja import Tarja, TarjaNomina
from app.routers.tarja_detalle_router import list_tarja_detalle


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
