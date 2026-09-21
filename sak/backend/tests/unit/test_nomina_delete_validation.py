from datetime import date

import pytest
from fastapi import HTTPException

from app.models import Nomina, Proyecto, User
from app.models.tarja import Tarja, TarjaNomina
from app.routers.nomina_router import nomina_crud


def test_nomina_no_se_elimina_si_pertenece_a_tarja_nomina(db_session) -> None:
    user = User(nombre="Validador Nomina", email="validador-nomina@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra validacion", responsable_id=user.id)
    empleado = Nomina(nombre="Juan", apellido="Perez", dni="99112233")
    db_session.add_all([proyecto, empleado])
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
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
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        nomina_crud.delete(db_session, empleado.id)

    assert exc_info.value.status_code == 400
    assert "Tarja Nomina" in exc_info.value.detail["error"]["message"]
    db_session.refresh(empleado)
    assert empleado.deleted_at is None


def test_nomina_sin_tarja_nomina_se_elimina(db_session) -> None:
    empleado = Nomina(nombre="Ana", apellido="Libre", dni="99445566")
    db_session.add(empleado)
    db_session.commit()

    assert nomina_crud.delete(db_session, empleado.id) is True
    db_session.refresh(empleado)
    assert empleado.deleted_at is not None
