import json
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlmodel import select

from app.models import (
    CRMContacto,
    CRMMensaje,
    CRMOportunidad,
    EstadoParteDiario,
    Nomina,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
    Proyecto,
    ProyectoEncargado,
    User,
)
from app.models.tarja import EstadoTarja, Tarja, TarjaDetalle, TarjaNomina
from app.routers.nomina_router import nomina_crud
from app.routers.partediario_router import parte_diario_crud
from app.routers.tarja_detalle_router import _build_empty_days
from app.routers.tarja_nomina_router import tarja_nomina_crud
from app.services.parte_diario_estado_service import seed_parte_diario_estados
from app.services.parte_diario_service import parte_diario_service
from app.services.parte_diario_tarja_service import get_quincena_range, parte_diario_tarja_service


def _seed_base(session):
    user = User(nombre="Tester", email="tarja-parte@example.com")
    session.add(user)
    session.flush()
    contacto = CRMContacto(
        nombre_completo="Encargado",
        telefonos=["549111111"],
        responsable_id=user.id,
    )
    otro_contacto = CRMContacto(
        nombre_completo="Otro encargado",
        telefonos=["549222222"],
        responsable_id=user.id,
    )
    session.add(contacto)
    session.add(otro_contacto)
    session.flush()
    proyecto = Proyecto(nombre="Obra Tarja", responsable_id=user.id)
    session.add(proyecto)
    session.flush()
    nomina_con_novedad = Nomina(
        nombre="Juan",
        apellido="Falta",
        dni="tarja-parte-1",
        idproyecto=proyecto.id,
        encargado_contacto_id=contacto.id,
    )
    nomina_default = Nomina(
        nombre="Pedro",
        apellido="Presente",
        dni="tarja-parte-2",
        idproyecto=proyecto.id,
        encargado_contacto_id=contacto.id,
    )
    nomina_otro_encargado = Nomina(
        nombre="Luis",
        apellido="Otro",
        dni="tarja-parte-3",
        idproyecto=proyecto.id,
        encargado_contacto_id=otro_contacto.id,
    )
    session.add(nomina_con_novedad)
    session.add(nomina_default)
    session.add(nomina_otro_encargado)
    session.commit()
    seed_parte_diario_estados(session)
    return {
        "contacto": contacto,
        "otro_contacto": otro_contacto,
        "proyecto": proyecto,
        "nomina_con_novedad": nomina_con_novedad,
        "nomina_default": nomina_default,
        "nomina_otro_encargado": nomina_otro_encargado,
    }


def test_get_quincena_range_usa_esquema_26_10_y_11_25():
    assert get_quincena_range(date(2026, 9, 3)) == (
        date(2026, 8, 26),
        date(2026, 9, 10),
    )
    assert get_quincena_range(date(2026, 9, 11)) == (
        date(2026, 9, 11),
        date(2026, 9, 25),
    )
    assert get_quincena_range(date(2026, 9, 26)) == (
        date(2026, 9, 26),
        date(2026, 10, 10),
    )


def test_tarja_detalle_expone_d16_solo_para_primera_quincena():
    first_long = _build_empty_days(date(2026, 8, 26), date(2026, 9, 10))
    first_short = _build_empty_days(date(2026, 4, 26), date(2026, 5, 10))
    second = _build_empty_days(date(2026, 9, 11), date(2026, 9, 25))

    assert first_long["D16"]["fecha"] == "2026-09-10"
    assert first_short["D16"]["fecha"] is None
    assert "D16" not in second


def test_abrir_parte_confirmado_vuelve_a_borrador(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.commit()

    opened = parte_diario_tarja_service.abrir_parte(db_session, parte.id)

    assert opened.estado == EstadoParteDiario.BORRADOR


def test_confirmar_parte_borrador_pasa_a_confirmado(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.commit()

    closed = parte_diario_tarja_service.confirmar_parte(db_session, parte.id)

    assert closed.estado == EstadoParteDiario.CONFIRMADO


def test_confirmar_parte_borrador_genera_tarja_y_detalle_del_dia(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=data["nomina_con_novedad"].id,
        idestado=falta_estado.id,
        horas=Decimal("0"),
        descripcion="Falto",
    )
    db_session.add(detalle)
    db_session.commit()

    confirmed = parte_diario_tarja_service.confirmar_parte(db_session, parte.id)

    assert confirmed.estado == EstadoParteDiario.CONFIRMADO
    registros_nomina = db_session.exec(select(TarjaNomina)).all()
    assert {registro.nomina_id for registro in registros_nomina} == {
        data["nomina_con_novedad"].id,
        data["nomina_default"].id,
    }
    detalles = db_session.exec(select(TarjaDetalle).order_by(TarjaDetalle.idnomina)).all()
    assert {detalle.idnomina for detalle in detalles} == {
        data["nomina_con_novedad"].id,
        data["nomina_default"].id,
    }
    copied = next(detalle for detalle in detalles if detalle.idnomina == data["nomina_con_novedad"].id)
    assert copied.fecha == date(2026, 6, 24)
    assert copied.idestado == falta_estado.id
    assert copied.horas == Decimal("0.00")
    default = next(detalle for detalle in detalles if detalle.idnomina == data["nomina_default"].id)
    assert default.fecha == date(2026, 6, 24)
    assert default.horas == Decimal("9.00")


def test_confirmacion_v3_con_parte_existente_sincroniza_tarja_detalle(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    oportunidad = CRMOportunidad(
        contacto_id=data["contacto"].id,
        responsable_id=data["contacto"].responsable_id,
    )
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 9, 9),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(oportunidad)
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=data["nomina_con_novedad"].id,
            idestado=falta_estado.id,
            horas=Decimal("0"),
            descripcion="Falto",
        )
    )
    mensaje = CRMMensaje(
        contacto_id=data["contacto"].id,
        oportunidad_id=oportunidad.id,
        origen_externo_id="wamid-existing-confirmed-sync",
        metadata_json={
            "agent_v3": {
                "parte_diario_id": parte.id,
                "result": {
                    "type": "parte_diario_reply",
                    "parte_listo": True,
                },
            }
        },
    )
    db_session.add(mensaje)
    db_session.commit()

    result = {
        "type": "parte_diario_reply",
        "parte_listo": True,
        "confirmar_parte": True,
        "cerrar_parte": True,
        "idproyecto": data["proyecto"].id,
        "contacto_id": data["contacto"].id,
        "fecha": "2026-09-09",
        "novedades": [
            {
                "idnomina": data["nomina_con_novedad"].id,
                "idestado": falta_estado.id,
                "estado_codigo": "FAL",
                "horas": 0,
                "descripcion": "Falto",
            }
        ],
        "pendientes_ambiguos": [],
        "conflictos_novedad": [],
    }

    persisted = parte_diario_service.create_or_update_from_agent_v3_confirmation(
        db_session,
        contacto_id=data["contacto"].id,
        oportunidad_id=oportunidad.id,
        result=result,
        conversation_id="conv-existing-confirmed-sync",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        from_address="549111111",
        to_address="549999999",
        external_message_id="wamid-existing-confirmed-sync",
        text="confirmar",
        message_type="text",
        raw_payload={"raw": True},
        normalized_payload={"normalized": True},
        received_at=datetime(2026, 9, 9, 12, 0, tzinfo=UTC),
    )

    assert persisted.id == parte.id
    tarja = db_session.exec(
        select(Tarja)
        .where(Tarja.idproyecto == data["proyecto"].id)
        .where(Tarja.contacto_id == data["contacto"].id)
        .where(Tarja.fechainicio == date(2026, 8, 26))
        .where(Tarja.fechafinal == date(2026, 9, 10))
    ).one()
    detalles = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.fecha == date(2026, 9, 9))
        .order_by(TarjaDetalle.idnomina)
    ).all()
    assert {detalle.idnomina for detalle in detalles} == {
        data["nomina_con_novedad"].id,
        data["nomina_default"].id,
    }
    copied = next(detalle for detalle in detalles if detalle.idnomina == data["nomina_con_novedad"].id)
    assert copied.idestado == falta_estado.id
    assert copied.horas == Decimal("0.00")
    default = next(detalle for detalle in detalles if detalle.idnomina == data["nomina_default"].id)
    assert default.horas == Decimal("9.00")
    db_session.refresh(mensaje)
    assert mensaje.metadata_json["agent_v3"]["result"]["confirmar_parte"] is True


def test_crear_parte_borrador_asegura_tarja_sin_nomina_ni_detalle(db_session):
    data = _seed_base(db_session)

    parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )

    tarja = db_session.exec(
        select(Tarja)
        .where(Tarja.idproyecto == data["proyecto"].id)
        .where(Tarja.contacto_id == data["contacto"].id)
        .where(Tarja.fechainicio == date(2026, 6, 11))
        .where(Tarja.fechafinal == date(2026, 6, 25))
    ).one()
    assert tarja.estado == EstadoTarja.BORRADOR
    assert db_session.exec(select(TarjaNomina).where(TarjaNomina.tarja_id == tarja.id)).all() == []
    assert db_session.exec(select(TarjaDetalle).where(TarjaDetalle.tarja_id == tarja.id)).all() == []


def test_actualizar_parte_borrador_asegura_tarja_sin_nomina_ni_detalle(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.commit()

    parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "descripcion": "Borrador actualizado",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )

    tarja = db_session.exec(
        select(Tarja)
        .where(Tarja.idproyecto == data["proyecto"].id)
        .where(Tarja.contacto_id == data["contacto"].id)
        .where(Tarja.fechainicio == date(2026, 6, 11))
        .where(Tarja.fechafinal == date(2026, 6, 25))
    ).one()
    assert tarja.estado == EstadoTarja.BORRADOR
    assert db_session.exec(select(TarjaNomina).where(TarjaNomina.tarja_id == tarja.id)).all() == []
    assert db_session.exec(select(TarjaDetalle).where(TarjaDetalle.tarja_id == tarja.id)).all() == []


def test_actualizar_parte_a_confirmado_genera_tarja_detalle_del_dia(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=data["nomina_con_novedad"].id,
        idestado=falta_estado.id,
        horas=Decimal("0"),
        descripcion="Falto",
    )
    db_session.add(detalle)
    db_session.commit()

    updated = parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "id": detalle.id,
                    "idnomina": data["nomina_con_novedad"].id,
                    "idestado": falta_estado.id,
                    "horas": "0",
                    "descripcion": "Falto",
                }
            ],
        },
    )

    assert updated.estado == EstadoParteDiario.CONFIRMADO
    detalles = db_session.exec(select(TarjaDetalle).order_by(TarjaDetalle.idnomina)).all()
    assert {detalle.idnomina for detalle in detalles} == {
        data["nomina_con_novedad"].id,
        data["nomina_default"].id,
    }
    copied = next(detalle for detalle in detalles if detalle.idnomina == data["nomina_con_novedad"].id)
    assert copied.idestado == falta_estado.id
    assert copied.horas == Decimal("0.00")
    default = next(detalle for detalle in detalles if detalle.idnomina == data["nomina_default"].id)
    assert default.horas == Decimal("9.00")


def test_confirmar_parte_permite_novedad_de_nomina_fuera_del_encargado(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.commit()

    updated = parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": data["nomina_otro_encargado"].id,
                    "idestado": falta_estado.id,
                    "horas": "0",
                    "descripcion": "Novedad de apoyo externo",
                }
            ],
        },
    )

    assert updated.estado == EstadoParteDiario.CONFIRMADO
    externo = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.idnomina == data["nomina_otro_encargado"].id)
        .where(TarjaDetalle.fecha == date(2026, 6, 24))
    ).one()
    assert externo.idestado == falta_estado.id
    assert externo.horas == Decimal("0.00")


def test_actualizar_parte_confirmado_puede_eliminar_detalle_referenciado_por_tarja(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=data["nomina_con_novedad"].id,
        idestado=falta_estado.id,
        horas=Decimal("0"),
        descripcion="Falto",
    )
    db_session.add(detalle)
    db_session.commit()
    parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "id": detalle.id,
                    "idnomina": data["nomina_con_novedad"].id,
                    "idestado": falta_estado.id,
                    "horas": "0",
                    "descripcion": "Falto",
                }
            ],
        },
    )

    parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [],
        },
    )

    assert db_session.get(ParteDiarioDetalle, detalle.id) is None
    assert db_session.exec(
        select(TarjaDetalle).where(TarjaDetalle.parte_diario_detalle_id == detalle.id)
    ).all() == []


def test_eliminar_detalle_alta_desde_parte_elimina_tarja_nomina_y_nomina(db_session):
    data = _seed_base(db_session)
    alta_estado = ParteDiarioEstado(
        abreviatura="ALT",
        nombre="Alta",
        activo=False,
    )
    nomina_alta = Nomina(
        nombre="Julio",
        apellido="Falcioni",
        dni="falcioni-alta-delete",
        idproyecto=data["proyecto"].id,
        encargado_contacto_id=data["contacto"].id,
    )
    db_session.add_all([alta_estado, nomina_alta])
    db_session.flush()
    tarja = Tarja(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
        estado=EstadoTarja.BORRADOR,
    )
    db_session.add(tarja)
    db_session.flush()
    registro = TarjaNomina(
        tarja_id=tarja.id,
        nomina_id=nomina_alta.id,
        fecha_desde=date(2026, 6, 24),
        fecha_hasta=date(2026, 6, 25),
    )
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add_all([registro, parte])
    db_session.flush()
    detalle_alta = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=nomina_alta.id,
        idestado=alta_estado.id,
        horas=Decimal("0"),
        descripcion=str(registro.id),
    )
    db_session.add(detalle_alta)
    db_session.flush()
    tarja_detalle = TarjaDetalle(
        tarja_id=tarja.id,
        idnomina=nomina_alta.id,
        fecha=date(2026, 6, 24),
        idestado=alta_estado.id,
        horas=Decimal("0"),
        parte_diario_detalle_id=detalle_alta.id,
    )
    db_session.add(tarja_detalle)
    db_session.commit()

    parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [],
        },
    )

    db_session.refresh(registro)
    db_session.refresh(nomina_alta)
    assert db_session.get(ParteDiarioDetalle, detalle_alta.id) is None
    assert registro.deleted_at is not None
    assert db_session.exec(
        select(TarjaDetalle).where(TarjaDetalle.parte_diario_detalle_id == detalle_alta.id)
    ).all() == []
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina_alta.id)
        .where(TarjaDetalle.deleted_at.is_(None))
    ).all() == []
    assert nomina_alta.deleted_at is not None
    assert nomina_alta.activo is False

    reingreso = nomina_crud.create(
        db_session,
        {
            "nombre": "Julio",
            "apellido": "Falcioni",
            "dni": "falcioni-alta-delete",
            "idproyecto": None,
            "encargado_contacto_id": None,
            "activo": True,
        },
    )
    assert reingreso.id != nomina_alta.id
    assert reingreso.dni == nomina_alta.dni
    assert reingreso.deleted_at is None
    assert reingreso.activo is True


def test_asegurar_nomina_es_idempotente_y_preserva_valores(db_session):
    data = _seed_base(db_session)

    tarja, created = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    registro = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja.id)
        .where(TarjaNomina.nomina_id == data["nomina_con_novedad"].id)
    ).one()
    registro.adicional_importe = Decimal("123.45")
    registro.fecha_desde = date(2026, 6, 20)
    db_session.add(registro)
    empleado_posterior = Nomina(
        nombre="Nuevo",
        apellido="Posterior",
        dni="tarja-parte-posterior",
        idproyecto=data["proyecto"].id,
        encargado_contacto_id=data["contacto"].id,
    )
    db_session.add(empleado_posterior)
    db_session.commit()

    parte_diario_tarja_service._sync_tarja_nomina(
        db_session,
        tarja,
        [
            data["nomina_con_novedad"],
            data["nomina_default"],
            empleado_posterior,
        ],
    )
    db_session.commit()

    same_tarja, created_again = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    db_session.refresh(registro)

    assert created == 2
    assert same_tarja.id == tarja.id
    assert created_again == 0
    registros = db_session.exec(
        select(TarjaNomina).where(TarjaNomina.tarja_id == tarja.id)
    ).all()
    assert {item.nomina_id for item in registros} == {
        data["nomina_con_novedad"].id,
        data["nomina_default"].id,
    }
    assert registro.adicional_importe == Decimal("123.45")
    assert registro.fecha_desde == date(2026, 6, 20)


def test_cerrar_tarja_genera_nomina_de_la_quincena_siguiente(db_session):
    data = _seed_base(db_session)
    actual, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )

    cerrada, siguiente, created = parte_diario_tarja_service.cerrar_tarja(
        db_session,
        actual.id,
    )

    assert cerrada.estado == EstadoTarja.CERRADO
    assert siguiente.estado == EstadoTarja.BORRADOR
    assert siguiente.fechainicio == date(2026, 6, 26)
    assert siguiente.fechafinal == date(2026, 7, 10)
    assert created == 2
    registros = db_session.exec(
        select(TarjaNomina).where(TarjaNomina.tarja_id == siguiente.id)
    ).all()
    assert {registro.nomina_id for registro in registros} == {
        data["nomina_con_novedad"].id,
        data["nomina_default"].id,
    }


def test_confirmar_parte_requiere_borrador(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.commit()

    try:
        parte_diario_tarja_service.confirmar_parte(db_session, parte.id)
    except ValueError as exc:
        assert "en borrador" in str(exc)
    else:
        raise AssertionError("confirmar_parte debe rechazar partes que no estan en borrador")


def test_abrir_parte_cerrado_vuelve_a_borrador(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CERRADO,
    )
    db_session.add(parte)
    db_session.commit()

    opened = parte_diario_tarja_service.abrir_parte(db_session, parte.id)

    assert opened.estado == EstadoParteDiario.BORRADOR


def test_registrar_tarja_copia_novedades_y_completa_nomina_del_encargado(db_session):
    data = _seed_base(db_session)
    parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CONFIRMADO,
        descripcion="Parte listo",
    )
    db_session.add(parte)
    db_session.flush()
    detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=data["nomina_con_novedad"].id,
        idestado=falta_estado.id,
        horas=Decimal("0"),
        descripcion="Falto",
    )
    db_session.add(detalle)
    db_session.commit()

    tarja = parte_diario_tarja_service.registrar_tarja(db_session, parte.id)
    db_session.refresh(parte)

    assert tarja.estado == EstadoTarja.BORRADOR
    assert parte.estado == EstadoParteDiario.CERRADO
    assert tarja.idproyecto == data["proyecto"].id
    assert tarja.contacto_id == data["contacto"].id
    assert tarja.fechainicio == date(2026, 6, 11)
    assert tarja.fechafinal == date(2026, 6, 25)
    detalles = db_session.exec(
        select(TarjaDetalle).where(TarjaDetalle.tarja_id == tarja.id).order_by(TarjaDetalle.idnomina)
    ).all()
    assert {item.idnomina for item in detalles} == {
        data["nomina_con_novedad"].id,
        data["nomina_default"].id,
    }
    copied = next(item for item in detalles if item.idnomina == data["nomina_con_novedad"].id)
    assert copied.horas == Decimal("0.00")
    assert copied.idestado == falta_estado.id
    assert copied.parte_diario_detalle_id == detalle.id
    default = next(item for item in detalles if item.idnomina == data["nomina_default"].id)
    assert default.horas == Decimal("9.00")
    assert default.parte_diario_detalle_id is None
    registros_nomina = db_session.exec(
        select(TarjaNomina).where(TarjaNomina.tarja_id == tarja.id)
    ).all()
    assert len(registros_nomina) == 2


def test_registrar_tarja_reusa_cabecera_quincenal_y_preserva_otros_dias(db_session):
    data = _seed_base(db_session)
    parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte_24 = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    parte_25 = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte_24)
    db_session.add(parte_25)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte_24.id,
            idnomina=data["nomina_con_novedad"].id,
            idestado=falta_estado.id,
            horas=Decimal("0"),
            descripcion="Falto 24",
        )
    )
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte_25.id,
            idnomina=data["nomina_default"].id,
            idestado=falta_estado.id,
            horas=Decimal("0"),
            descripcion="Falto 25",
        )
    )
    db_session.commit()

    tarja_24 = parte_diario_tarja_service.registrar_tarja(db_session, parte_24.id)
    tarja_25 = parte_diario_tarja_service.registrar_tarja(db_session, parte_25.id)

    assert tarja_25.id == tarja_24.id
    detalles = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_24.id)
        .order_by(TarjaDetalle.fecha, TarjaDetalle.idnomina)
    ).all()
    assert {(detalle.fecha, detalle.idnomina) for detalle in detalles} == {
        (date(2026, 6, 24), data["nomina_con_novedad"].id),
        (date(2026, 6, 24), data["nomina_default"].id),
        (date(2026, 6, 25), data["nomina_con_novedad"].id),
        (date(2026, 6, 25), data["nomina_default"].id),
    }
    registros_nomina = db_session.exec(
        select(TarjaNomina).where(TarjaNomina.tarja_id == tarja_24.id)
    ).all()
    assert len(registros_nomina) == 2


def test_confirmar_parte_con_alta_recalcula_detalles_desde_fecha_alta(db_session):
    data = _seed_base(db_session)
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    alta_estado = ParteDiarioEstado(
        abreviatura="ALT",
        nombre="Alta",
        activo=False,
    )
    db_session.add(alta_estado)
    nomina_alta = Nomina(
        nombre="Ana",
        apellido="Alta",
        dni="tarja-parte-alta",
        idproyecto=data["proyecto"].id,
        encargado_contacto_id=data["contacto"].id,
    )
    db_session.add(nomina_alta)
    db_session.flush()
    tarja = parte_diario_tarja_service._get_or_create_tarja(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
        descripcion="tarja alta",
    )
    db_session.add(
        TarjaDetalle(
            tarja_id=tarja.id,
            idnomina=nomina_alta.id,
            fecha=date(2026, 6, 20),
            idestado=presente.id,
            horas=Decimal("6"),
        )
    )
    parte_anterior = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 20),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    parte_alta = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    parte_posterior_confirmado = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte_anterior)
    db_session.add(parte_alta)
    db_session.add(parte_posterior_confirmado)
    db_session.flush()
    detalle_alta = ParteDiarioDetalle(
        parte_diario_id=parte_alta.id,
        idnomina=nomina_alta.id,
        idestado=alta_estado.id,
        horas=Decimal("0"),
        descripcion="123",
    )
    detalle_alta_posterior = ParteDiarioDetalle(
        parte_diario_id=parte_posterior_confirmado.id,
        idnomina=nomina_alta.id,
        idestado=alta_estado.id,
        horas=Decimal("0"),
        descripcion="alta posterior",
    )
    db_session.add(detalle_alta)
    db_session.add(detalle_alta_posterior)
    db_session.commit()

    parte_diario_tarja_service.confirmar_parte(db_session, parte_alta.id)

    detalles_alta = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina_alta.id)
        .order_by(TarjaDetalle.fecha)
    ).all()
    assert [(detalle.fecha, detalle.idestado, detalle.horas) for detalle in detalles_alta] == [
        (date(2026, 6, 24), presente.id, Decimal("9.00")),
        (date(2026, 6, 25), presente.id, Decimal("9.00")),
    ]
    assert detalles_alta[0].descripcion is None
    assert detalles_alta[0].parte_diario_detalle_id == detalle_alta.id
    assert detalles_alta[1].descripcion is None
    assert detalles_alta[1].parte_diario_detalle_id == detalle_alta_posterior.id


def test_confirmar_parte_con_alta_creada_desde_formulario(db_session):
    data = _seed_base(db_session)
    alta_estado = ParteDiarioEstado(
        abreviatura="ALT",
        nombre="Alta",
        activo=False,
    )
    db_session.add(alta_estado)
    db_session.commit()

    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
    nomina = nomina_crud.create(
        db_session,
        {
            "nombre": "Ana",
            "apellido": "Alta Form",
            "dni": "tarja-parte-alta-form",
            "idproyecto": None,
            "encargado_contacto_id": None,
            "activo": True,
        },
    )
    tarja, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    registro = tarja_nomina_crud.create(
        db_session,
        {
            "tarja_id": tarja.id,
            "nomina_id": nomina.id,
            "fecha_desde": "2026-06-24",
            "fecha_hasta": "2026-06-30",
            "horas_justificadas": "0",
            "presentismo": False,
            "presentismo_importe": "0",
            "adicional_importe": "0",
            "premio": False,
            "premio_importe": "0",
            "viatico": False,
            "viatico_importe": "0",
            "sueldo_importe": "0",
            "mejora_importe": "0",
            "cargas_importe": "0",
            "documentos": [],
        },
    )

    updated = parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": nomina.id,
                    "idestado": alta_estado.id,
                    "horas": "0",
                    "descripcion": str(registro.id),
                }
            ],
        },
    )

    assert updated.estado == EstadoParteDiario.CONFIRMADO
    detalle_alta = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha == date(2026, 6, 24))
    ).one()
    assert detalle_alta.horas == Decimal("9.00")


def test_confirmar_parte_con_baja_corta_nomina_y_borra_detalles_posteriores(db_session):
    data = _seed_base(db_session)
    baja_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "BAJ")
    ).one()
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    nomina = data["nomina_default"]

    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
    db_session.add(
        ParteDiario(
            idproyecto=data["proyecto"].id,
            contacto_id=data["contacto"].id,
            fecha=date(2026, 6, 25),
            estado=EstadoParteDiario.CONFIRMADO,
        )
    )
    tarja, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    registro = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja.id)
        .where(TarjaNomina.nomina_id == nomina.id)
    ).one()
    db_session.add(
        TarjaDetalle(
            tarja_id=tarja.id,
            idnomina=nomina.id,
            fecha=date(2026, 6, 25),
            idestado=presente.id,
            horas=Decimal("9"),
        )
    )
    db_session.commit()

    updated = parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": nomina.id,
                    "idestado": baja_estado.id,
                    "horas": "9",
                    "descripcion": "Baja registrada tarde",
                }
            ],
        },
    )

    assert updated.estado == EstadoParteDiario.CONFIRMADO
    detalle_baja = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha == date(2026, 6, 24))
    ).one()
    assert detalle_baja.idestado == baja_estado.id
    assert detalle_baja.horas == Decimal("0.00")
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha > date(2026, 6, 24))
        .where(TarjaDetalle.fecha <= date(2026, 6, 25))
    ).all() == []
    db_session.refresh(registro)
    db_session.refresh(nomina)
    assert registro.fecha_hasta == date(2026, 6, 24)
    assert nomina.fecha_egreso == date(2026, 6, 24)
    assert nomina.activo is False


def test_eliminar_detalle_baja_reactiva_nomina_y_restaura_detalles_posteriores(db_session):
    data = _seed_base(db_session)
    baja_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "BAJ")
    ).one()
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    nomina = data["nomina_default"]

    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
    db_session.add(
        ParteDiario(
            idproyecto=data["proyecto"].id,
            contacto_id=data["contacto"].id,
            fecha=date(2026, 6, 25),
            estado=EstadoParteDiario.CONFIRMADO,
        )
    )
    tarja, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    registro = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja.id)
        .where(TarjaNomina.nomina_id == nomina.id)
    ).one()
    db_session.add(
        TarjaDetalle(
            tarja_id=tarja.id,
            idnomina=nomina.id,
            fecha=date(2026, 6, 25),
            idestado=presente.id,
            horas=Decimal("9"),
        )
    )
    db_session.commit()

    confirmed = parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": nomina.id,
                    "idestado": baja_estado.id,
                    "horas": "0",
                    "descripcion": "Baja",
                }
            ],
        },
    )
    detalle_baja = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id == confirmed.id)
        .where(ParteDiarioDetalle.idestado == baja_estado.id)
    ).one()
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha > date(2026, 6, 24))
    ).all() == []

    parte_diario_crud.update(
        db_session,
        parte.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [],
        },
    )

    db_session.refresh(registro)
    db_session.refresh(nomina)
    assert registro.fecha_hasta == date(2026, 6, 25)
    assert nomina.fecha_egreso is None
    assert nomina.activo is True
    assert db_session.get(ParteDiarioDetalle, detalle_baja.id) is None
    detalles_restaurados = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha > date(2026, 6, 24))
        .order_by(TarjaDetalle.fecha)
    ).all()
    assert [
        (detalle.fecha, detalle.idestado, detalle.horas)
        for detalle in detalles_restaurados
    ] == [
        (date(2026, 6, 25), presente.id, Decimal("9.00")),
    ]


def test_confirmar_y_eliminar_traspaso_mueve_nomina_y_revierte_destino(db_session):
    data = _seed_base(db_session)
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    traspaso_estado = ParteDiarioEstado(
        abreviatura="TRA",
        nombre="Traspaso",
        activo=True,
    )
    destino = Proyecto(nombre="Obra Destino", responsable_id=data["contacto"].responsable_id)
    db_session.add(traspaso_estado)
    db_session.add(destino)
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=destino.id,
            contacto_id=data["otro_contacto"].id,
            activo=True,
        )
    )
    nomina = data["nomina_default"]

    parte_origen = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
    parte_destino = ParteDiario(
        idproyecto=destino.id,
        contacto_id=data["otro_contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte_destino)
    tarja_origen, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    registro_origen = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja_origen.id)
        .where(TarjaNomina.nomina_id == nomina.id)
    ).one()
    db_session.add(
        TarjaDetalle(
            tarja_id=tarja_origen.id,
            idnomina=nomina.id,
            fecha=date(2026, 6, 25),
            idestado=presente.id,
            horas=Decimal("9"),
        )
    )
    db_session.commit()

    descripcion = json.dumps(
        {
            "tipo": "traspaso",
            "origen": {
                "idproyecto": data["proyecto"].id,
                "contacto_id": data["contacto"].id,
                "obra": data["proyecto"].nombre,
                "encargado": data["contacto"].nombre_completo,
            },
            "destino": {
                "idproyecto": destino.id,
                "contacto_id": data["otro_contacto"].id,
                "obra": destino.nombre,
                "encargado": data["otro_contacto"].nombre_completo,
            },
        }
    )
    confirmed = parte_diario_crud.update(
        db_session,
        parte_origen.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": nomina.id,
                    "idestado": traspaso_estado.id,
                    "horas": "0",
                    "descripcion": descripcion,
                }
            ],
        },
    )

    detalle_traspaso = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id == confirmed.id)
        .where(ParteDiarioDetalle.idestado == traspaso_estado.id)
    ).one()
    detalle_origen = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_origen.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha == date(2026, 6, 24))
    ).one()
    assert detalle_origen.idestado == traspaso_estado.id
    assert detalle_origen.horas == Decimal("0.00")
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_origen.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha > date(2026, 6, 24))
    ).all() == []
    db_session.refresh(registro_origen)
    db_session.refresh(nomina)
    assert registro_origen.fecha_hasta == date(2026, 6, 24)
    assert nomina.idproyecto == destino.id
    assert nomina.encargado_contacto_id == data["otro_contacto"].id
    tarja_destino = parte_diario_tarja_service.get_tarja_para_parte(
        db_session,
        parte_destino.id,
    )
    assert tarja_destino is not None
    detalles_destino = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_destino.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .order_by(TarjaDetalle.fecha)
    ).all()
    assert [
        (
            detalle.fecha,
            detalle.idestado,
            detalle.horas,
            detalle.parte_diario_detalle_id,
            detalle.descripcion,
        )
        for detalle in detalles_destino
    ] == [
        (
            date(2026, 6, 24),
            presente.id,
            Decimal("9.00"),
            detalle_traspaso.id,
            f"TRASPASO: {data['proyecto'].nombre} - {data['contacto'].nombre_completo}",
        ),
        (
            date(2026, 6, 25),
            presente.id,
            Decimal("9.00"),
            detalle_traspaso.id,
            f"TRASPASO: {data['proyecto'].nombre} - {data['contacto'].nombre_completo}",
        ),
    ]

    parte_diario_crud.update(
        db_session,
        parte_origen.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [],
        },
    )

    db_session.refresh(registro_origen)
    db_session.refresh(nomina)
    assert registro_origen.fecha_hasta == date(2026, 6, 25)
    assert nomina.idproyecto == data["proyecto"].id
    assert nomina.encargado_contacto_id == data["contacto"].id
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_destino.id)
        .where(TarjaDetalle.idnomina == nomina.id)
    ).all() == []
    detalles_origen_restaurados = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_origen.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha > date(2026, 6, 24))
    ).all()
    assert detalles_origen_restaurados == []


def test_actualizar_parte_rechaza_dos_novedades_misma_nomina_con_error_controlado(db_session):
    data = _seed_base(db_session)
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    baja_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "BAJ")
    ).one()
    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )

    try:
        parte_diario_crud.update(
            db_session,
            parte.id,
            {
                "idproyecto": data["proyecto"].id,
                "contacto_id": data["contacto"].id,
                "fecha": "2026-06-24",
                "estado": EstadoParteDiario.CONFIRMADO,
                "detalles": [
                    {
                        "idnomina": data["nomina_default"].id,
                        "idestado": presente.id,
                        "horas": "9",
                        "descripcion": "Presente",
                    },
                    {
                        "idnomina": data["nomina_default"].id,
                        "idestado": baja_estado.id,
                        "horas": "0",
                        "descripcion": "Baja",
                    },
                ],
            },
        )
    except ValueError as exc:
        assert "ya tiene una novedad cargada" in str(exc)
    else:
        raise AssertionError("Se esperaba error controlado por nomina duplicada")


def test_nomina_quick_create_permite_empleado_sin_obra(db_session):
    empleado = nomina_crud.create(
        db_session,
        {
            "nombre": "Alta",
            "apellido": "Sin Obra",
            "dni": "quick-create-sin-obra",
            "nomina_categoria_id": None,
            "nomina_tarea_id": None,
            "idproyecto": None,
            "encargado_contacto_id": None,
            "fecha_ingreso": None,
            "fecha_egreso": None,
            "activo": True,
        },
    )

    assert empleado.id is not None
    assert empleado.idproyecto is None
    assert empleado.encargado_contacto_id is None
    assert empleado.activo is True


def test_nomina_quick_create_rechaza_dni_activo_duplicado(db_session):
    nomina_crud.create(
        db_session,
        {
            "nombre": "Alta",
            "apellido": "Activa",
            "dni": "quick-create-duplicado",
            "activo": True,
        },
    )

    try:
        nomina_crud.create(
            db_session,
            {
                "nombre": "Reingreso",
                "apellido": "Duplicado",
                "dni": "quick-create-duplicado",
                "activo": True,
            },
        )
    except ValueError as exc:
        assert "Ya existe un empleado activo con ese DNI" in str(exc)
    else:
        raise AssertionError("Debe rechazar DNI duplicado si ya existe nomina activa")


def test_nomina_quick_create_permite_reingreso_con_dni_inactivo(db_session):
    anterior = nomina_crud.create(
        db_session,
        {
            "nombre": "Alta",
            "apellido": "Inactiva",
            "dni": "quick-create-reingreso",
            "activo": False,
        },
    )

    reingreso = nomina_crud.create(
        db_session,
        {
            "nombre": "Reingreso",
            "apellido": "Permitido",
            "dni": "quick-create-reingreso",
            "activo": True,
        },
    )

    assert reingreso.id != anterior.id
    assert reingreso.dni == anterior.dni
    assert reingreso.activo is True


def test_registro_nomina_guarda_categoria_y_tarea(db_session):
    data = _seed_base(db_session)
    tarja = parte_diario_tarja_service._get_or_create_tarja(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
        descripcion="tarja test",
    )

    registro = TarjaNomina(
        tarja_id=tarja.id,
        nomina_id=data["nomina_con_novedad"].id,
        nomina_categoria_id=42,
        nomina_tarea_id=7,
        horas_justificadas=Decimal("0"),
        presentismo=False,
        presentismo_importe=Decimal("0"),
        adicional_importe=Decimal("0"),
        premio=False,
        premio_importe=Decimal("0"),
        viatico=False,
        viatico_importe=Decimal("0"),
        sueldo_importe=Decimal("0"),
        mejora_importe=Decimal("0"),
        cargas_importe=Decimal("0"),
        fecha_desde=date(2026, 6, 11),
        fecha_hasta=date(2026, 6, 25),
        observaciones=None,
        documentos=[],
    )
    db_session.add(registro)
    db_session.commit()

    stored = db_session.get(TarjaNomina, registro.id)
    assert stored is not None
    assert stored.nomina_categoria_id == 42
    assert stored.nomina_tarea_id == 7


def test_registrar_tarja_requiere_parte_confirmado(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.commit()

    try:
        parte_diario_tarja_service.registrar_tarja(db_session, parte.id)
    except ValueError as exc:
        assert "parte diario confirmado" in str(exc)
    else:
        raise AssertionError("registrar_tarja debe rechazar partes en borrador")

