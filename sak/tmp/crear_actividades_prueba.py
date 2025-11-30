import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

# Usar la oportunidad 6520 que ya existe
oportunidad_id = 6520
contacto_id = 42

print("=" * 70)
print("CREANDO ACTIVIDADES ADICIONALES PARA PRUEBA")
print("=" * 70)
print()

# Crear 2 mensajes de salida (respuestas)
print("1. Creando mensajes de respuesta...")
for i in range(2):
    mensaje_payload = {
        "tipo": "salida",
        "canal": "whatsapp",
        "contenido": f"Respuesta #{i+1}: Gracias por tu interés. Tenemos varias opciones disponibles en tu rango de presupuesto. ¿Cuándo podríamos coordinar una visita?",
        "estado": "enviado",
        "contacto_id": contacto_id,
        "oportunidad_id": oportunidad_id,
        "responsable_id": 1
    }
    
    response = requests.post(f"{BASE_URL}/crm/mensajes", json=mensaje_payload)
    if response.status_code in [200, 201]:
        msg = response.json()
        print(f"   ✓ Mensaje salida creado - ID: {msg['id']}")

# Crear 2 eventos adicionales
print("\n2. Creando eventos de seguimiento...")
eventos = [
    {
        "descripcion": "Llamada telefónica - Cliente interesado en visitar las unidades disponibles",
        "tipo_id": 1,
        "motivo_id": 1,
        "estado_evento": "hecho",
    },
    {
        "descripcion": "Visita programada para el próximo sábado a las 10:00 AM",
        "tipo_id": 1,
        "motivo_id": 1,
        "estado_evento": "pendiente",
    }
]

for evento_data in eventos:
    evento_payload = {
        **evento_data,
        "contacto_id": contacto_id,
        "oportunidad_id": oportunidad_id,
        "asignado_a_id": 1,
        "fecha_evento": datetime.now().isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/crm/eventos", json=evento_payload)
    if response.status_code in [200, 201]:
        ev = response.json()
        print(f"   ✓ Evento creado - ID: {ev['id']}, Estado: {ev['estado_evento']}")

print()
print("=" * 70)
print("ACTIVIDADES TOTALES DESPUÉS DE LA PRUEBA")
print("=" * 70)
print()

# Consultar actividades del mensaje 23
response = requests.get(f"{BASE_URL}/crm/mensajes/23/actividades")
if response.status_code == 200:
    data = response.json()
    print(f"✓ Total de Actividades: {data['total']}")
    print()
    
    tipos_count = {}
    for act in data['actividades']:
        tipos_count[act['tipo']] = tipos_count.get(act['tipo'], 0) + 1
    
    print("Resumen por tipo:")
    for tipo, count in tipos_count.items():
        print(f"  • {tipo.capitalize()}: {count}")
    
    print()
    print("=" * 70)
    print("Vista previa de las últimas 3 actividades:")
    print("=" * 70)
    
    for actividad in data['actividades'][:3]:
        fecha = datetime.fromisoformat(actividad['fecha'].replace('Z', '+00:00'))
        print(f"\n[{actividad['tipo'].upper()}] {fecha.strftime('%d/%m %H:%M')}")
        print(f"{actividad['descripcion'][:60]}...")
        if actividad['tipo'] == 'mensaje':
            print(f"Canal: {actividad['canal']} | {actividad['tipo_mensaje']}")
        else:
            print(f"Estado: {actividad['estado']}")

print()
print("=" * 70)
print("✓ Datos listos para visualizar en el frontend")
print("URL: http://localhost:3000/admin/crm-mensajes/23/show")
print("=" * 70)
