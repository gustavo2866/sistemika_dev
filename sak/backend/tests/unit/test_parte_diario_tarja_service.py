import json
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
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


def test_confirmacion_v3_preserva_alta_existente_oculta_para_agente(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    alta_estado = ParteDiarioEstado(abreviatura="ALT", nombre="Alta", activo=False)
    nomina_alta = Nomina(
        nombre="Falcon",
        apellido="Ruiz",
        dni="alta-preservada-agente",
        idproyecto=data["proyecto"].id,
        encargado_contacto_id=data["contacto"].id,
    )
    oportunidad = CRMOportunidad(
        contacto_id=data["contacto"].id,
        responsable_id=data["contacto"].responsable_id,
    )
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 9, 9),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add_all([alta_estado, nomina_alta, oportunidad, parte])
    db_session.flush()
    detalle_alta = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=nomina_alta.id,
        idestado=alta_estado.id,
        horas=Decimal("0"),
        descripcion="Alta cargada desde formulario",
    )
    db_session.add(detalle_alta)
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
        conversation_id="conv-preserve-alta",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        from_address="549111111",
        to_address="549999999",
        external_message_id="wamid-preserve-alta",
        text="confirmar",
        message_type="text",
        raw_payload={"raw": True},
        normalized_payload={"normalized": True},
        received_at=datetime(2026, 9, 9, 12, 0, tzinfo=UTC),
    )

    assert persisted.id == parte.id
    detalles_parte = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id == parte.id)
        .where(ParteDiarioDetalle.deleted_at.is_(None))
        .order_by(ParteDiarioDetalle.idestado)
    ).all()
    assert {detalle.idestado for detalle in detalles_parte} == {alta_estado.id, falta_estado.id}
    assert any(detalle.id == detalle_alta.id for detalle in detalles_parte)

    tarja = db_session.exec(
        select(Tarja)
        .where(Tarja.idproyecto == data["proyecto"].id)
        .where(Tarja.contacto_id == data["contacto"].id)
        .where(Tarja.fechainicio == date(2026, 8, 26))
        .where(Tarja.fechafinal == date(2026, 9, 10))
    ).one()
    detalle_tarja_alta = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina_alta.id)
        .where(TarjaDetalle.fecha == date(2026, 9, 9))
    ).one()
    assert detalle_tarja_alta.horas == Decimal("9.00")
    assert detalle_tarja_alta.parte_diario_detalle_id == detalle_alta.id


def test_confirmacion_v3_rechaza_segunda_novedad_para_empleado_con_alta(db_session):
    data = _seed_base(db_session)
    permiso = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "PER")
    ).one()
    alta = ParteDiarioEstado(abreviatura="ALT", nombre="Alta", activo=False)
    oportunidad = CRMOportunidad(
        contacto_id=data["contacto"].id,
        responsable_id=data["contacto"].responsable_id,
    )
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 8, 28),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add_all([alta, oportunidad, parte])
    db_session.flush()
    detalle_alta = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=data["nomina_con_novedad"].id,
        idestado=alta.id,
        horas=Decimal("9"),
        descripcion="17",
    )
    db_session.add(detalle_alta)
    db_session.commit()
    result = {
        "type": "parte_diario_reply",
        "parte_listo": True,
        "confirmar_parte": True,
        "cerrar_parte": True,
        "idproyecto": data["proyecto"].id,
        "contacto_id": data["contacto"].id,
        "fecha": "2026-08-28",
        "novedades": [
            {
                "idnomina": data["nomina_con_novedad"].id,
                "idestado": permiso.id,
                "estado_codigo": "PER",
                "horas": 4,
                "descripcion": "trabajo",
            }
        ],
        "pendientes_ambiguos": [],
        "conflictos_novedad": [],
    }

    with pytest.raises(ValueError, match="Solo se admite una novedad por empleado"):
        parte_diario_service.create_or_update_from_agent_v3_confirmation(
            db_session,
            contacto_id=data["contacto"].id,
            oportunidad_id=oportunidad.id,
            result=result,
            conversation_id="conv-reject-second-novelty",
            provider="meta",
            channel_type="whatsapp",
            account_ref="account",
            from_address="549111111",
            to_address="549999999",
            external_message_id="wamid-reject-second-novelty",
            text="confirmar",
            message_type="text",
            raw_payload={"raw": True},
            normalized_payload={"normalized": True},
            received_at=datetime(2026, 8, 28, 12, 0, tzinfo=UTC),
        )

    detalles = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).all()
    assert detalles == [detalle_alta]


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


def test_actualizar_parte_generico_no_valida_nomina_fuera_del_encargado(db_session):
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
    detalle = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id == updated.id)
        .where(ParteDiarioDetalle.idnomina == data["nomina_otro_encargado"].id)
    ).one()
    assert detalle.idestado == falta_estado.id


def test_confirmar_parte_usa_tarja_nomina_para_validar_novedad_tardia(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    tarja = Tarja(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    db_session.add(tarja)
    db_session.flush()
    data["nomina_otro_encargado"].activo = False
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=data["nomina_otro_encargado"].id,
            fecha_desde=date(2026, 6, 24),
            fecha_hasta=date(2026, 6, 24),
            documentos=[],
        )
    )
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
                    "descripcion": "Novedad tardia",
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
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    proyecto_destino = Proyecto(
        nombre="Obra posterior al alta",
        responsable_id=data["proyecto"].responsable_id,
    )
    db_session.add(proyecto_destino)
    db_session.flush()
    tarja_destino = Tarja(
        idproyecto=proyecto_destino.id,
        contacto_id=data["otro_contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
        estado=EstadoTarja.BORRADOR,
    )
    parte_futuro = ParteDiario(
        idproyecto=proyecto_destino.id,
        contacto_id=data["otro_contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add_all([tarja_detalle, tarja_destino, parte_futuro])
    db_session.flush()
    registro_destino = TarjaNomina(
        tarja_id=tarja_destino.id,
        nomina_id=nomina_alta.id,
        fecha_desde=date(2026, 6, 25),
        fecha_hasta=date(2026, 6, 25),
    )
    novedad_futura = ParteDiarioDetalle(
        parte_diario_id=parte_futuro.id,
        idnomina=nomina_alta.id,
        idestado=presente.id,
        horas=Decimal("4"),
        descripcion="Trabajo posterior en otra obra",
    )
    db_session.add_all([registro_destino, novedad_futura])
    db_session.flush()
    detalle_destino = TarjaDetalle(
        tarja_id=tarja_destino.id,
        idnomina=nomina_alta.id,
        fecha=date(2026, 6, 25),
        idestado=presente.id,
        horas=Decimal("4"),
        parte_diario_detalle_id=novedad_futura.id,
    )
    db_session.add(detalle_destino)
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
    db_session.refresh(registro_destino)
    db_session.refresh(nomina_alta)
    assert db_session.get(ParteDiarioDetalle, detalle_alta.id) is None
    assert db_session.get(ParteDiarioDetalle, novedad_futura.id) is None
    assert registro.deleted_at is not None
    assert registro_destino.deleted_at is not None
    assert db_session.exec(
        select(TarjaDetalle).where(TarjaDetalle.parte_diario_detalle_id == detalle_alta.id)
    ).all() == []
    assert db_session.exec(
        select(TarjaDetalle)
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


def test_cerrar_tarja_cierra_solo_partes_confirmados_de_su_quincena(db_session):
    data = _seed_base(db_session)
    actual, _ = parte_diario_tarja_service.asegurar_nomina_quincena(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
    )
    confirmado = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 20),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    borrador = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 21),
        estado=EstadoParteDiario.BORRADOR,
    )
    otro_encargado = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["otro_contacto"].id,
        fecha=date(2026, 6, 20),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    otra_quincena = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 26),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add_all([confirmado, borrador, otro_encargado, otra_quincena])
    db_session.commit()

    parte_diario_tarja_service.cerrar_tarja(db_session, int(actual.id))

    db_session.refresh(confirmado)
    db_session.refresh(borrador)
    db_session.refresh(otro_encargado)
    db_session.refresh(otra_quincena)
    assert confirmado.estado == EstadoParteDiario.CERRADO
    assert borrador.estado == EstadoParteDiario.BORRADOR
    assert otro_encargado.estado == EstadoParteDiario.CONFIRMADO
    assert otra_quincena.estado == EstadoParteDiario.CONFIRMADO


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


def test_alta_posterior_no_genera_detalles_al_resincronizar_fechas_anteriores(db_session):
    data = _seed_base(db_session)
    alta_estado = ParteDiarioEstado(
        abreviatura="ALT",
        nombre="Alta",
        activo=False,
    )
    nomina_alta = Nomina(
        nombre="Leonardo",
        apellido="Alta Sabado",
        dni="tarja-alta-sabado",
        fecha_ingreso=date(2026, 9, 19),
        idproyecto=data["proyecto"].id,
        encargado_contacto_id=data["contacto"].id,
        activo=True,
    )
    db_session.add_all([alta_estado, nomina_alta])
    db_session.commit()

    parte_alta = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-09-19",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [
                {
                    "idnomina": nomina_alta.id,
                    "idestado": alta_estado.id,
                    "horas": "6",
                    "descripcion": "Alta del sabado",
                }
            ],
        },
    )
    parte_diario_tarja_service.confirmar_parte(db_session, parte_alta.id)

    parte_anterior = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-09-14",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
    parte_diario_tarja_service.confirmar_parte(db_session, parte_anterior.id)

    tarja = parte_diario_tarja_service.get_tarja_para_parte(db_session, parte_alta.id)
    assert tarja is not None
    registro = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja.id)
        .where(TarjaNomina.nomina_id == nomina_alta.id)
    ).one()
    assert registro.fecha_desde == date(2026, 9, 19)
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina_alta.id)
        .where(TarjaDetalle.fecha < date(2026, 9, 19))
    ).all() == []

    parte_diario_tarja_service.generar_tarja_desde_panel(
        db_session,
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fechainicio=date(2026, 9, 11),
        fechafinal=date(2026, 9, 25),
    )
    fechas_alta = db_session.exec(
        select(TarjaDetalle.fecha)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina == nomina_alta.id)
        .order_by(TarjaDetalle.fecha)
    ).all()
    assert fechas_alta
    assert min(fechas_alta) == date(2026, 9, 19)


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
    parte_futuro = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte_futuro)
    db_session.flush()
    novedad_futura = ParteDiarioDetalle(
        parte_diario_id=parte_futuro.id,
        idnomina=nomina.id,
        idestado=presente.id,
        horas=Decimal("4"),
        descripcion="Novedad posterior a la baja",
    )
    db_session.add(novedad_futura)
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
    assert db_session.get(ParteDiarioDetalle, novedad_futura.id) is None
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


def test_baja_retroactiva_anula_traspaso_y_detalles_de_otra_obra(db_session):
    data = _seed_base(db_session)
    baja_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "BAJ")
    ).one()
    traspaso_estado = ParteDiarioEstado(
        abreviatura="TRA",
        nombre="Traspaso",
        activo=True,
    )
    destino = Proyecto(nombre="Obra Destino Baja", responsable_id=data["contacto"].responsable_id)
    db_session.add_all([traspaso_estado, destino])
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=destino.id,
            contacto_id=data["otro_contacto"].id,
            activo=True,
        )
    )
    db_session.commit()
    nomina = data["nomina_default"]

    parte_destino = ParteDiario(
        idproyecto=destino.id,
        contacto_id=data["otro_contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte_destino)
    parte_traspaso = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
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
    parte_diario_crud.update(
        db_session,
        parte_traspaso.id,
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
        .where(ParteDiarioDetalle.parte_diario_id == parte_traspaso.id)
        .where(ParteDiarioDetalle.idnomina == nomina.id)
    ).one()
    tarja_destino = parte_diario_tarja_service.get_tarja_para_parte(
        db_session,
        parte_destino.id,
    )
    assert tarja_destino is not None
    registro_destino = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja_destino.id)
        .where(TarjaNomina.nomina_id == nomina.id)
    ).one()

    parte_baja = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-23",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
    impacto = parte_diario_tarja_service.obtener_impacto_baja(
        db_session,
        parte=parte_baja,
        nomina_id=nomina.id,
    )
    assert impacto["novedades"] == 1
    assert impacto["traslados"] == 1
    assert impacto["tarja_detalles"] >= 2

    parte_diario_crud.update(
        db_session,
        parte_baja.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-23",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": nomina.id,
                    "idestado": baja_estado.id,
                    "horas": "0",
                    "descripcion": "Baja retroactiva",
                }
            ],
        },
    )

    assert db_session.get(ParteDiarioDetalle, detalle_traspaso.id) is None
    assert db_session.get(TarjaNomina, registro_destino.id) is None
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha > date(2026, 6, 23))
    ).all() == []
    db_session.refresh(nomina)
    assert nomina.idproyecto == data["proyecto"].id
    assert nomina.encargado_contacto_id == data["contacto"].id
    assert nomina.fecha_egreso == date(2026, 6, 23)
    assert nomina.activo is False


def test_baja_retroactiva_respeta_alta_posterior_como_nuevo_periodo(db_session):
    data = _seed_base(db_session)
    baja_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "BAJ")
    ).one()
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    alta_estado = ParteDiarioEstado(abreviatura="ALT", nombre="Alta", activo=False)
    destino = Proyecto(nombre="Obra Reingreso", responsable_id=data["contacto"].responsable_id)
    db_session.add_all([alta_estado, destino])
    db_session.flush()
    nomina = data["nomina_default"]

    parte_baja = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-23",
            "estado": EstadoParteDiario.BORRADOR,
            "detalles": [],
        },
    )
    parte_futuro = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    parte_alta = ParteDiario(
        idproyecto=destino.id,
        contacto_id=data["otro_contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add_all([parte_futuro, parte_alta])
    db_session.flush()
    novedad_futura = ParteDiarioDetalle(
        parte_diario_id=parte_futuro.id,
        idnomina=nomina.id,
        idestado=presente.id,
        horas=Decimal("4"),
        descripcion="Se anula por la baja",
    )
    detalle_alta = ParteDiarioDetalle(
        parte_diario_id=parte_alta.id,
        idnomina=nomina.id,
        idestado=alta_estado.id,
        horas=Decimal("9"),
        descripcion="Reingreso posterior",
    )
    db_session.add_all([novedad_futura, detalle_alta])
    db_session.flush()

    tarja_origen = parte_diario_tarja_service.get_tarja_para_parte(db_session, parte_baja.id)
    assert tarja_origen is not None
    tarja_destino = Tarja(
        idproyecto=destino.id,
        contacto_id=data["otro_contacto"].id,
        fechainicio=date(2026, 6, 11),
        fechafinal=date(2026, 6, 25),
        estado=EstadoTarja.BORRADOR,
    )
    db_session.add(tarja_destino)
    db_session.flush()
    registro_reingreso = TarjaNomina(
        tarja_id=tarja_destino.id,
        nomina_id=nomina.id,
        fecha_desde=date(2026, 6, 25),
        fecha_hasta=date(2026, 6, 25),
        documentos=[],
    )
    detalle_reingreso = TarjaDetalle(
        tarja_id=tarja_destino.id,
        idnomina=nomina.id,
        fecha=date(2026, 6, 25),
        idestado=presente.id,
        horas=Decimal("9"),
        parte_diario_detalle_id=detalle_alta.id,
    )
    db_session.add_all(
        [
            registro_reingreso,
            detalle_reingreso,
            TarjaDetalle(
                tarja_id=tarja_origen.id,
                idnomina=nomina.id,
                fecha=date(2026, 6, 24),
                idestado=presente.id,
                horas=Decimal("4"),
                parte_diario_detalle_id=novedad_futura.id,
            ),
        ]
    )
    nomina.idproyecto = destino.id
    nomina.encargado_contacto_id = data["otro_contacto"].id
    nomina.activo = True
    nomina.fecha_egreso = None
    db_session.add(nomina)
    db_session.commit()

    impacto = parte_diario_tarja_service.obtener_impacto_baja(
        db_session,
        parte=parte_baja,
        nomina_id=nomina.id,
    )
    assert impacto["novedades"] == 1
    assert impacto["proxima_alta"] == "2026-06-25"

    parte_diario_crud.update(
        db_session,
        parte_baja.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-23",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": nomina.id,
                    "idestado": baja_estado.id,
                    "horas": "0",
                    "descripcion": "Baja antes del reingreso",
                }
            ],
        },
    )

    assert db_session.get(ParteDiarioDetalle, novedad_futura.id) is None
    assert db_session.get(ParteDiarioDetalle, detalle_alta.id) is not None
    assert db_session.get(TarjaNomina, registro_reingreso.id) is not None
    assert db_session.get(TarjaDetalle, detalle_reingreso.id) is not None
    db_session.refresh(nomina)
    assert nomina.idproyecto == destino.id
    assert nomina.encargado_contacto_id == data["otro_contacto"].id
    assert nomina.activo is True
    assert nomina.fecha_egreso is None


@pytest.mark.parametrize(
    ("estado_final", "fechas_restauradas", "eliminar_desde_destino"),
    [
        (
            EstadoParteDiario.CONFIRMADO,
            [date(2026, 6, 24), date(2026, 6, 25)],
            False,
        ),
        (EstadoParteDiario.BORRADOR, [date(2026, 6, 25)], False),
        (
            EstadoParteDiario.CONFIRMADO,
            [date(2026, 6, 24), date(2026, 6, 25)],
            True,
        ),
    ],
)
def test_confirmar_y_eliminar_traspaso_mueve_nomina_y_revierte_destino(
    db_session,
    estado_final,
    fechas_restauradas,
    eliminar_desde_destino,
):
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
    nomina_destino_existente = Nomina(
        nombre="Ana",
        apellido="Destino",
        dni="tarja-parte-destino",
        idproyecto=destino.id,
        encargado_contacto_id=data["otro_contacto"].id,
    )
    db_session.add(nomina_destino_existente)
    db_session.flush()
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
    parte_destino_anterior = ParteDiario(
        idproyecto=destino.id,
        contacto_id=data["otro_contacto"].id,
        fecha=date(2026, 6, 11),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    parte_origen_futuro = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add_all([parte_destino, parte_destino_anterior, parte_origen_futuro])
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
    registros_destino = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja_destino.id)
        .where(TarjaNomina.deleted_at.is_(None))
    ).all()
    assert {registro.nomina_id for registro in registros_destino} == {
        nomina_destino_existente.id,
        nomina.id,
    }
    registro_existente = next(
        registro
        for registro in registros_destino
        if registro.nomina_id == nomina_destino_existente.id
    )
    assert registro_existente.fecha_desde == date(2026, 6, 11)
    assert registro_existente.fecha_hasta == date(2026, 6, 25)

    parte_diario_tarja_service.sincronizar_detalle_para_parte(
        db_session,
        parte_destino_anterior,
    )
    detalle_destino_anterior = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_destino.id)
        .where(TarjaDetalle.idnomina == nomina_destino_existente.id)
        .where(TarjaDetalle.fecha == date(2026, 6, 11))
    ).one()
    assert detalle_destino_anterior.horas == Decimal("9.00")
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_destino.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha == date(2026, 6, 11))
    ).first() is None

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

    registro_destino = db_session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == tarja_destino.id)
        .where(TarjaNomina.nomina_id == nomina.id)
        .where(TarjaNomina.deleted_at.is_(None))
    ).one()
    novedad_destino = ParteDiarioDetalle(
        parte_diario_id=parte_destino.id,
        idnomina=nomina.id,
        idestado=presente.id,
        horas=Decimal("4"),
        descripcion="Novedad posterior en destino",
    )
    db_session.add(novedad_destino)
    db_session.commit()

    if eliminar_desde_destino:
        assert tarja_nomina_crud.delete(db_session, registro_destino.id) is True
    else:
        parte_diario_crud.update(
            db_session,
            parte_origen.id,
            {
                "idproyecto": data["proyecto"].id,
                "contacto_id": data["contacto"].id,
                "fecha": "2026-06-24",
                "estado": estado_final,
                "detalles": [],
            },
        )

    db_session.refresh(registro_origen)
    db_session.refresh(nomina)
    assert registro_origen.fecha_hasta == date(2026, 6, 25)
    assert nomina.idproyecto == data["proyecto"].id
    assert nomina.encargado_contacto_id == data["contacto"].id
    assert nomina.fecha_egreso is None
    assert nomina.activo is True
    assert db_session.get(ParteDiarioDetalle, novedad_destino.id) is None
    assert db_session.get(TarjaNomina, registro_destino.id) is None
    assert db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_destino.id)
        .where(TarjaDetalle.idnomina == nomina.id)
    ).all() == []
    detalles_origen_restaurados = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja_origen.id)
        .where(TarjaDetalle.idnomina == nomina.id)
        .where(TarjaDetalle.fecha >= date(2026, 6, 24))
        .where(TarjaDetalle.deleted_at.is_(None))
        .order_by(TarjaDetalle.fecha)
    ).all()
    assert [
        detalle.fecha
        for detalle in detalles_origen_restaurados
    ] == fechas_restauradas
    assert all(
        detalle.idestado == presente.id and detalle.horas == Decimal("9.00")
        for detalle in detalles_origen_restaurados
    )


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


def test_trabajo_destino_manual_crea_novedad_temporal_sin_mover_nomina(db_session):
    data = _seed_base(db_session)
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    destino = Proyecto(
        nombre="Obra Temporal",
        responsable_id=data["contacto"].responsable_id,
    )
    db_session.add(destino)
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=destino.id,
            contacto_id=data["otro_contacto"].id,
            activo=True,
        )
    )
    db_session.commit()

    nomina = data["nomina_default"]
    proyecto_origen_id = nomina.idproyecto
    encargado_origen_id = nomina.encargado_contacto_id
    descripcion = json.dumps(
        {
            "tipo": "trabajo_destino",
            "horas": 4,
            "origen": {
                "idproyecto": data["proyecto"].id,
                "contacto_id": data["contacto"].id,
            },
            "destino": {
                "idproyecto": destino.id,
                "contacto_id": data["otro_contacto"].id,
                "obra": destino.nombre,
                "encargado": data["otro_contacto"].nombre_completo,
            },
        }
    )

    origen = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "idnomina": nomina.id,
                    "idestado": presente.id,
                    "horas": "5",
                    "descripcion": descripcion,
                }
            ],
        },
    )

    db_session.refresh(nomina)
    assert nomina.idproyecto == proyecto_origen_id
    assert nomina.encargado_contacto_id == encargado_origen_id

    origen_detalle = db_session.exec(
        select(ParteDiarioDetalle).where(
            ParteDiarioDetalle.parte_diario_id == origen.id,
            ParteDiarioDetalle.idnomina == nomina.id,
        )
    ).one()
    assert origen_detalle.idestado == presente.id
    assert origen_detalle.horas == Decimal("5.00")
    assert "parte_diario_destino_id=" in str(origen_detalle.descripcion)
    assert '"horas":4.0' in str(origen_detalle.descripcion)

    parte_destino = db_session.exec(
        select(ParteDiario).where(
            ParteDiario.idproyecto == destino.id,
            ParteDiario.contacto_id == data["otro_contacto"].id,
            ParteDiario.fecha == date(2026, 6, 24),
        )
    ).one()
    assert parte_destino.estado == EstadoParteDiario.BORRADOR
    destino_detalle = db_session.exec(
        select(ParteDiarioDetalle).where(
            ParteDiarioDetalle.parte_diario_id == parte_destino.id,
            ParteDiarioDetalle.idnomina == nomina.id,
        )
    ).one()
    assert destino_detalle.idestado == presente.id
    assert destino_detalle.horas == Decimal("4.00")

    tarja_destino = parte_diario_tarja_service.get_tarja_para_parte(
        db_session,
        parte_destino.id,
    )
    assert tarja_destino is not None
    assert db_session.exec(
        select(TarjaDetalle).where(
            TarjaDetalle.tarja_id == tarja_destino.id,
            TarjaDetalle.idnomina == nomina.id,
        )
    ).all() == []

    parte_diario_crud.update(
        db_session,
        parte_destino.id,
        {
            "idproyecto": destino.id,
            "contacto_id": data["otro_contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "id": destino_detalle.id,
                    "idnomina": nomina.id,
                    "idestado": presente.id,
                    "horas": "4",
                    "descripcion": destino_detalle.descripcion,
                }
            ],
        },
    )
    tarja_detalle_destino = db_session.exec(
        select(TarjaDetalle).where(
            TarjaDetalle.tarja_id == tarja_destino.id,
            TarjaDetalle.idnomina == nomina.id,
            TarjaDetalle.fecha == date(2026, 6, 24),
        )
    ).one()
    assert tarja_detalle_destino.horas == Decimal("4.00")
    db_session.refresh(nomina)
    assert nomina.idproyecto == proyecto_origen_id
    assert nomina.encargado_contacto_id == encargado_origen_id

    parte_diario_crud.update(
        db_session,
        origen.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [
                {
                    "id": origen_detalle.id,
                    "idnomina": nomina.id,
                    "idestado": presente.id,
                    "horas": "5",
                    "descripcion": origen_detalle.descripcion,
                }
            ],
        },
    )
    db_session.refresh(parte_destino)
    assert parte_destino.estado == EstadoParteDiario.CONFIRMADO

    tarja_destino.estado = EstadoTarja.CERRADO
    db_session.add(tarja_destino)
    db_session.commit()
    with pytest.raises(ValueError, match="tarja destino .* ya fue cerrada"):
        parte_diario_crud.update(
            db_session,
            origen.id,
            {
                "idproyecto": data["proyecto"].id,
                "contacto_id": data["contacto"].id,
                "fecha": "2026-06-24",
                "estado": EstadoParteDiario.CONFIRMADO,
                "detalles": [],
            },
        )
    assert db_session.get(ParteDiarioDetalle, origen_detalle.id) is not None
    assert db_session.get(ParteDiarioDetalle, destino_detalle.id) is not None
    assert db_session.get(TarjaDetalle, tarja_detalle_destino.id) is not None

    tarja_destino = db_session.get(Tarja, tarja_destino.id)
    tarja_destino.estado = EstadoTarja.BORRADOR
    db_session.add(tarja_destino)
    db_session.commit()
    parte_diario_crud.update(
        db_session,
        origen.id,
        {
            "idproyecto": data["proyecto"].id,
            "contacto_id": data["contacto"].id,
            "fecha": "2026-06-24",
            "estado": EstadoParteDiario.CONFIRMADO,
            "detalles": [],
        },
    )

    db_session.refresh(parte_destino)
    assert parte_destino.estado == EstadoParteDiario.BORRADOR
    assert db_session.get(ParteDiarioDetalle, origen_detalle.id) is None
    assert db_session.get(ParteDiarioDetalle, destino_detalle.id) is None
    assert db_session.get(TarjaDetalle, tarja_detalle_destino.id) is None
    tarja_origen = parte_diario_tarja_service.get_tarja_para_parte(db_session, origen.id)
    assert tarja_origen is not None
    detalle_origen_restaurado = db_session.exec(
        select(TarjaDetalle).where(
            TarjaDetalle.tarja_id == tarja_origen.id,
            TarjaDetalle.idnomina == nomina.id,
            TarjaDetalle.fecha == date(2026, 6, 24),
        )
    ).one()
    assert detalle_origen_restaurado.horas == Decimal("9.00")


def test_trabajo_destino_manual_rechaza_tarja_destino_cerrada(db_session):
    data = _seed_base(db_session)
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    destino = Proyecto(
        nombre="Obra Cerrada",
        responsable_id=data["contacto"].responsable_id,
    )
    db_session.add(destino)
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=destino.id,
            contacto_id=data["otro_contacto"].id,
            activo=True,
        )
    )
    db_session.add(
        ParteDiario(
            idproyecto=destino.id,
            contacto_id=data["otro_contacto"].id,
            fecha=date(2026, 6, 24),
            estado=EstadoParteDiario.BORRADOR,
        )
    )
    db_session.add(
        Tarja(
            idproyecto=destino.id,
            contacto_id=data["otro_contacto"].id,
            fechainicio=date(2026, 6, 11),
            fechafinal=date(2026, 6, 25),
            estado=EstadoTarja.CERRADO,
        )
    )
    db_session.commit()

    descripcion = json.dumps(
        {
            "tipo": "trabajo_destino",
            "destino": {
                "idproyecto": destino.id,
                "contacto_id": data["otro_contacto"].id,
                "obra": destino.nombre,
            },
        }
    )
    with pytest.raises(ValueError, match="tarja destino .* ya fue cerrada"):
        parte_diario_crud.create(
            db_session,
            {
                "idproyecto": data["proyecto"].id,
                "contacto_id": data["contacto"].id,
                "fecha": "2026-06-24",
                "estado": EstadoParteDiario.CONFIRMADO,
                "detalles": [
                    {
                        "idnomina": data["nomina_default"].id,
                        "idestado": presente.id,
                        "horas": "0",
                        "descripcion": descripcion,
                    }
                ],
            },
        )

    assert db_session.exec(
        select(ParteDiario).where(
            ParteDiario.idproyecto == data["proyecto"].id,
            ParteDiario.fecha == date(2026, 6, 24),
        )
    ).first() is None

