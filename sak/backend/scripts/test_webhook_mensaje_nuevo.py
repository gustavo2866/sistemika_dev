"""
Script de prueba: simula un webhook de meta-w con mensaje entrante de número nuevo
"""
import requests
import json
from datetime import datetime, UTC
from uuid import uuid4

# Configuración
API_URL = "http://localhost:8000"
WEBHOOK_ENDPOINT = f"{API_URL}/api/webhooks/meta-whatsapp/"

# Simular datos de un mensaje entrante desde un número nuevo
webhook_payload = {
    "event_type": "message.received",
    "timestamp": datetime.now(UTC).isoformat(),
    "mensaje": {
        "id": str(uuid4()),
        "meta_message_id": f"wamid.TEST{datetime.now().timestamp()}",
        "from_phone": "+5491155443322",  # Otro número nuevo
        "from_name": "Laura Fernández",  # Nombre del contacto desde WhatsApp
        "to_phone": "+15551676015",  # Tu número business
        "direccion": "in",
        "tipo": "text",
        "texto": "Hola, estoy interesada en alquilar una propiedad en zona norte. ¿Tienen disponibilidad?",
        "media_id": None,
        "caption": None,
        "filename": None,
        "mime_type": None,
        "status": "delivered",
        "meta_timestamp": datetime.now(UTC).isoformat(),
        "created_at": datetime.now(UTC).isoformat(),
        "celular": {
            "id": str(uuid4()),
            "alias": "Canal Principal",
            "phone_number": "+15551676015"
        }
    }
}

def test_webhook():
    """Envía el webhook simulado al endpoint"""
    
    print("=" * 60)
    print("TEST: Webhook de mensaje entrante desde número nuevo")
    print("=" * 60)
    print(f"\nEndpoint: {WEBHOOK_ENDPOINT}")
    print(f"\nPayload:")
    print(json.dumps(webhook_payload, indent=2, default=str))
    print("\n" + "=" * 60)
    
    try:
        response = requests.post(
            WEBHOOK_ENDPOINT,
            json=webhook_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"\n✅ Status Code: {response.status_code}")
        print(f"\nResponse:")
        print(json.dumps(response.json(), indent=2))
        
        if response.status_code == 200:
            print("\n🎉 Webhook procesado exitosamente")
            print("\nVerifica en la base de datos:")
            print("  - Nuevo contacto creado: Juan Pérez (+5491198765432)")
            print("  - Nuevo mensaje entrante registrado")
            print("  - Log del webhook en tabla webhook_logs")
        else:
            print(f"\n⚠️  Error al procesar webhook")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: No se pudo conectar al backend")
        print("   Asegúrate de que el servidor esté corriendo en http://localhost:8000")
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    test_webhook()
