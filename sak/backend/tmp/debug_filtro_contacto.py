"""
Probar diferentes formas de filtrar por contacto como lo haría React Admin
"""
import requests
import json

base_url = "http://localhost:8000"

# Primero, obtener el contacto Gustavo
print("=== PASO 1: Buscar contacto 'Gustavo' ===")
response = requests.get(f"{base_url}/crm/contactos", params={"q": "Gustavo"})
contactos = response.json()
print(f"Contactos encontrados: {len(contactos)}")
for c in contactos:
    print(f"  - ID: {c['id']}, Nombre: {c['nombre_completo']}")

# Filtrar oportunidades por ese contacto
print("\n=== PASO 2: Filtrar oportunidades por contacto_id=74 ===")

# Test 1: Parámetro directo
print("\nTEST 1: ?contacto_id=74")
response = requests.get(f"{base_url}/crm/oportunidades", params={
    "contacto_id": "74"
})
data = response.json()
ids = [item['id'] for item in data]
print(f"Oportunidades encontradas: {len(data)}")
print(f"IDs: {ids}")

# Test 2: Filtro JSON
print("\nTEST 2: ?filter={\"contacto_id\":74}")
response = requests.get(f"{base_url}/crm/oportunidades", params={
    "filter": json.dumps({"contacto_id": 74})
})
data = response.json()
ids = [item['id'] for item in data]
print(f"Oportunidades encontradas: {len(data)}")
print(f"IDs: {ids}")

# Test 3: Con range y sort (como React Admin)
print("\nTEST 3: Con range y sort")
response = requests.get(f"{base_url}/crm/oportunidades", params={
    "filter": json.dumps({"contacto_id": 74}),
    "range": json.dumps([0, 24]),
    "sort": json.dumps(["created_at", "DESC"])
})
data = response.json()
ids = [item['id'] for item in data]
print(f"Oportunidades encontradas: {len(data)}")
print(f"IDs: {ids}")
print(f"Content-Range: {response.headers.get('Content-Range')}")

# Test 4: Verificar si hay un filtro adicional activo
print("\n=== PASO 3: Verificar oportunidad 127 específicamente ===")
response = requests.get(f"{base_url}/crm/oportunidades/127")
opp = response.json()
print(f"Oportunidad 127:")
print(f"  - Título: {opp['titulo']}")
print(f"  - Contacto ID: {opp['contacto_id']}")
print(f"  - Estado: {opp['estado']}")
print(f"  - Tipo Operación ID: {opp.get('tipo_operacion_id')}")
print(f"  - Created At: {opp['created_at']}")
