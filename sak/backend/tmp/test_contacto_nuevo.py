"""Prueba 1: Contacto NUEVO sin propiedades → tipo_operacion_id debe ser NULL"""
import requests
import json
from datetime import datetime
from uuid import uuid4

# Payload con contacto completamente nuevo
payload = {
    "event_type": "message.received",
    "timestamp": datetime.now().isoformat(),
    "mensaje": {
        "id": str(uuid4()),
        "meta_message_id": f"wamid_{int(datetime.now().timestamp())}",
        "from_phone": "11-9999-8888",  # Teléfono nuevo que NO existe en BD
        "from_name": "María Rodriguez",  # Nombre nuevo
        "to_phone": "+5491112345678",
        "direccion": "in",
        "tipo": "text",
        "texto": "Hola, me interesa alquilar un departamento en Palermo",
        "status": "received",
        "meta_timestamp": datetime.now().isoformat(),
        "created_at": datetime.now().isoformat(),
        "celular": {
            "id": str(uuid4()),
            "alias": "Canal Principal",
            "phone_number": "5491112345678"
        }
    }
}

url = "http://localhost:8000/api/webhooks/meta-whatsapp/"

print("=" * 70)
print("PRUEBA 1: CONTACTO NUEVO SIN PROPIEDADES")
print("=" * 70)
print(f"Contacto: María Rodriguez (NUEVO)")
print(f"Teléfono: 11-9999-8888")
print(f"Mensaje: {payload['mensaje']['texto']}")
print(f"\nEsperado: tipo_operacion_id = NULL (sin propiedades en alquiler)")
print("\nEnviando request...\n")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Webhook procesado exitosamente")
        print("\nAhora verifica en la BD:")
        print("  - Nuevo contacto 'María Rodriguez' creado")
        print("  - Nueva oportunidad con tipo_operacion_id = NULL")
    else:
        print(f"❌ Error: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")
