"""
Simular llamada HTTP real al endpoint /crm/oportunidades
"""
import requests
import json

# URL del backend
base_url = "http://localhost:8000"

print("\n=== TEST 1: GET /crm/oportunidades sin filtros ===")
response = requests.get(f"{base_url}/crm/oportunidades")
print(f"Status: {response.status_code}")
print(f"Content-Range: {response.headers.get('Content-Range')}")
data = response.json()
print(f"Total registros recibidos: {len(data)}")
oportunidad_107 = [item for item in data if item['id'] == 107]
print(f"Oportunidad 107 encontrada: {'SÍ' if oportunidad_107 else 'NO'}")
if oportunidad_107:
    print(f"Datos: {json.dumps(oportunidad_107[0], indent=2, default=str)}")

print("\n=== TEST 2: GET /crm/oportunidades?tipo_operacion_id=1 ===")
response = requests.get(f"{base_url}/crm/oportunidades", params={"tipo_operacion_id": 1})
print(f"Status: {response.status_code}")
print(f"Content-Range: {response.headers.get('Content-Range')}")
data = response.json()
print(f"Total registros recibidos: {len(data)}")
oportunidad_107 = [item for item in data if item['id'] == 107]
print(f"Oportunidad 107 encontrada: {'SÍ' if oportunidad_107 else 'NO'}")

print("\n=== TEST 3: GET /crm/oportunidades/107 directo ===")
response = requests.get(f"{base_url}/crm/oportunidades/107")
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Oportunidad 107:")
    print(f"  - ID: {data['id']}")
    print(f"  - Título: {data['titulo']}")
    print(f"  - tipo_operacion_id: {data.get('tipo_operacion_id')}")
    print(f"  - estado: {data['estado']}")
else:
    print(f"Error: {response.text}")

print("\n=== TEST 4: Simulando llamada React Admin con range y sort ===")
params = {
    "range": json.dumps([0, 9]),  # Primeros 10 registros
    "sort": json.dumps(["created_at", "DESC"])
}
response = requests.get(f"{base_url}/crm/oportunidades", params=params)
print(f"Status: {response.status_code}")
print(f"Content-Range: {response.headers.get('Content-Range')}")
data = response.json()
print(f"Total registros recibidos: {len(data)}")
oportunidad_107 = [item for item in data if item['id'] == 107]
print(f"Oportunidad 107 encontrada: {'SÍ' if oportunidad_107 else 'NO'}")

# Mostrar los IDs de las primeras 10 oportunidades
print(f"IDs recibidos: {[item['id'] for item in data]}")
