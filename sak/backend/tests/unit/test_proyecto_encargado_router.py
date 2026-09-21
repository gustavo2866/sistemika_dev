from app.models.crm.contacto import CRMContacto
from app.models.proyecto import Proyecto
from app.models.proyecto_encargado import ProyectoEncargado
from app.models.user import User
from app.routers.proyecto_encargado_router import proyecto_encargado_crud


def test_buscar_proyecto_encargado_por_obra_o_encargado(db_session) -> None:
    user = User(
        nombre="Proyecto Encargado Tester",
        email="proyecto-encargado-test@example.com",
    )
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Gustavo Busqueda",
        responsable_id=user.id,
    )
    proyecto = Proyecto(
        nombre="Obra Las Acacias",
        estado="en_ejecucion",
        responsable_id=user.id,
    )
    db_session.add_all([contacto, proyecto])
    db_session.flush()
    asignacion = ProyectoEncargado(
        proyecto_id=proyecto.id,
        contacto_id=contacto.id,
        activo=True,
    )
    db_session.add(asignacion)
    db_session.commit()

    por_obra, total_obra = proyecto_encargado_crud.list(
        db_session,
        filters={"q": "Acacias", "activo": True},
    )
    assert total_obra == 1
    assert [item.id for item in por_obra] == [asignacion.id]

    por_encargado, total_encargado = proyecto_encargado_crud.list(
        db_session,
        filters={"q": "Gustavo", "activo": True},
    )
    assert total_encargado == 1
    assert [item.id for item in por_encargado] == [asignacion.id]


def test_filtrar_encargados_por_estado_del_proyecto(db_session) -> None:
    user = User(
        nombre="Filtro Estado Proyecto",
        email="filtro-estado-proyecto@example.com",
    )
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Encargado Estado",
        responsable_id=user.id,
    )
    proyecto_activo = Proyecto(
        nombre="Obra en ejecucion",
        estado="02-ejecucion",
        responsable_id=user.id,
    )
    proyecto_terminado = Proyecto(
        nombre="Obra terminada",
        estado="04-terminados",
        responsable_id=user.id,
    )
    db_session.add_all([contacto, proyecto_activo, proyecto_terminado])
    db_session.flush()
    asignacion_activa = ProyectoEncargado(
        proyecto_id=proyecto_activo.id,
        contacto_id=contacto.id,
        activo=True,
    )
    asignacion_terminada = ProyectoEncargado(
        proyecto_id=proyecto_terminado.id,
        contacto_id=contacto.id,
        activo=False,
    )
    db_session.add_all([asignacion_activa, asignacion_terminada])
    db_session.commit()

    items, total = proyecto_encargado_crud.list(
        db_session,
        filters={"proyecto_estado": "02-ejecucion"},
    )

    assert total == 1
    assert [item.id for item in items] == [asignacion_activa.id]
