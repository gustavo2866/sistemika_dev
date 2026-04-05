import pytest
from datetime import UTC, datetime
from sqlmodel import Session

from app.services.crm_mensaje_service import CRMMensajeService
from app.models import (
    User,
    CRMCelular,
    CRMContacto,
    CRMOportunidad,
    CRMTipoOperacion,
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


def test_responder_mensaje_guarda_source_message_id_y_fecha_causal(client, db_session: Session, monkeypatch):
    async def _fake_enviar_mensaje(**kwargs):
        return {"status": "sent", "meta_message_id": "meta-123"}

    monkeypatch.setattr(
        "app.routers.crm_mensaje_router.metaw_client.enviar_mensaje",
        _fake_enviar_mensaje,
    )
    monkeypatch.setattr(
        CRMMensajeService,
        "actualizar_ultimo_mensaje_oportunidad",
        staticmethod(lambda session, mensaje: None),
    )

    user = User(nombre="Operador", email="operador@example.com")
    db_session.add(user)
    db_session.flush()

    celular = CRMCelular(
        meta_celular_id="meta-cell-1",
        numero_celular="+5491111111111",
        alias="Canal principal",
        activo=True,
    )
    db_session.add(celular)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Cliente Test",
        telefonos=["+5491122223333"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    tipo_operacion = CRMTipoOperacion(nombre="Proyecto", codigo="proyecto")
    db_session.add(tipo_operacion)
    db_session.flush()

    oportunidad = CRMOportunidad(
        contacto_id=contacto.id,
        tipo_operacion_id=tipo_operacion.id,
        responsable_id=user.id,
        titulo="Oportunidad test",
        descripcion_estado="Oportunidad test",
        fecha_estado=datetime.now(UTC),
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()

    fecha_origen = datetime(2026, 4, 5, 13, 32, 0, tzinfo=UTC)
    mensaje_original = CRMMensaje(
        tipo=TipoMensaje.ENTRADA.value,
        canal="whatsapp",
        contacto_id=contacto.id,
        contacto_referencia="+5491122223333",
        oportunidad_id=oportunidad.id,
        responsable_id=user.id,
        estado=EstadoMensaje.RECIBIDO.value,
        contenido="si esperame un segundo",
        fecha_mensaje=fecha_origen,
        celular_id=celular.id,
    )
    db_session.add(mensaje_original)
    db_session.commit()
    db_session.refresh(mensaje_original)

    response = client.post(
        f"/crm/mensajes/{mensaje_original.id}/responder",
        json={"texto": "Claro, tómate tu tiempo."},
    )

    assert response.status_code == 200
    payload = response.json()
    mensaje_salida = db_session.get(CRMMensaje, payload["mensaje_id"])
    assert mensaje_salida is not None
    assert mensaje_salida.metadata_json["source_message_id"] == mensaje_original.id
    assert mensaje_salida.fecha_mensaje > mensaje_original.fecha_mensaje
