"""
Probar filtro con formato array como lo envía el frontend
"""
import requests
import json
from urllib.parse import unquote

# URL del frontend decodificada
url_encoded = "http://localhost:8000/crm/contactos?filter=%7B%22id%22%3A%5B%2274%22%5D%7D"
print(f"URL original: {url_encoded}")

# Decodificar para ver el filtro
filtro_decoded = unquote(url_encoded.split("filter=")[1])
print(f"Filtro decodificado: {filtro_decoded}")

# Probar con contactos
print("\n=== TEST 1: Buscar contacto con id=[\"74\"] ===")
response = requests.get("http://localhost:8000/crm/contactos", params={
    "filter": json.dumps({"id": ["74"]})
})
print(f"Status: {response.status_code}")
data = response.json()
print(f"Contactos encontrados: {len(data)}")
if data:
    for c in data:
        print(f"  - ID: {c['id']}, Nombre: {c['nombre_completo']}")

# Probar con oportunidades
print("\n=== TEST 2: Buscar oportunidades con contacto_id=[\"74\"] ===")
response = requests.get("http://localhost:8000/crm/oportunidades", params={
    "filter": json.dumps({"contacto_id": ["74"]})
})
print(f"Status: {response.status_code}")
data = response.json()
print(f"Oportunidades encontradas: {len(data)}")
ids = [item['id'] for item in data]
print(f"IDs: {ids}")

# Comparar con formato correcto
print("\n=== TEST 3: Buscar oportunidades con contacto_id=74 (número) ===")
response = requests.get("http://localhost:8000/crm/oportunidades", params={
    "filter": json.dumps({"contacto_id": 74})
})
data = response.json()
print(f"Oportunidades encontradas: {len(data)}")
ids = [item['id'] for item in data]
print(f"IDs: {ids}")
