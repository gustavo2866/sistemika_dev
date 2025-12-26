import pytest
from sqlmodel import Session

from app.models import (
    User,
    CRMContacto,
    CRMTipoEvento,
    CRMMotivoEvento,
    CRMMensaje,
    EstadoMensaje,
    TipoMensaje,
)


@pytest.fixture()
def seed_crm_basico(db_session: Session):
    user = User(nombre="Tester", email="tester@example.com")
    db_session.add(user)
    db_session.flush()

    tipo_evento = CRMTipoEvento(nombre="Llamada", codigo="LLAM")
    motivo_evento = CRMMotivoEvento(nombre="Consulta", codigo="CONS")
    db_session.add_all([tipo_evento, motivo_evento])
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(tipo_evento)
    db_session.refresh(motivo_evento)
    return {"user": user, "tipo_evento": tipo_evento, "motivo_evento": motivo_evento}


def test_crear_mensaje_entrada(client, seed_crm_basico):
    payload = {
        "canal": "whatsapp",
        "contacto_referencia": "+5491112345678",
        "asunto": "Consulta de cliente",
        "contenido": "Hola, quiero saber más.",
    }
    res = client.post("/crm/mensajes/entrada", json=payload)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["tipo"] == TipoMensaje.ENTRADA.value
    assert data["estado"] == EstadoMensaje.NUEVO.value
    assert data["contacto_referencia"] == "+5491112345678"


def test_descartar_mensaje_via_patch(client, seed_crm_basico):
    res = client.post("/crm/mensajes/entrada", json={"asunto": "Spam"})
    mensaje_id = res.json()["id"]

    res_patch = client.patch(f"/crm/mensajes/{mensaje_id}", json={"estado": EstadoMensaje.DESCARTADO.value})
    assert res_patch.status_code == 200
    assert res_patch.json()["estado"] == EstadoMensaje.DESCARTADO.value


def test_reintentar_salida(client, seed_crm_basico):
    # Crear mensaje de salida en error_envio
    payload = {
        "tipo": TipoMensaje.SALIDA.value,
        "estado": EstadoMensaje.ERROR_ENVIO.value,
        "canal": "email",
        "asunto": "Respuesta",
        "contenido": "Gracias por contactarnos",
    }
    res = client.post("/crm/mensajes", json=payload)
    assert res.status_code in (200, 201)
    mensaje_id = res.json()["id"]

    res_retry = client.post(f"/crm/mensajes/{mensaje_id}/reintentar")
    assert res_retry.status_code == 200
    assert res_retry.json()["estado"] == EstadoMensaje.PENDIENTE_ENVIO.value
