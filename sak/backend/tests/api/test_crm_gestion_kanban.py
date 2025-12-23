from datetime import datetime, timedelta

from sqlmodel import Session

from app.models import (
    CRMContacto,
    CRMEvento,
    CRMMotivoEvento,
    CRMOportunidad,
    CRMTipoEvento,
    User,
)


def test_crm_gestion_kanban_endpoint(client, db_session: Session):
    user = User(nombre="Gestion Tester", email="gestion_tester@example.com")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    tipo = CRMTipoEvento(codigo="llamada", nombre="Llamada")
    motivo = CRMMotivoEvento(codigo="seguimiento", nombre="Seguimiento")
    db_session.add(tipo)
    db_session.add(motivo)
    db_session.commit()
    db_session.refresh(tipo)
    db_session.refresh(motivo)

    contacto = CRMContacto(
        nombre_completo="Contacto Gestion",
        telefonos=["+541100000000"],
        email="contacto.gestion@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.commit()
    db_session.refresh(contacto)

    oportunidad = CRMOportunidad(
        contacto_id=contacto.id,
        responsable_id=user.id,
        titulo="Oportunidad Gestion",
    )
    db_session.add(oportunidad)
    db_session.commit()
    db_session.refresh(oportunidad)

    now = datetime.now()
    evento_today = CRMEvento(
        oportunidad_id=oportunidad.id,
        contacto_id=contacto.id,
        tipo_id=tipo.id,
        motivo_id=motivo.id,
        titulo="Evento Hoy",
        fecha_evento=now,
        asignado_a_id=user.id,
    )
    evento_overdue = CRMEvento(
        oportunidad_id=oportunidad.id,
        contacto_id=contacto.id,
        tipo_id=tipo.id,
        motivo_id=motivo.id,
        titulo="Evento Vencido",
        fecha_evento=now - timedelta(days=1),
        asignado_a_id=user.id,
    )
    db_session.add(evento_today)
    db_session.add(evento_overdue)
    db_session.commit()

    response = client.get("/crm/gestion/kanban")
    assert response.status_code == 200
    payload = response.json()

    assert "summary" in payload
    assert "buckets" in payload

    summary = payload["summary"]
    buckets = payload["buckets"]

    assert summary["buckets"]["today"] >= 1
    assert summary["buckets"]["overdue"] >= 1

    assert any(item["id"] == evento_today.id for item in buckets["today"])
    assert any(item["id"] == evento_overdue.id for item in buckets["overdue"])
