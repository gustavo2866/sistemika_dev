from datetime import date
from decimal import Decimal

from sqlmodel import select

from app.models import (
    CRMContacto,
    EstadoParteDiario,
    Nomina,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
    Proyecto,
    User,
)
from app.models.tarja import EstadoTarja, TarjaDetalle, TarjaNovedad
from app.services.parte_diario_estado_service import seed_parte_diario_estados
from app.services.parte_diario_tarja_service import parte_diario_tarja_service


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
        "proyecto": proyecto,
        "nomina_con_novedad": nomina_con_novedad,
        "nomina_default": nomina_default,
        "nomina_otro_encargado": nomina_otro_encargado,
    }


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


def test_cerrar_parte_borrador_pasa_a_cerrado(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.commit()

    closed = parte_diario_tarja_service.cerrar_parte(db_session, parte.id)

    assert closed.estado == EstadoParteDiario.CERRADO


def test_cerrar_parte_requiere_borrador(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CERRADO,
    )
    db_session.add(parte)
    db_session.commit()

    try:
        parte_diario_tarja_service.cerrar_parte(db_session, parte.id)
    except ValueError as exc:
        assert "en borrador" in str(exc)
    else:
        raise AssertionError("cerrar_parte debe rechazar partes que no estan en borrador")


def test_abrir_parte_registrado_vuelve_a_borrador(db_session):
    data = _seed_base(db_session)
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.REGISTRADO,
    )
    db_session.add(parte)
    db_session.commit()

    opened = parte_diario_tarja_service.abrir_parte(db_session, parte.id)

    assert opened.estado == EstadoParteDiario.BORRADOR


def test_registrar_tarja_copia_novedades_y_completa_nomina_del_encargado(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CERRADO,
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
    assert parte.estado == EstadoParteDiario.REGISTRADO
    assert tarja.idproyecto == data["proyecto"].id
    assert tarja.contacto_id == data["contacto"].id
    assert tarja.fechainicio == date(2026, 6, 16)
    assert tarja.fechafinal == date(2026, 6, 30)
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
    novedades = db_session.exec(select(TarjaNovedad).where(TarjaNovedad.tarja_id == tarja.id)).all()
    assert len(novedades) == 1


def test_registrar_tarja_reusa_cabecera_quincenal_y_preserva_otros_dias(db_session):
    data = _seed_base(db_session)
    falta_estado = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte_24 = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 24),
        estado=EstadoParteDiario.CERRADO,
    )
    parte_25 = ParteDiario(
        idproyecto=data["proyecto"].id,
        contacto_id=data["contacto"].id,
        fecha=date(2026, 6, 25),
        estado=EstadoParteDiario.CERRADO,
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
    novedades = db_session.exec(select(TarjaNovedad).where(TarjaNovedad.tarja_id == tarja_24.id)).all()
    assert len(novedades) == 1


def test_registrar_tarja_requiere_parte_cerrado(db_session):
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
        assert "parte diario cerrado" in str(exc)
    else:
        raise AssertionError("registrar_tarja debe rechazar partes en borrador")
