"""
Script para probar webhook en producción
"""
import requests
import json
from datetime import datetime, UTC
from uuid import uuid4

# Configuración para PRODUCCIÓN
API_URL = "https://sak-backend-94464199991.us-central1.run.app"
WEBHOOK_ENDPOINT = f"{API_URL}/api/webhooks/meta-whatsapp/"

# Simular datos de un mensaje entrante desde un número nuevo
webhook_payload = {
    "event_type": "message.received",
    "timestamp": datetime.now(UTC).isoformat(),
    "mensaje": {
        "id": str(uuid4()),
        "meta_message_id": f"wamid.PROD{datetime.now().timestamp()}",
        "from_phone": "+5491177889900",  # Número de prueba para producción
        "from_name": "Carlos Mendoza",  # Nombre del contacto desde WhatsApp
        "to_phone": "+15551676015",  # Tu número business
        "direccion": "in",
        "tipo": "text",
        "texto": "¡Hola! Vi su publicación y me interesa conocer más sobre propiedades en venta en Belgrano.",
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

def test_production_webhook():
    """Envía el webhook simulado al endpoint de PRODUCCIÓN"""
    
    print("=" * 70)
    print("🚀 TEST: Webhook en PRODUCCIÓN")
    print("=" * 70)
    print(f"\n🌐 Endpoint: {WEBHOOK_ENDPOINT}")
    print(f"👤 Contacto: Carlos Mendoza (+5491177889900)")
    print(f"💬 Mensaje: {webhook_payload['mensaje']['texto']}")
    print("\n" + "=" * 70)
    
    try:
        print("📤 Enviando request a producción...")
        response = requests.post(
            WEBHOOK_ENDPOINT,
            json=webhook_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"\n✅ Status Code: {response.status_code}")
        print(f"\n📋 Response:")
        print(json.dumps(response.json(), indent=2))
        
        if response.status_code == 200:
            result = response.json()
            print("\n🎉 ¡WEBHOOK PROCESADO EXITOSAMENTE EN PRODUCCIÓN!")
            print("=" * 70)
            if 'oportunidad_id' in result:
                print(f"🎯 Oportunidad ID: {result['oportunidad_id']}")
            if 'mensaje_id' in result:
                print(f"📧 Mensaje ID: {result['mensaje_id']}")
            if 'contacto_id' in result:
                print(f"👤 Contacto ID: {result['contacto_id']}")
        else:
            print(f"\n⚠️  Error al procesar webhook en producción")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: No se pudo conectar al servidor de producción")
    except requests.exceptions.Timeout:
        print("\n⏰ Error: Timeout al conectar con producción")
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    test_production_webhook()