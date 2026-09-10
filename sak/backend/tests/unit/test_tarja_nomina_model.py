from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import event

from app.models import (
    CRMContacto,
    EstadoParteDiario,
    Nomina,
    ParteDiario,
    ParteDiarioDetalle,
    Proyecto,
    User,
)
from app.models.nomina_catalogos import NominaCategoria, NominaTarea
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.proyecto_encargado import ProyectoEncargado
from app.models.tarja import Tarja, TarjaDetalle, TarjaNomina
from app.routers.nomina_router import nomina_crud
from app.routers.tarja_nomina_router import (
    TarjaNominaTrasladoRequest,
    tarja_nomina_crud,
    tarja_nomina_router,
)


def test_tarja_nomina_model_and_router_are_defined():
    assert TarjaNomina.__tablename__ == "tarja_nomina"
    assert hasattr(TarjaNomina, "tarja_id")
    assert hasattr(TarjaNomina, "nomina_id")
    assert hasattr(TarjaNomina, "presentismo")
    assert hasattr(TarjaNomina, "presentismo_importe")
    assert hasattr(TarjaNomina, "adicional_importe")
    assert hasattr(TarjaNomina, "premio_importe")
    assert hasattr(TarjaNomina, "premio")
    assert hasattr(TarjaNomina, "viatico")
    assert hasattr(TarjaNomina, "viatico_importe")
    assert hasattr(TarjaNomina, "sueldo_importe")
    assert hasattr(TarjaNomina, "mejora_importe")
    assert hasattr(TarjaNomina, "cargas_importe")
    assert hasattr(TarjaNomina, "fecha_desde")
    assert hasattr(TarjaNomina, "fecha_hasta")
    assert not hasattr(TarjaNomina, "activo")
    assert TarjaNomina.__auto_include_relations__ == []
    assert tarja_nomina_router.prefix == "/tarja-nomina"


def test_tarja_nomina_list_resolves_simple_fks_in_one_query(db_session):
    user = User(nombre="Tester", email="tarja-nomina-list@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Encargado Test",
        telefonos=[],
        responsable_id=user.id,
    )
    proyecto = Proyecto(nombre="Obra Test", responsable_id=user.id)
    categoria = NominaCategoria(codigo="OF", descripcion="Oficial")
    tarea = NominaTarea(codigo="ALB", descripcion="Albanileria")
    db_session.add_all([contacto, proyecto, categoria, tarea])
    db_session.flush()
    empleado = Nomina(
        nombre="Juan",
        apellido="Perez",
        dni="12345678",
        idproyecto=proyecto.id,
        encargado_contacto_id=contacto.id,
    )
    db_session.add(empleado)
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
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
        horas_justificadas=Decimal("2"),
        adicional_importe=Decimal("100"),
        fecha_desde=tarja.fechainicio,
        fecha_hasta=tarja.fechafinal,
    )
    db_session.add(registro)
    estado = ParteDiarioEstado(
        abreviatura="P",
        nombre="Presente",
    )
    db_session.add(estado)
    db_session.flush()
    detalle = TarjaDetalle(
        tarja_id=tarja.id,
        idnomina=empleado.id,
        fecha=date(2026, 9, 1),
        idestado=estado.id,
        horas=Decimal("9"),
        descripcion="Jornada completa",
    )
    db_session.add(detalle)
    db_session.commit()
    tarja_id = int(tarja.id)

    statements: list[str] = []

    def record_statement(_conn, _cursor, statement, _params, _context, _many):
        statements.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        items, total = tarja_nomina_crud.list(
            db_session,
            page=1,
            per_page=10,
            sort_by="id",
            filters={
                "tarja_id": tarja_id,
                "q": "Perez",
                "bonos": True,
                "parte_novedades": True,
            },
        )
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)

    assert len(statements) == 1
    assert total == 1
    assert len(items) == 1
    assert items[0].empleado == "Perez, Juan"
    assert items[0].dni == "12345678"
    assert items[0].categoria_codigo == "OF"
    assert items[0].actividad_codigo == "ALB"
    assert items[0].obra == "Obra Test"
    assert items[0].encargado == "Encargado Test"
    assert items[0].proyecto_id == proyecto.id
    assert items[0].encargado_id == contacto.id
    assert items[0].D01 == {
        "detalle_id": detalle.id,
        "fecha": "2026-09-01",
        "horas": 9.0,
        "idestado": estado.id,
        "estado": "P",
        "estado_nombre": "Presente",
        "descripcion": "Jornada completa",
    }
    assert items[0].D02["fecha"] == "2026-09-02"
    assert items[0].D02["horas"] is None


def test_tarja_nomina_list_marks_alta_as_not_editable(db_session):
    user = User(nombre="Tester", email="tarja-nomina-alta-list@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra Alta", responsable_id=user.id)
    empleado = Nomina(nombre="Ana", apellido="Alta", dni="30111111")
    estado_alta = ParteDiarioEstado(abreviatura="ALT", nombre="Alta", activo=False)
    db_session.add_all([proyecto, empleado, estado_alta])
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
        fecha_desde=date(2026, 9, 5),
        fecha_hasta=date(2026, 9, 15),
    )
    db_session.add(registro)
    db_session.flush()
    parte = ParteDiario(
        idproyecto=proyecto.id,
        fecha=date(2026, 9, 5),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=empleado.id,
            idestado=estado_alta.id,
            horas=Decimal("0"),
            descripcion=str(registro.id),
        )
    )
    db_session.commit()

    items, total = tarja_nomina_crud.list(db_session, page=1, per_page=10, sort_by="id")

    assert total == 1
    assert items[0].tipo_novedad == "ALT"
    assert items[0].editable is False
    with pytest.raises(ValueError, match="no se pueden editar"):
        tarja_nomina_crud.update(
            db_session,
            registro.id,
            {"observaciones": "No permitido"},
        )


def test_tarja_nomina_list_marks_inactive_event_as_not_editable(db_session):
    user = User(nombre="Tester", email="tarja-nomina-inactive-list@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra Baja", responsable_id=user.id)
    empleado = Nomina(nombre="Ana", apellido="Baja", dni="30121212")
    estado_baja = ParteDiarioEstado(abreviatura="BAJ", nombre="Baja", activo=False)
    db_session.add_all([proyecto, empleado, estado_baja])
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
        fecha_desde=date(2026, 9, 1),
        fecha_hasta=date(2026, 9, 10),
    )
    db_session.add(registro)
    db_session.flush()
    parte = ParteDiario(
        idproyecto=proyecto.id,
        fecha=date(2026, 9, 10),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=empleado.id,
            idestado=estado_baja.id,
            horas=Decimal("0"),
            descripcion=str(registro.id),
        )
    )
    db_session.commit()

    items, total = tarja_nomina_crud.list(db_session, page=1, per_page=10, sort_by="id")

    assert total == 1
    assert items[0].tipo_novedad == "BAJ"
    assert items[0].editable is False
    with pytest.raises(ValueError, match="no se pueden editar"):
        tarja_nomina_crud.update(
            db_session,
            registro.id,
            {"observaciones": "No permitido"},
        )


def test_tarja_nomina_delete_alta_removes_related_records(db_session):
    user = User(nombre="Tester", email="tarja-nomina-alta-delete@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra Alta Delete", responsable_id=user.id)
    empleado = Nomina(nombre="Ana", apellido="Alta", dni="30222222")
    estado_alta = ParteDiarioEstado(abreviatura="ALT", nombre="Alta", activo=False)
    estado_presente = ParteDiarioEstado(abreviatura="P", nombre="Presente", activo=True)
    db_session.add_all([proyecto, empleado, estado_alta, estado_presente])
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
        fecha_desde=date(2026, 9, 5),
        fecha_hasta=date(2026, 9, 15),
    )
    db_session.add(registro)
    db_session.flush()
    parte = ParteDiario(
        idproyecto=proyecto.id,
        fecha=date(2026, 9, 5),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.flush()
    parte_detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=empleado.id,
        idestado=estado_alta.id,
        horas=Decimal("0"),
        descripcion=str(registro.id),
    )
    tarja_detalle = TarjaDetalle(
        tarja_id=tarja.id,
        idnomina=empleado.id,
        fecha=date(2026, 9, 5),
        idestado=estado_presente.id,
        horas=Decimal("9"),
    )
    db_session.add(parte_detalle)
    db_session.add(tarja_detalle)
    db_session.commit()

    assert tarja_nomina_crud.delete(db_session, registro.id) is True

    db_session.refresh(registro)
    db_session.refresh(parte_detalle)
    db_session.refresh(tarja_detalle)
    db_session.refresh(empleado)
    assert registro.deleted_at is not None
    assert parte_detalle.deleted_at is not None
    assert tarja_detalle.deleted_at is not None
    assert empleado.deleted_at is not None
    assert empleado.activo is False


def test_tarja_nomina_delete_alta_preserves_employee_with_other_nomina(db_session):
    user = User(nombre="Tester", email="tarja-nomina-alta-delete-other@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra Alta Preserve", responsable_id=user.id)
    empleado = Nomina(nombre="Ana", apellido="Alta", dni="30333333")
    estado_alta = ParteDiarioEstado(abreviatura="ALT", nombre="Alta", activo=False)
    db_session.add_all([proyecto, empleado, estado_alta])
    db_session.flush()
    tarja_1 = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )
    tarja_2 = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 9, 16),
        fechafinal=date(2026, 9, 30),
    )
    db_session.add_all([tarja_1, tarja_2])
    db_session.flush()
    registro_alta = TarjaNomina(
        tarja_id=tarja_1.id,
        nomina_id=empleado.id,
        fecha_desde=date(2026, 9, 5),
        fecha_hasta=date(2026, 9, 15),
    )
    registro_otro = TarjaNomina(
        tarja_id=tarja_2.id,
        nomina_id=empleado.id,
        fecha_desde=date(2026, 9, 16),
        fecha_hasta=date(2026, 9, 30),
    )
    db_session.add_all([registro_alta, registro_otro])
    db_session.flush()
    parte = ParteDiario(
        idproyecto=proyecto.id,
        fecha=date(2026, 9, 5),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=empleado.id,
            idestado=estado_alta.id,
            horas=Decimal("0"),
            descripcion=str(registro_alta.id),
        )
    )
    db_session.commit()

    assert tarja_nomina_crud.delete(db_session, registro_alta.id) is True

    db_session.refresh(empleado)
    db_session.refresh(registro_otro)
    assert empleado.deleted_at is None
    assert empleado.activo is True
    assert registro_otro.deleted_at is None


def test_nomina_filter_excludes_every_employee_assigned_to_a_project(db_session):
    user = User(nombre="Tester", email="tarja-nomina-options@example.com")
    db_session.add(user)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra opciones", responsable_id=user.id)
    otro_proyecto = Proyecto(nombre="La Rioja", responsable_id=user.id)
    categoria = NominaCategoria(codigo="AY", descripcion="Ayudante")
    tarea = NominaTarea(codigo="PIN", descripcion="Pintura")
    db_session.add_all([proyecto, otro_proyecto, categoria, tarea])
    db_session.flush()
    incluido = Nomina(
        nombre="Jose Luis",
        apellido="Arias",
        dni="20111111",
        idproyecto=otro_proyecto.id,
    )
    incluido_en_destino = Nomina(
        nombre="Ana",
        apellido="Asignada",
        dni="20444444",
        idproyecto=proyecto.id,
    )
    disponible = Nomina(nombre="Beto", apellido="Disponible", dni="20222222")
    db_session.add_all([incluido, incluido_en_destino, disponible])
    db_session.flush()
    tarja = Tarja(
        idproyecto=proyecto.id,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )
    db_session.add(tarja)
    db_session.flush()
    db_session.commit()

    items, total = nomina_crud.list(
        db_session,
        page=1,
        per_page=10,
        sort_by="id",
        filters={
            "activo": True,
            "idproyecto": None,
        },
    )

    assert total == 1
    assert [item.id for item in items] == [disponible.id]

    nuevo = tarja_nomina_crud.create(
        db_session,
        {
            "tarja_id": tarja.id,
            "nomina_id": disponible.id,
            "nomina_categoria_id": categoria.id,
            "nomina_tarea_id": tarea.id,
            "fecha_desde": "2026-09-01",
            "fecha_hasta": "2026-09-15",
        },
    )
    db_session.refresh(disponible)

    assert nuevo.nomina_id == disponible.id
    assert disponible.idproyecto == proyecto.id
    assert disponible.nomina_categoria_id == categoria.id
    assert disponible.nomina_tarea_id == tarea.id
    assert disponible.fecha_ingreso == date(2026, 9, 1)
    assert disponible.fecha_egreso is None
    assert disponible.activo is True


def test_tarja_nomina_create_transfers_employee_transactionally(db_session):
    user = User(nombre="Tester", email="tarja-nomina-transfer@example.com")
    db_session.add(user)
    db_session.flush()
    encargado_anterior = CRMContacto(
        nombre_completo="Encargado anterior",
        telefonos=[],
        responsable_id=user.id,
    )
    encargado_actual = CRMContacto(
        nombre_completo="Encargado actual",
        telefonos=[],
        responsable_id=user.id,
    )
    proyecto_anterior = Proyecto(nombre="Obra anterior", responsable_id=user.id)
    proyecto_actual = Proyecto(nombre="Obra actual", responsable_id=user.id)
    db_session.add_all(
        [encargado_anterior, encargado_actual, proyecto_anterior, proyecto_actual]
    )
    db_session.flush()
    empleado = Nomina(
        nombre="Carla",
        apellido="Transferida",
        dni="20333333",
        idproyecto=proyecto_anterior.id,
        encargado_contacto_id=encargado_anterior.id,
    )
    db_session.add(empleado)
    db_session.flush()
    tarja_anterior = Tarja(
        idproyecto=proyecto_anterior.id,
        contacto_id=encargado_anterior.id,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )
    tarja_actual = Tarja(
        idproyecto=proyecto_actual.id,
        contacto_id=encargado_actual.id,
        fechainicio=date(2026, 9, 10),
        fechafinal=date(2026, 9, 24),
    )
    db_session.add_all([tarja_anterior, tarja_actual])
    db_session.flush()
    registro_anterior = TarjaNomina(
        tarja_id=tarja_anterior.id,
        nomina_id=empleado.id,
        fecha_desde=tarja_anterior.fechainicio,
        fecha_hasta=tarja_anterior.fechafinal,
    )
    db_session.add(registro_anterior)
    db_session.commit()

    payload = {
        "tarja_id": tarja_actual.id,
        "nomina_id": empleado.id,
        "fecha_desde": "2026-09-10",
        "fecha_hasta": "2026-09-24",
    }
    with pytest.raises(ValueError, match="dentro de la quincena"):
        tarja_nomina_crud.create(
            db_session,
            {**payload, "fecha_desde": "2026-09-25"},
        )

    try:
        tarja_nomina_crud.create(db_session, payload)
        assert False, "El traspaso sin confirmacion debe rechazarse"
    except ValueError as exc:
        assert "Confirme el traspaso" in str(exc)

    nuevo = tarja_nomina_crud.create(
        db_session,
        {**payload, "confirmar_traspaso": True},
    )
    db_session.refresh(registro_anterior)
    db_session.refresh(empleado)

    assert registro_anterior.fecha_hasta == date(2026, 9, 10)
    assert nuevo.fecha_desde == date(2026, 9, 10)
    assert nuevo.fecha_hasta == date(2026, 9, 24)
    assert empleado.idproyecto == proyecto_actual.id
    assert empleado.encargado_contacto_id == encargado_actual.id


def test_tarja_nomina_traslado_creates_destination_tarja_and_moves_employee(db_session):
    user = User(nombre="Tester", email="tarja-nomina-move@example.com")
    db_session.add(user)
    db_session.flush()
    encargado_origen = CRMContacto(
        nombre_completo="Encargado origen traslado",
        telefonos=[],
        responsable_id=user.id,
    )
    encargado_destino = CRMContacto(
        nombre_completo="Encargado destino traslado",
        telefonos=[],
        responsable_id=user.id,
    )
    proyecto_origen = Proyecto(nombre="Obra origen traslado", responsable_id=user.id)
    proyecto_destino = Proyecto(nombre="Obra destino traslado", responsable_id=user.id)
    categoria = NominaCategoria(codigo="TR", descripcion="Traslado")
    tarea = NominaTarea(codigo="TRA", descripcion="Trabajo traslado")
    db_session.add_all(
        [
            encargado_origen,
            encargado_destino,
            proyecto_origen,
            proyecto_destino,
            categoria,
            tarea,
        ]
    )
    db_session.flush()
    asignacion_destino = ProyectoEncargado(
        proyecto_id=proyecto_destino.id,
        contacto_id=encargado_destino.id,
        activo=True,
    )
    empleado = Nomina(
        nombre="Mario",
        apellido="Movido",
        dni="20555555",
        idproyecto=proyecto_origen.id,
        encargado_contacto_id=encargado_origen.id,
        nomina_categoria_id=categoria.id,
        nomina_tarea_id=tarea.id,
    )
    db_session.add_all([asignacion_destino, empleado])
    db_session.flush()
    tarja_origen = Tarja(
        idproyecto=proyecto_origen.id,
        contacto_id=encargado_origen.id,
        fechainicio=date(2026, 9, 1),
        fechafinal=date(2026, 9, 15),
    )
    db_session.add(tarja_origen)
    db_session.flush()
    registro_origen = TarjaNomina(
        tarja_id=tarja_origen.id,
        nomina_id=empleado.id,
        nomina_categoria_id=categoria.id,
        nomina_tarea_id=tarea.id,
        fecha_desde=date(2026, 9, 1),
        fecha_hasta=date(2026, 9, 15),
    )
    db_session.add(registro_origen)
    db_session.commit()

    with pytest.raises(ValueError, match="dentro de la quincena"):
        tarja_nomina_crud.trasladar(
            db_session,
            registro_origen.id,
            TarjaNominaTrasladoRequest(
                proyecto_id=proyecto_destino.id,
                proyecto_encargado_id=asignacion_destino.id,
                fecha=date(2026, 9, 16),
            ),
        )

    origen, destino, tarja_destino = tarja_nomina_crud.trasladar(
        db_session,
        registro_origen.id,
        TarjaNominaTrasladoRequest(
            proyecto_id=proyecto_destino.id,
            proyecto_encargado_id=asignacion_destino.id,
            fecha=date(2026, 9, 8),
        ),
    )
    db_session.refresh(empleado)

    assert origen.fecha_hasta == date(2026, 9, 8)
    assert tarja_destino.idproyecto == proyecto_destino.id
    assert tarja_destino.contacto_id == encargado_destino.id
    assert tarja_destino.fechainicio == date(2026, 9, 1)
    assert tarja_destino.fechafinal == date(2026, 9, 15)
    assert destino.tarja_id == tarja_destino.id
    assert destino.nomina_id == empleado.id
    assert destino.fecha_desde == date(2026, 9, 8)
    assert destino.fecha_hasta == date(2026, 9, 15)
    assert empleado.idproyecto == proyecto_destino.id
    assert empleado.encargado_contacto_id == encargado_destino.id

    with pytest.raises(ValueError, match="ya existe"):
        tarja_nomina_crud.trasladar(
            db_session,
            registro_origen.id,
            TarjaNominaTrasladoRequest(
                proyecto_id=proyecto_destino.id,
                proyecto_encargado_id=asignacion_destino.id,
                fecha=date(2026, 9, 9),
            ),
        )
