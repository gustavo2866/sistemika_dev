import requests
from datetime import datetime
import random

BASE_URL = "http://localhost:8000"

# Generar una referencia única
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
random_suffix = random.randint(1000, 9999)
referencia_unica = f"+549{random.randint(11, 99)}{random.randint(100000, 999999)}"
origen_externo = f"whatsapp_msg_{timestamp}_{random_suffix}"

# Contenidos variados para hacer el mensaje más realista
contenidos = [
    "Buenos días, me gustaría información sobre departamentos en venta en la zona de Palermo. Tengo un presupuesto de USD 200,000. ¿Tienen opciones disponibles?",
    "Hola! Vi su publicación de la casa en Belgrano. ¿Está todavía disponible? Me interesa coordinar una visita para este fin de semana.",
    "Consulta: estoy buscando un local comercial para alquilar en Microcentro, aproximadamente 80m2. ¿Tienen disponibilidad?",
    "Buen día, quiero vender mi departamento de 3 ambientes en Caballito. ¿Pueden hacerme una tasación? Necesito vender urgente.",
    "Hola, me interesa invertir en un monoambiente para alquilar. Presupuesto hasta USD 100,000. ¿Qué opciones tienen?"
]

contenido = random.choice(contenidos)

mensaje_payload = {
    "canal": "whatsapp",
    "estado": "recibido",
    "contenido": contenido,
    "contacto_alias": referencia_unica,
    "origen_externo_id": origen_externo,
    "responsable_id": 1
}

print("=" * 70)
print("CREANDO NUEVO MENSAJE")
print("=" * 70)
print(f"Referencia: {referencia_unica}")
print(f"Origen Externo ID: {origen_externo}")
print(f"Contenido: {contenido[:80]}...")
print()

try:
    response = requests.post(f"{BASE_URL}/crm/mensajes", json=mensaje_payload)
    
    if response.status_code in [200, 201]:
        mensaje = response.json()
        print("✓ MENSAJE CREADO EXITOSAMENTE")
        print("=" * 70)
        print(f"ID: {mensaje['id']}")
        print(f"Canal: {mensaje['canal']}")
        print(f"Estado: {mensaje['estado']}")
        print(f"Contacto Alias: {mensaje.get('contacto_alias')}")
        print(f"Origen Externo ID: {mensaje.get('origen_externo_id')}")
        print(f"Responsable ID: {mensaje.get('responsable_id')}")
        print(f"Fecha Mensaje: {mensaje.get('fecha_mensaje')}")
        print()
        print("Contenido completo:")
        print("-" * 70)
        print(mensaje['contenido'])
        print("-" * 70)
        print()
        print("📋 URL para ver el mensaje en el frontend:")
        print(f"http://localhost:3000/admin/crm-mensajes/{mensaje['id']}/show")
        print()
        print("✓ Este mensaje NO tiene contacto asociado todavía")
        print("✓ Este mensaje NO tiene oportunidad asociada")
        print("✓ El botón de 'Vincular Oportunidad' debería estar ACTIVO")
        print()
        print("=" * 70)
        print(f"MENSAJE ID: {mensaje['id']}")
        print("=" * 70)
        
    else:
        print(f"✗ Error al crear mensaje: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"✗ Error: {str(e)}")
