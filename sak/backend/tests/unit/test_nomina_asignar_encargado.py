from sqlmodel import select

from app.models import CRMContacto, Nomina, Proyecto, User
from app.models.crm.catalogos import CRMTipoContacto
from app.models.proyecto_encargado import ProyectoEncargado
from app.routers.nomina_router import (
    NominaAsignarEncargadoRequest,
    asignar_encargado_a_nomina,
)


def test_asignar_encargado_actualiza_nomina_y_crea_relaciones_faltantes(db_session) -> None:
    user = User(nombre="Asignador", email="asignador-nomina@example.com")
    tipo = CRMTipoContacto(nombre="Encargado", activo=True)
    db_session.add_all([user, tipo])
    db_session.flush()
    encargado = CRMContacto(
        nombre_completo="Encargado General",
        responsable_id=user.id,
        tipo_id=tipo.id,
    )
    proyecto_uno = Proyecto(nombre="Obra Uno", responsable_id=user.id)
    proyecto_dos = Proyecto(nombre="Obra Dos", responsable_id=user.id)
    db_session.add_all([encargado, proyecto_uno, proyecto_dos])
    db_session.flush()
    empleado_uno = Nomina(
        nombre="Juan",
        apellido="Perez",
        dni="81000001",
        idproyecto=proyecto_uno.id,
    )
    empleado_dos = Nomina(
        nombre="Ana",
        apellido="Gomez",
        dni="81000002",
        idproyecto=proyecto_dos.id,
    )
    empleado_sin_proyecto = Nomina(
        nombre="Luis",
        apellido="Libre",
        dni="81000003",
    )
    db_session.add_all([empleado_uno, empleado_dos, empleado_sin_proyecto])
    db_session.flush()
    relacion_existente = ProyectoEncargado(
        proyecto_id=proyecto_uno.id,
        contacto_id=encargado.id,
        principal=True,
    )
    db_session.add(relacion_existente)
    db_session.commit()

    result = asignar_encargado_a_nomina(
        NominaAsignarEncargadoRequest(
            nomina_ids=[empleado_uno.id, empleado_dos.id, empleado_sin_proyecto.id],
            proyecto_id=proyecto_dos.id,
            contacto_id=encargado.id,
        ),
        db_session,
    )

    assert result["empleados_actualizados"] == 3
    assert result["relaciones_creadas"] == 1
    for empleado in (empleado_uno, empleado_dos, empleado_sin_proyecto):
        db_session.refresh(empleado)
        assert empleado.encargado_contacto_id == encargado.id
        assert empleado.idproyecto == proyecto_dos.id

    relaciones = list(
        db_session.exec(
            select(ProyectoEncargado)
            .where(ProyectoEncargado.contacto_id == encargado.id)
            .where(ProyectoEncargado.deleted_at.is_(None))
        ).all()
    )
    assert len(relaciones) == 2
    por_proyecto = {item.proyecto_id: item for item in relaciones}
    assert por_proyecto[proyecto_uno.id].principal is True
    assert por_proyecto[proyecto_dos.id].principal is False
