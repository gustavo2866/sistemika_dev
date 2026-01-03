"""Prueba 2B: Pablo Navarro (contacto existente con alquiler) - nuevo mensaje"""
import requests
import json
from datetime import datetime
from uuid import uuid4
from app.db import get_session
from app.models import CRMOportunidad
from sqlmodel import select

session = next(get_session())

# Desactivar oportunidad activa de Pablo
pablo_id = 66
oportunidades_activas = session.exec(
    select(CRMOportunidad).where(
        CRMOportunidad.contacto_id == pablo_id,
        CRMOportunidad.activo == True
    )
).all()

for op in oportunidades_activas:
    op.activo = False
    session.add(op)

if oportunidades_activas:
    session.commit()
    print(f"Desactivadas {len(oportunidades_activas)} oportunidad(es) activa(s)\n")

payload = {
    "event_type": "message.received",
    "timestamp": datetime.now().isoformat(),
    "mensaje": {
        "id": str(uuid4()),
        "meta_message_id": f"wamid_{int(datetime.now().timestamp())}",
        "from_phone": "11-6265-2312",  # Pablo Navarro
        "from_name": "Pablo Navarro",
        "to_phone": "+5491112345678",
        "direccion": "in",
        "tipo": "text",
        "texto": "Se rompió el lavarropas, necesito que manden un técnico urgente",
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
print("PRUEBA 2: CONTACTO EXISTENTE CON PROPIEDAD EN ALQUILER")
print("=" * 70)
print(f"Contacto: Pablo Navarro (ID: 66)")
print(f"Teléfono: 11-6265-2312")
print(f"Propiedad: Torre Palermo (ID: 4)")
print(f"  - tipo_operacion_id: 1 (Alquiler)")
print(f"  - estado: 4-alquilada")
print(f"\nMensaje: {payload['mensaje']['texto']}")
print(f"\nEsperado: tipo_operacion_id = 3 (mantenimiento)")
print("\nEnviando request...\n")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Webhook procesado exitosamente")
        print(f"\nVerifica en la BD la nueva oportunidad de Pablo Navarro")
        print("  - tipo_operacion_id debe ser 3 (mantenimiento)")
    else:
        print(f"❌ Error: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")
