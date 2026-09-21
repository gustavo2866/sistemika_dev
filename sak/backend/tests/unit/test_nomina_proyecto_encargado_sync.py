from sqlmodel import select

from app.models import CRMContacto, Proyecto, User
from app.models.crm.catalogos import CRMTipoContacto
from app.models.proyecto_encargado import ProyectoEncargado
from app.routers.nomina_router import nomina_crud


def _crear_proyecto_y_encargado(db_session, suffix: str):
    user = User(
        nombre=f"Responsable {suffix}",
        email=f"responsable-{suffix}@example.com",
    )
    tipo = CRMTipoContacto(nombre="Encargado", activo=True)
    db_session.add_all([user, tipo])
    db_session.flush()
    proyecto = Proyecto(nombre=f"Obra {suffix}", responsable_id=user.id)
    encargado = CRMContacto(
        nombre_completo=f"Encargado {suffix}",
        responsable_id=user.id,
        tipo_id=tipo.id,
    )
    db_session.add_all([proyecto, encargado])
    db_session.flush()
    return proyecto, encargado


def test_crear_nomina_asegura_relacion_proyecto_encargado(db_session) -> None:
    proyecto, encargado = _crear_proyecto_y_encargado(db_session, "create")

    empleado = nomina_crud.create(
        db_session,
        {
            "nombre": "Juan",
            "apellido": "Perez",
            "dni": "82000001",
            "idproyecto": proyecto.id,
            "encargado_contacto_id": encargado.id,
        },
    )

    relacion = db_session.exec(
        select(ProyectoEncargado)
        .where(ProyectoEncargado.proyecto_id == proyecto.id)
        .where(ProyectoEncargado.contacto_id == encargado.id)
        .where(ProyectoEncargado.deleted_at.is_(None))
    ).one()
    assert empleado.id is not None
    assert relacion.principal is False
    assert relacion.activo is True


def test_editar_nomina_asegura_relacion_proyecto_encargado(db_session) -> None:
    proyecto, encargado = _crear_proyecto_y_encargado(db_session, "edit")
    empleado = nomina_crud.create(
        db_session,
        {
            "nombre": "Ana",
            "apellido": "Gomez",
            "dni": "82000002",
        },
    )

    actualizado = nomina_crud.update(
        db_session,
        empleado.id,
        {
            "idproyecto": proyecto.id,
            "encargado_contacto_id": encargado.id,
        },
    )

    relacion = db_session.exec(
        select(ProyectoEncargado)
        .where(ProyectoEncargado.proyecto_id == proyecto.id)
        .where(ProyectoEncargado.contacto_id == encargado.id)
        .where(ProyectoEncargado.deleted_at.is_(None))
    ).one()
    assert actualizado is not None
    assert actualizado.idproyecto == proyecto.id
    assert actualizado.encargado_contacto_id == encargado.id
    assert relacion.principal is False
