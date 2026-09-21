import json
from datetime import date

from starlette.responses import Response

from app.models import CRMContacto, Nomina, Proyecto, User
from app.models.tarja import Tarja, TarjaNomina
from app.routers.partediario_router import list_nomina_disponible_para_parte


def _seed_context(session):
    user = User(nombre="Tester", email="nomina-disponible@example.com")
    session.add(user)
    session.flush()
    contacto = CRMContacto(
        nombre_completo="Encargado",
        telefonos=["549111111"],
        responsable_id=user.id,
    )
    proyecto = Proyecto(nombre="Obra", responsable_id=user.id)
    session.add_all([contacto, proyecto])
    session.flush()
    return proyecto, contacto


def _list(session, *, proyecto_id: int, contacto_id: int, fecha: date):
    response = Response()
    result = list_nomina_disponible_para_parte(
        response=response,
        session=session,
        sort=json.dumps(["apellido", "ASC"]),
        range=json.dumps([0, 99]),
        filter=json.dumps(
            {
                "idproyecto": proyecto_id,
                "contacto_id": contacto_id,
                "fecha": fecha.isoformat(),
            }
        ),
        q=None,
    )
    return result, response


def test_nomina_disponible_excluye_alta_posterior_a_la_fecha(db_session):
    proyecto, contacto = _seed_context(db_session)
    vigente = Nomina(
        nombre="Pedro",
        apellido="Vigente",
        dni="100",
        idproyecto=proyecto.id,
        encargado_contacto_id=contacto.id,
        fecha_ingreso=date(2026, 8, 1),
    )
    posterior = Nomina(
        nombre="Raul",
        apellido="Posterior",
        dni="200",
        idproyecto=proyecto.id,
        encargado_contacto_id=contacto.id,
        fecha_ingreso=date(2026, 8, 27),
    )
    db_session.add_all([vigente, posterior])
    db_session.commit()

    rows, response = _list(
        db_session,
        proyecto_id=int(proyecto.id),
        contacto_id=int(contacto.id),
        fecha=date(2026, 8, 26),
    )

    assert [row["id"] for row in rows] == [vigente.id]
    assert response.headers["Content-Range"] == "items 0-0/1"


def test_nomina_disponible_respeta_snapshot_historico_de_tarja(db_session):
    proyecto, contacto = _seed_context(db_session)
    historico = Nomina(
        nombre="Ana",
        apellido="Historica",
        dni="300",
        idproyecto=None,
        encargado_contacto_id=None,
        activo=False,
        fecha_egreso=date(2026, 8, 20),
    )
    actual = Nomina(
        nombre="Luis",
        apellido="Actual",
        dni="400",
        idproyecto=proyecto.id,
        encargado_contacto_id=contacto.id,
    )
    db_session.add_all([historico, actual])
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fechainicio=date(2026, 8, 26),
        fechafinal=date(2026, 9, 10),
    )
    db_session.add(tarja)
    db_session.flush()
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=historico.id,
            fecha_desde=date(2026, 8, 26),
            fecha_hasta=date(2026, 9, 10),
        )
    )
    db_session.commit()

    rows, _ = _list(
        db_session,
        proyecto_id=int(proyecto.id),
        contacto_id=int(contacto.id),
        fecha=date(2026, 8, 26),
    )

    assert [row["id"] for row in rows] == [historico.id]
