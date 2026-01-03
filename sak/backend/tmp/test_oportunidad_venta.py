"""Prueba: Mensaje de contacto con OPORTUNIDAD DE VENTA activa → tipo_operacion_id debe ser NULL"""
import requests
import json
from datetime import datetime
from uuid import uuid4

# Usar Emilia Vega (ID: 71) - tiene oportunidad de venta activa (ID: 59)
payload = {
    "event_type": "message.received",
    "timestamp": datetime.now().isoformat(),
    "mensaje": {
        "id": str(uuid4()),
        "meta_message_id": f"wamid_{int(datetime.now().timestamp())}",
        "from_phone": "11-4291-5314",  # Emilia Vega
        "from_name": "Emilia Vega",
        "to_phone": "+5491112345678",
        "direccion": "in",
        "tipo": "text",
        "texto": "Buenos días, consulto por el precio de venta de la propiedad",
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
print("PRUEBA: CONTACTO CON OPORTUNIDAD DE VENTA ACTIVA")
print("=" * 70)
print(f"Contacto: Emilia Vega (ID: 71)")
print(f"Teléfono: 11-4291-5314")
print(f"Oportunidad existente: ID 59 (tipo_operacion_id=2 - Venta)")
print(f"\nMensaje: {payload['mensaje']['texto']}")
print(f"\nEsperado: NO crea nueva oportunidad (ya tiene una activa)")
print(f"          El mensaje se asocia a la oportunidad existente ID 59")
print("\nEnviando request...\n")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Webhook procesado exitosamente")
        print("\nVerificar que:")
        print("  - NO se creó una nueva oportunidad")
        print("  - El mensaje se asoció a oportunidad ID 59")
    else:
        print(f"❌ Error: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")
