"""
Probar filtro por contacto_id
"""
import requests
import json

base_url = "http://localhost:8000"

print("\n=== TEST 1: Filtrar por contacto_id=74 (Gustavo) ===")
params = {
    "contacto_id": 74,
    "sort": json.dumps(["id", "DESC"])
}

response = requests.get(f"{base_url}/crm/oportunidades", params=params)
print(f"Status: {response.status_code}")
print(f"Content-Range: {response.headers.get('Content-Range')}")

data = response.json()
print(f"Total registros recibidos: {len(data)}")

# Mostrar los IDs
ids = [item['id'] for item in data]
print(f"IDs de oportunidades de Gustavo: {ids}")

# Buscar 107
oportunidad_107 = [item for item in data if item['id'] == 107]
print(f"\n¿Oportunidad 107 encontrada? {'SÍ' if oportunidad_107 else 'NO'}")

if oportunidad_107:
    print(f"Datos de la oportunidad 107:")
    print(f"  - ID: {oportunidad_107[0]['id']}")
    print(f"  - Título: {oportunidad_107[0]['titulo']}")
    print(f"  - Contacto ID: {oportunidad_107[0]['contacto_id']}")

# TEST 2: Con filtro JSON (como lo envía React Admin)
print("\n=== TEST 2: Filtro JSON contacto_id=74 ===")
params = {
    "filter": json.dumps({"contacto_id": 74}),
    "sort": json.dumps(["id", "DESC"])
}

response = requests.get(f"{base_url}/crm/oportunidades", params=params)
print(f"Status: {response.status_code}")
data = response.json()
ids = [item['id'] for item in data]
print(f"IDs: {ids}")
print(f"¿Oportunidad 107? {107 in ids}")
