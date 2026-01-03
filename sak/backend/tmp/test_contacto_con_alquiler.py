"""Prueba 2: Contacto EXISTENTE CON propiedad en alquiler → tipo_operacion_id = 3"""
import requests
import json
from datetime import datetime
from uuid import uuid4

# Buscar primero un contacto con propiedad en alquiler
from app.db import get_session
from app.models import CRMContacto, Propiedad, CRMOportunidad
from sqlmodel import select

session = next(get_session())

# Buscar contacto con propiedad en alquiler (que NO sea Pablo Navarro)
stmt = select(Propiedad).where(
    Propiedad.tipo_operacion_id == 1,  # Alquiler
    Propiedad.estado.in_(["3-disponible", "4-alquilada"]),
    Propiedad.contacto_id != 66  # Excluir Pablo Navarro que ya probamos
).limit(1)

propiedad = session.exec(stmt).first()

if propiedad:
    contacto = session.get(CRMContacto, propiedad.contacto_id)
    
    # Desactivar oportunidades activas de este contacto
    oportunidades_activas = session.exec(
        select(CRMOportunidad).where(
            CRMOportunidad.contacto_id == contacto.id,
            CRMOportunidad.activo == True
        )
    ).all()
    
    for op in oportunidades_activas:
        op.activo = False
        session.add(op)
    
    if oportunidades_activas:
        session.commit()
        print(f"Desactivadas {len(oportunidades_activas)} oportunidad(es) activa(s) de {contacto.nombre_completo}")
    
    # Obtener teléfono
    telefono = contacto.telefonos[0] if contacto.telefonos else "desconocido"
    
    payload = {
        "event_type": "message.received",
        "timestamp": datetime.now().isoformat(),
        "mensaje": {
            "id": str(uuid4()),
            "meta_message_id": f"wamid_{int(datetime.now().timestamp())}",
            "from_phone": telefono,
            "from_name": contacto.nombre_completo,
            "to_phone": "+5491112345678",
            "direccion": "in",
            "tipo": "text",
            "texto": "Hay un problema con el termotanque, pueden enviar un técnico?",
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
    print(f"Contacto: {contacto.nombre_completo} (ID: {contacto.id})")
    print(f"Teléfono: {telefono}")
    print(f"Propiedad: {propiedad.nombre} (ID: {propiedad.id})")
    print(f"  - tipo_operacion_id: {propiedad.tipo_operacion_id} (Alquiler)")
    print(f"  - estado: {propiedad.estado}")
    print(f"\nMensaje: {payload['mensaje']['texto']}")
    print(f"\nEsperado: tipo_operacion_id = 3 (mantenimiento)")
    print("\nEnviando request...\n")
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Webhook procesado exitosamente")
            print(f"\nVerifica en la BD la nueva oportunidad de contacto ID {contacto.id}")
            print("  - tipo_operacion_id debe ser 3 (mantenimiento)")
        else:
            print(f"❌ Error: {response.json()}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
else:
    print("❌ No se encontró ningún contacto con propiedad en alquiler para probar")
