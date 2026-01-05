"""
Probar ordenamiento por ID descendente
"""
import requests
import json

base_url = "http://localhost:8000"

print("\n=== TEST: GET /crm/oportunidades ordenado por ID DESC ===")
params = {
    "range": json.dumps([0, 24]),  # Primeros 25 registros
    "sort": json.dumps(["id", "DESC"])
}

response = requests.get(f"{base_url}/crm/oportunidades", params=params)
print(f"Status: {response.status_code}")
print(f"Content-Range: {response.headers.get('Content-Range')}")

data = response.json()
print(f"Total registros recibidos: {len(data)}")

# Mostrar los IDs
ids = [item['id'] for item in data]
print(f"\nIDs recibidos (ordenados por ID DESC):")
print(ids)

# Buscar 107
oportunidad_107 = [item for item in data if item['id'] == 107]
print(f"\n¿Oportunidad 107 encontrada? {'SÍ' if oportunidad_107 else 'NO'}")

# Ver el rango de IDs
print(f"\nRango de IDs: {max(ids)} - {min(ids)}")
print(f"¿El ID 107 está en este rango? {107 >= min(ids) and 107 <= max(ids)}")

# Probar con más registros
print("\n=== TEST 2: Primeros 50 registros ===")
params = {
    "range": json.dumps([0, 49]),
    "sort": json.dumps(["id", "DESC"])
}

response = requests.get(f"{base_url}/crm/oportunidades", params=params)
data = response.json()
ids = [item['id'] for item in data]
print(f"IDs recibidos: {len(ids)}")
print(f"Rango: {max(ids)} - {min(ids)}")
oportunidad_107 = [item for item in data if item['id'] == 107]
print(f"¿Oportunidad 107 encontrada? {'SÍ' if oportunidad_107 else 'NO'}")

# Buscar todos
print("\n=== TEST 3: Todos los registros (sin paginación) ===")
response = requests.get(f"{base_url}/crm/oportunidades")
data = response.json()
all_ids = [item['id'] for item in data]
print(f"Total registros: {len(all_ids)}")
print(f"¿ID 107 existe en la respuesta? {107 in all_ids}")

if 107 in all_ids:
    index = all_ids.index(107)
    print(f"Posición del ID 107 en la lista sin ordenar: {index + 1}")
