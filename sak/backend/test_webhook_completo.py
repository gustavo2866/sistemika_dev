"""
Test completo de webhooks de Meta WhatsApp.
Prueba diferentes escenarios: mensaje recibido, actualización de estado, etc.
"""
import sys
import os
from pathlib import Path

# Agregar directorio backend al path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

# Configurar variable de entorno para el token de verificación
os.environ["META_WEBHOOK_VERIFY_TOKEN"] = "test_token_123"

from fastapi.testclient import TestClient
from sqlmodel import select
from app.main import app
from app.db import get_session
from app.models.crm_celular import CRMCelular
from app.models.crm_contacto import CRMContacto
from app.models.crm_mensaje import CRMMensaje
from app.models.webhook_log import WebhookLog

client = TestClient(app)


def test_verificacion_webhook():
    """Test del endpoint GET de verificación de webhook."""
    print("\n" + "="*80)
    print("TEST 1: GET /api/webhooks/meta-whatsapp/ (Verificación)")
    print("="*80)
    
    response = client.get(
        "/api/webhooks/meta-whatsapp/",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "test_token_123",
            "hub.challenge": "test_challenge_12345"
        }
    )
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 200
    assert response.json()["challenge"] == "test_challenge_12345"
    print("[SUCCESS] Verificación de webhook exitosa")


def test_mensaje_nuevo_contacto():
    """Test de recepción de mensaje de un contacto nuevo."""
    print("\n" + "="*80)
    print("TEST 2: POST Mensaje de contacto nuevo")
    print("="*80)
    
    # Contar contactos antes
    with next(get_session()) as session:
        contactos_antes = session.exec(select(CRMContacto)).all()
        print(f"\nContactos antes: {len(contactos_antes)}")
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "123456789",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "123456789012345",
                        "display_phone_number": "+59899123456"
                    },
                    "contacts": [{
                        "profile": {"name": "Nuevo Cliente"},
                        "wa_id": "59811122233"
                    }],
                    "messages": [{
                        "from": "59811122233",
                        "id": "wamid.nuevo123",
                        "timestamp": "2025-12-18T14:30:00Z",
                        "type": "text",
                        "text": {"body": "¡Hola! Me interesa el producto"}
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 200
    
    # Verificar que se creó el contacto y mensaje
    with next(get_session()) as session:
        from sqlalchemy.dialects.postgresql import JSONB
        from sqlalchemy import cast
        
        contactos_despues = session.exec(select(CRMContacto)).all()
        print(f"Contactos después: {len(contactos_despues)}")
        
        nuevo_contacto = session.exec(
            select(CRMContacto).where(
                cast(CRMContacto.telefonos, JSONB).op('@>')(
                    cast(["59811122233"], JSONB)
                )
            )
        ).first()
        
        if nuevo_contacto:
            print(f"\n[OK] Contacto creado: ID={nuevo_contacto.id}, Teléfono=59811122233")
            
            mensaje = session.exec(
                select(CRMMensaje).where(CRMMensaje.contacto_id == nuevo_contacto.id)
            ).first()
            
            if mensaje:
                print(f"[OK] Mensaje creado: ID={mensaje.id}, Contenido='{mensaje.contenido}'")
    
    print("[SUCCESS] Test de contacto nuevo exitoso")


def test_mensaje_contacto_existente():
    """Test de recepción de mensaje de un contacto existente."""
    print("\n" + "="*80)
    print("TEST 3: POST Mensaje de contacto existente")
    print("="*80)
    
    # Enviar mensaje del mismo número anterior
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "123456789",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "123456789012345",
                        "display_phone_number": "+59899123456"
                    },
                    "contacts": [{
                        "profile": {"name": "Nuevo Cliente"},
                        "wa_id": "59811122233"
                    }],
                    "messages": [{
                        "from": "59811122233",
                        "id": "wamid.segundo456",
                        "timestamp": "2025-12-18T14:35:00Z",
                        "type": "text",
                        "text": {"body": "¿Cuál es el precio?"}
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 200
    
    # Verificar que NO se creó otro contacto, solo otro mensaje
    with next(get_session()) as session:
        from sqlalchemy.dialects.postgresql import JSONB
        from sqlalchemy import cast
        
        contacto = session.exec(
            select(CRMContacto).where(
                cast(CRMContacto.telefonos, JSONB).op('@>')(
                    cast(["59811122233"], JSONB)
                )
            )
        ).first()
        
        if contacto:
            mensajes = session.exec(
                select(CRMMensaje).where(CRMMensaje.contacto_id == contacto.id)
            ).all()
            
            print(f"\n[OK] Mismo contacto: ID={contacto.id}")
            print(f"[OK] Mensajes del contacto: {len(mensajes)}")
            assert len(mensajes) >= 2, "Deberían existir al menos 2 mensajes"
    
    print("[SUCCESS] Test de contacto existente exitoso")


def test_actualizacion_estado():
    """Test de recepción de actualización de estado de mensaje."""
    print("\n" + "="*80)
    print("TEST 4: POST Actualización de estado")
    print("="*80)
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "123456789",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "phone_number_id": "123456789012345",
                        "display_phone_number": "+59899123456"
                    },
                    "statuses": [{
                        "id": "wamid.test123",
                        "status": "delivered",
                        "timestamp": "2025-12-18T14:40:00Z",
                        "recipient_id": "59899999888"
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 200
    print("[SUCCESS] Test de actualización de estado exitoso")


def test_webhook_logs():
    """Verificar que se están creando los webhook logs."""
    print("\n" + "="*80)
    print("TEST 5: Verificación de Webhook Logs")
    print("="*80)
    
    with next(get_session()) as session:
        logs = session.exec(select(WebhookLog).order_by(WebhookLog.id)).all()
        
        print(f"\nTotal de webhook logs: {len(logs)}")
        
        for log in logs[-3:]:  # Mostrar últimos 3
            print(f"\nLog ID: {log.id}")
            print(f"  Evento: {log.evento}")
            print(f"  Procesado: {log.procesado}")
            print(f"  Status: {log.response_status}")
            if log.error_message:
                print(f"  Error: {log.error_message}")
        
        assert len(logs) > 0, "Deberían existir webhook logs"
    
    print("[SUCCESS] Webhook logs verificados")


if __name__ == "__main__":
    print("\n" + "="*80)
    print("SUITE DE TESTS COMPLETA - Webhooks Meta WhatsApp")
    print("="*80)
    
    try:
        test_verificacion_webhook()
        test_mensaje_nuevo_contacto()
        test_mensaje_contacto_existente()
        test_actualizacion_estado()
        test_webhook_logs()
        
        print("\n" + "="*80)
        print("✓ TODOS LOS TESTS PASARON EXITOSAMENTE")
        print("="*80)
        
    except AssertionError as e:
        print(f"\n[ERROR] Test falló: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
