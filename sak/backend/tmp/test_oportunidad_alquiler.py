"""Prueba: Mensaje de contacto con OPORTUNIDAD DE ALQUILER activa → tipo_operacion_id debe ser NULL"""
import requests
import json
from datetime import datetime
from uuid import uuid4

# Usar Ana Martínez (ID: 47) - tiene oportunidad de alquiler activa (ID: 55)
payload = {
    "event_type": "message.received",
    "timestamp": datetime.now().isoformat(),
    "mensaje": {
        "id": str(uuid4()),
        "meta_message_id": f"wamid_{int(datetime.now().timestamp())}",
        "from_phone": "11-5772-3413",  # Ana Martínez
        "from_name": "Ana Martínez",
        "to_phone": "+5491112345678",
        "direccion": "in",
        "tipo": "text",
        "texto": "Hola, quiero consultar por el departamento que vi en la web",
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
print("PRUEBA: CONTACTO CON OPORTUNIDAD DE ALQUILER ACTIVA")
print("=" * 70)
print(f"Contacto: Ana Martínez (ID: 47)")
print(f"Teléfono: 11-5772-3413")
print(f"Oportunidad existente: ID 55 (tipo_operacion_id=1 - Alquiler)")
print(f"\nMensaje: {payload['mensaje']['texto']}")
print(f"\nEsperado: NO crea nueva oportunidad (ya tiene una activa)")
print(f"          El mensaje se asocia a la oportunidad existente ID 55")
print("\nEnviando request...\n")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Webhook procesado exitosamente")
        print("\nVerificar que:")
        print("  - NO se creó una nueva oportunidad")
        print("  - El mensaje se asoció a oportunidad ID 55")
    else:
        print(f"❌ Error: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")
