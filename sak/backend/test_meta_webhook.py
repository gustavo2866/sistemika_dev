"""
Tests funcionales para webhook de Meta WhatsApp
Basado en spec1.md - Casos de prueba TC-01 a TC-10
"""
import sys
import os
import pytest
import json
from datetime import datetime
from uuid import uuid4

# Agregar el directorio backend al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from fastapi.testclient import TestClient
from app.main import app
from app.db import engine
from app.models import CRMCelular, CRMMensaje, WebhookLog, Setting, CRMContacto


client = TestClient(app)


@pytest.fixture
def session():
    """Fixture para crear sesión de BD"""
    with Session(engine) as session:
        yield session


@pytest.fixture
def setup_settings(session):
    """Configura settings necesarios"""
    # Limpiar settings previos
    settings = [
        Setting(
            clave="meta_w_empresa_id",
            valor="test_empresa_123",
            descripcion="Test empresa ID"
        ),
        Setting(
            clave="meta_w_auto_create_celular",
            valor="true",
            descripcion="Auto-crear celulares"
        ),
    ]
    for setting in settings:
        existing = session.exec(select(Setting).where(Setting.clave == setting.clave)).first()
        if not existing:
            session.add(setting)
    session.commit()


@pytest.fixture
def setup_celular(session):
    """Crea un celular de prueba"""
    celular = CRMCelular(
        meta_celular_id="test_phone_123",
        numero_celular="+59899123456",
        alias="Canal Test",
        activo=True
    )
    session.add(celular)
    session.commit()
    session.refresh(celular)
    return celular


def test_tc01_mensaje_entrante_contacto_nuevo(session, setup_settings, setup_celular):
    """
    TC-01: Mensaje entrante de contacto nuevo
    
    Verifica:
    - Webhook se registra en webhook_logs
    - CRMContacto se crea automáticamente
    - CRMMensaje se crea con tipo=ENTRADA
    - estado=NUEVO
    - celular_id apunta al celular correcto
    """
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "test_empresa_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "phone_number_id": "test_phone_123",
                                "display_phone_number": "+59899123456"
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Juan Pérez"},
                                    "wa_id": "59899111222"
                                }
                            ],
                            "messages": [
                                {
                                    "from": "59899111222",
                                    "id": "msg_meta_001",
                                    "timestamp": "2025-01-23T10:00:00Z",
                                    "type": "text",
                                    "text": {"body": "Hola, necesito información"}
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    # Verificar webhook_log
    log = session.exec(select(WebhookLog).order_by(WebhookLog.fecha_recepcion.desc())).first()
    assert log is not None
    assert log.procesado is True
    
    # Verificar contacto creado
    contacto = session.exec(
        select(CRMContacto).where(CRMContacto.telefonos.contains(["59899111222"]))
    ).first()
    assert contacto is not None
    
    # Verificar mensaje creado
    mensaje = session.exec(
        select(CRMMensaje).where(CRMMensaje.origen_externo_id == "msg_meta_001")
    ).first()
    assert mensaje is not None
    assert mensaje.tipo == "ENTRADA"
    assert mensaje.estado == "NUEVO"
    assert mensaje.contenido == "Hola, necesito información"
    assert mensaje.celular_id == setup_celular.id
    assert mensaje.contacto_id == contacto.id


def test_tc02_mensaje_con_imagen(session, setup_settings, setup_celular):
    """
    TC-02: Mensaje entrante con imagen adjunta
    
    Verifica:
    - Adjunto se guarda en array adjuntos
    - contenido incluye caption o "[Imagen recibida]"
    """
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "test_empresa_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "phone_number_id": "test_phone_123",
                                "display_phone_number": "+59899123456"
                            },
                            "messages": [
                                {
                                    "from": "59899111333",
                                    "id": "msg_meta_002",
                                    "timestamp": "2025-01-23T10:05:00Z",
                                    "type": "image",
                                    "image": {
                                        "id": "img_123",
                                        "mime_type": "image/jpeg",
                                        "caption": "Foto de la propiedad"
                                    }
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    mensaje = session.exec(
        select(CRMMensaje).where(CRMMensaje.origen_externo_id == "msg_meta_002")
    ).first()
    assert mensaje is not None
    assert len(mensaje.adjuntos) == 1
    assert mensaje.adjuntos[0]["tipo"] == "image"
    assert mensaje.adjuntos[0]["id"] == "img_123"
    assert mensaje.contenido == "Foto de la propiedad"


def test_tc03_status_sent(session, setup_settings, setup_celular):
    """
    TC-03: Status update - mensaje enviado (sent)
    
    Verifica:
    - estado_meta se actualiza a "sent"
    """
    # Primero crear un mensaje saliente
    contacto = CRMContacto(
        nombre_completo="Test Contacto",
        telefonos=["59899222333"],
    )
    session.add(contacto)
    session.commit()
    
    mensaje = CRMMensaje(
        tipo="SALIDA",
        canal="WHATSAPP",
        contacto_id=contacto.id,
        estado="ENVIADO",
        contenido="Respuesta del agente",
        origen_externo_id="msg_meta_out_001",
        celular_id=setup_celular.id,
    )
    session.add(mensaje)
    session.commit()
    
    # Simular webhook de status
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "test_empresa_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "phone_number_id": "test_phone_123",
                                "display_phone_number": "+59899123456"
                            },
                            "statuses": [
                                {
                                    "id": "msg_meta_out_001",
                                    "status": "sent",
                                    "timestamp": "2025-01-23T10:10:00Z",
                                    "recipient_id": "59899222333"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    session.refresh(mensaje)
    assert mensaje.estado_meta == "sent"


def test_tc04_status_delivered(session, setup_settings, setup_celular):
    """TC-04: Status update - delivered"""
    contacto = CRMContacto(nombre_completo="Test", telefonos=["59899333444"])
    session.add(contacto)
    session.commit()
    
    mensaje = CRMMensaje(
        tipo="SALIDA",
        canal="WHATSAPP",
        contacto_id=contacto.id,
        estado="ENVIADO",
        contenido="Test",
        origen_externo_id="msg_meta_out_002",
        celular_id=setup_celular.id,
        estado_meta="sent"
    )
    session.add(mensaje)
    session.commit()
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "test_empresa_123",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "test_phone_123",
                        "display_phone_number": "+59899123456"
                    },
                    "statuses": [{
                        "id": "msg_meta_out_002",
                        "status": "delivered",
                        "timestamp": "2025-01-23T10:15:00Z",
                        "recipient_id": "59899333444"
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    session.refresh(mensaje)
    assert mensaje.estado_meta == "delivered"


def test_tc05_status_read(session, setup_settings, setup_celular):
    """TC-05: Status update - read"""
    contacto = CRMContacto(nombre_completo="Test", telefonos=["59899444555"])
    session.add(contacto)
    session.commit()
    
    mensaje = CRMMensaje(
        tipo="SALIDA",
        canal="WHATSAPP",
        contacto_id=contacto.id,
        estado="ENVIADO",
        contenido="Test",
        origen_externo_id="msg_meta_out_003",
        celular_id=setup_celular.id,
        estado_meta="delivered"
    )
    session.add(mensaje)
    session.commit()
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "test_empresa_123",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "test_phone_123",
                        "display_phone_number": "+59899123456"
                    },
                    "statuses": [{
                        "id": "msg_meta_out_003",
                        "status": "read",
                        "timestamp": "2025-01-23T10:20:00Z",
                        "recipient_id": "59899444555"
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    session.refresh(mensaje)
    assert mensaje.estado_meta == "read"


def test_tc06_status_failed(session, setup_settings, setup_celular):
    """TC-06: Status update - failed con error"""
    contacto = CRMContacto(nombre_completo="Test", telefonos=["59899555666"])
    session.add(contacto)
    session.commit()
    
    mensaje = CRMMensaje(
        tipo="SALIDA",
        canal="WHATSAPP",
        contacto_id=contacto.id,
        estado="ENVIADO",
        contenido="Test",
        origen_externo_id="msg_meta_out_004",
        celular_id=setup_celular.id,
    )
    session.add(mensaje)
    session.commit()
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "test_empresa_123",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "test_phone_123",
                        "display_phone_number": "+59899123456"
                    },
                    "statuses": [{
                        "id": "msg_meta_out_004",
                        "status": "failed",
                        "timestamp": "2025-01-23T10:25:00Z",
                        "recipient_id": "59899555666",
                        "errors": [{
                            "code": 131047,
                            "title": "Re-engagement message"
                        }]
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    session.refresh(mensaje)
    assert mensaje.estado_meta == "failed"
    assert "meta_errors" in mensaje.metadata_json
    assert mensaje.metadata_json["meta_errors"][0]["code"] == 131047


def test_tc07_empresa_id_invalido(session, setup_settings):
    """TC-07: Rechazo por empresa_id inválido"""
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "empresa_desconocida_999",  # ID que no coincide
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "test_phone_123",
                        "display_phone_number": "+59899123456"
                    },
                    "messages": []
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 403


def test_tc08_celular_auto_create(session, setup_settings):
    """TC-08: Auto-creación de celular desconocido"""
    # Verificar que el celular no existe
    celular = session.exec(
        select(CRMCelular).where(CRMCelular.meta_celular_id == "new_phone_999")
    ).first()
    assert celular is None
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "test_empresa_123",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "new_phone_999",
                        "display_phone_number": "+59899999888"
                    },
                    "messages": [{
                        "from": "59899777666",
                        "id": "msg_meta_003",
                        "timestamp": "2025-01-23T10:30:00Z",
                        "type": "text",
                        "text": {"body": "Test"}
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    # Verificar que se creó el celular
    celular = session.exec(
        select(CRMCelular).where(CRMCelular.meta_celular_id == "new_phone_999")
    ).first()
    assert celular is not None
    assert celular.numero_celular == "+59899999888"
    assert celular.activo is True


def test_tc09_verificacion_webhook(session):
    """TC-09: Verificación de webhook (GET)"""
    os.environ["META_WEBHOOK_VERIFY_TOKEN"] = "test_token_123"
    
    response = client.get(
        "/api/webhooks/meta-whatsapp/",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "test_token_123",
            "hub.challenge": "challenge_12345"
        }
    )
    
    assert response.status_code == 200
    assert response.json()["challenge"] == "challenge_12345"


def test_tc10_contacto_existente(session, setup_settings, setup_celular):
    """TC-10: Mensaje entrante de contacto existente"""
    # Crear contacto previo
    contacto = CRMContacto(
        nombre_completo="Cliente Existente",
        telefonos=["59899888777"],
    )
    session.add(contacto)
    session.commit()
    contacto_id = contacto.id
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "test_empresa_123",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "test_phone_123",
                        "display_phone_number": "+59899123456"
                    },
                    "messages": [{
                        "from": "59899888777",
                        "id": "msg_meta_004",
                        "timestamp": "2025-01-23T10:35:00Z",
                        "type": "text",
                        "text": {"body": "Hola de nuevo"}
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    assert response.status_code == 200
    
    # Verificar que NO se creó un nuevo contacto
    contactos = session.exec(
        select(CRMContacto).where(CRMContacto.telefonos.contains(["59899888777"]))
    ).all()
    assert len(contactos) == 1
    assert contactos[0].id == contacto_id
    
    # Verificar mensaje asociado al contacto correcto
    mensaje = session.exec(
        select(CRMMensaje).where(CRMMensaje.origen_externo_id == "msg_meta_004")
    ).first()
    assert mensaje is not None
    assert mensaje.contacto_id == contacto_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
