"""
Probar con todos los filtros que envía el frontend
"""
import requests
import json
from urllib.parse import unquote

# URL del frontend
url = "http://localhost:8000/crm/oportunidades?filter=%7B%22panel_window_days%22%3A30%2C%22activo%22%3Atrue%2C%22responsable_id%22%3A1%2C%22contacto_id%22%3A%2274%22%7D&range=%5B0%2C9%5D&sort=%5B%22id%22%2C%22DESC%22%5D"

# Decodificar filtro
filtro_str = unquote(url.split("filter=")[1].split("&")[0])
print(f"Filtro decodificado: {filtro_str}")
filtro = json.loads(filtro_str)

print("\n=== Filtros aplicados ===")
for key, value in filtro.items():
    print(f"  - {key}: {value}")

# Hacer la petición exacta
print("\n=== TEST 1: Petición exacta del frontend ===")
response = requests.get("http://localhost:8000/crm/oportunidades", params={
    "filter": json.dumps(filtro),
    "range": json.dumps([0, 9]),
    "sort": json.dumps(["id", "DESC"])
})

print(f"Status: {response.status_code}")
print(f"Content-Range: {response.headers.get('Content-Range')}")
data = response.json()
print(f"Oportunidades encontradas: {len(data)}")
if data:
    for opp in data:
        print(f"  - ID: {opp['id']}, Título: {opp['titulo']}, Responsable: {opp.get('responsable_id')}, Activo: {opp.get('activo')}")

# Probar sin los filtros extras
print("\n=== TEST 2: Solo con contacto_id ===")
response = requests.get("http://localhost:8000/crm/oportunidades", params={
    "filter": json.dumps({"contacto_id": "74"}),
    "sort": json.dumps(["id", "DESC"])
})
data = response.json()
print(f"Oportunidades encontradas: {len(data)}")
ids = [item['id'] for item in data]
print(f"IDs: {ids}")

# Ver detalles de todas las oportunidades de Gustavo
print("\n=== TEST 3: Detalles de todas las oportunidades de Gustavo ===")
for opp in data:
    print(f"\nID {opp['id']}:")
    print(f"  - Título: {opp['titulo']}")
    print(f"  - Responsable ID: {opp.get('responsable_id')}")
    print(f"  - Activo: {opp.get('activo')}")
    print(f"  - Estado: {opp['estado']}")
