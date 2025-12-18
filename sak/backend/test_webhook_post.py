"""
Test simple del endpoint POST de webhook
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("=" * 60)
print("TEST: POST /api/webhooks/meta-whatsapp/")
print("=" * 60)

# Configurar el token
os.environ["META_WEBHOOK_VERIFY_TOKEN"] = "test_token_123"

# Payload de prueba
payload = {
    "object": "whatsapp_business_account",
    "entry": [
        {
            "id": "123456789",  # Debe coincidir con meta_w_empresa_id en settings
            "changes": [
                {
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "phone_number_id": "123456789012345",
                            "display_phone_number": "+59899123456"
                        },
                        "contacts": [
                            {
                                "profile": {"name": "Test Usuario"},
                                "wa_id": "59899999888"
                            }
                        ],
                        "messages": [
                            {
                                "from": "59899999888",
                                "id": "wamid.test123",
                                "timestamp": "2025-12-18T10:00:00Z",
                                "type": "text",
                                "text": {"body": "Hola, es una prueba"}
                            }
                        ]
                    },
                    "field": "messages"
                }
            ]
        }
    ]
}

print("\nEnviando webhook POST...")
try:
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("\n[SUCCESS] Webhook procesado correctamente")
        
        # Verificar que se creó el contacto
        from sqlmodel import Session, select
        from app.db import engine
        from app.models import CRMContacto, CRMMensaje, WebhookLog
        
        with Session(engine) as session:
            # Buscar contacto
            stmt = select(CRMContacto).where(
                CRMContacto.nombre_completo.like("%59899999888%")
            )
            contacto = session.exec(stmt).first()
            
            if contacto:
                print(f"\n[OK] Contacto creado: ID={contacto.id}, Nombre={contacto.nombre_completo}")
                print(f"     Telefonos: {contacto.telefonos}")
            else:
                print("\n[WARN] No se encontro el contacto creado")
            
            # Buscar mensaje
            stmt = select(CRMMensaje).where(
                CRMMensaje.origen_externo_id == "wamid.test123"
            )
            mensaje = session.exec(stmt).first()
            
            if mensaje:
                print(f"\n[OK] Mensaje creado: ID={mensaje.id}")
                print(f"     Tipo: {mensaje.tipo}")
                print(f"     Canal: {mensaje.canal}")
                print(f"     Contenido: {mensaje.contenido}")
                print(f"     Celular ID: {mensaje.celular_id}")
                print(f"     Contacto ID: {mensaje.contacto_id}")
            else:
                print("\n[WARN] No se encontro el mensaje creado")
            
            # Buscar webhook log
            stmt = select(WebhookLog).order_by(WebhookLog.fecha_recepcion.desc())
            log = session.exec(stmt).first()
            
            if log:
                print(f"\n[OK] Webhook Log: ID={log.id}")
                print(f"     Evento: {log.evento}")
                print(f"     Procesado: {log.procesado}")
                print(f"     Status: {log.response_status}")
            
    else:
        print(f"\n[ERROR] Webhook fallo con status {response.status_code}")
        
except Exception as e:
    print(f"\n[ERROR] Exception: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
