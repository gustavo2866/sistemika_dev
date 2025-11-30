import requests

BASE_URL = "http://localhost:8000"

# Probar con mensaje que tiene oportunidad
mensaje_id = 23

print("=" * 70)
print(f"TEST: Verificar actividades del mensaje #{mensaje_id}")
print("=" * 70)

# 1. Crear una respuesta de salida
print("\n1. Creando respuesta de salida...")
respuesta_payload = {
    "tipo": "salida",
    "canal": "whatsapp",
    "contenido": "Respuesta de prueba para verificar que aparezca en actividades",
    "estado": "pendiente_envio",
    "contacto_id": 42,
    "oportunidad_id": 6520,
    "responsable_id": 1,
    "asunto": "RE: Test actividades"
}

response = requests.post(f"{BASE_URL}/crm/mensajes", json=respuesta_payload)
if response.status_code in [200, 201]:
    nueva_respuesta = response.json()
    print(f"   ✓ Respuesta creada - ID: {nueva_respuesta['id']}")
    print(f"   Canal: {nueva_respuesta['canal']}")
    print(f"   Estado: {nueva_respuesta['estado']}")
    print(f"   Oportunidad ID: {nueva_respuesta.get('oportunidad_id')}")
else:
    print(f"   ✗ Error: {response.status_code}")
    print(response.text)

# 2. Consultar actividades
print(f"\n2. Consultando actividades del mensaje #{mensaje_id}...")
response = requests.get(f"{BASE_URL}/crm/mensajes/{mensaje_id}/actividades")

if response.status_code == 200:
    data = response.json()
    print(f"   ✓ Total actividades: {data['total']}")
    print(f"   Oportunidad ID: {data['oportunidad_id']}")
    
    print("\n   Últimas 5 actividades:")
    for i, act in enumerate(data['actividades'][:5], 1):
        print(f"   {i}. [{act['tipo'].upper()}] ID:{act['id']}")
        print(f"      Descripción: {act['descripcion'][:50]}...")
        if act['tipo'] == 'mensaje':
            print(f"      Canal: {act['canal']}, Tipo: {act['tipo_mensaje']}, Estado: {act['estado']}")
        else:
            print(f"      Estado: {act['estado']}")
        print()
else:
    print(f"   ✗ Error: {response.status_code}")
    print(response.text)

print("=" * 70)
print("Verificación completada")
print("URL del frontend: http://localhost:3000/admin/crm-mensajes/23/show")
print("=" * 70)
