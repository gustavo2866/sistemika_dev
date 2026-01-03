"""Script para simular webhook de WhatsApp para Pablo Navarro"""
import requests
import json
from datetime import datetime
from uuid import uuid4

# Payload simulado de webhook de Meta WhatsApp con todos los campos requeridos
payload = {
    "event_type": "message.received",
    "timestamp": datetime.now().isoformat(),
    "mensaje": {
        "id": str(uuid4()),  # UUID válido
        "meta_message_id": f"wamid_{int(datetime.now().timestamp())}",
        "from_phone": "11-6265-2312",  # Pablo Navarro (formato exacto en BD)
        "from_name": "Pablo Navarro",
        "to_phone": "+5491112345678",  # Nuestro número
        "direccion": "in",
        "tipo": "text",
        "texto": "Hola, tengo un problema con la caldera del departamento",
        "status": "received",
        "meta_timestamp": datetime.now().isoformat(),
        "created_at": datetime.now().isoformat(),
        "celular": {
            "id": str(uuid4()),  # UUID válido
            "alias": "Canal Principal",
            "phone_number": "5491112345678"
        }
    }
}

# Endpoint del webhook
url = "http://localhost:8000/api/webhooks/meta-whatsapp/"

print("=" * 60)
print("SIMULACIÓN DE MENSAJE WHATSAPP")
print("=" * 60)
print(f"\nContacto: Pablo Navarro")
print(f"Teléfono: +5491162652312")
print(f"Mensaje: {payload['mensaje']['texto']}")
print("\nEnviando request al webhook...\n")

try:
    response = requests.post(url, json=payload)
    
    print(f"Status Code: {response.status_code}")
    print(f"\nRespuesta:")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    if response.status_code == 200:
        result = response.json()
        print("\n" + "=" * 60)
        print("✅ WEBHOOK PROCESADO EXITOSAMENTE")
        print("=" * 60)
        if 'oportunidad_id' in result:
            print(f"\n🎯 Oportunidad ID: {result['oportunidad_id']}")
            print(f"   Tipo Operación ID: {result.get('tipo_operacion_id', 'N/A')}")
        if 'mensaje_id' in result:
            print(f"📧 Mensaje ID: {result['mensaje_id']}")
        if 'contacto_id' in result:
            print(f"👤 Contacto ID: {result['contacto_id']}")
            
except requests.exceptions.ConnectionError:
    print("❌ Error: No se pudo conectar al servidor backend")
    print("   Asegúrate de que el servidor esté corriendo en http://localhost:8000")
except Exception as e:
    print(f"❌ Error inesperado: {e}")
