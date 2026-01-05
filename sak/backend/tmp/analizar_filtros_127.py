"""
Encontrar qué combinación de filtros devuelve solo la oportunidad 127
"""
import requests
import json

base_url = "http://localhost:8000"

print("=== Todas las oportunidades de Gustavo (contacto_id=74) ===")
response = requests.get(f"{base_url}/crm/oportunidades", params={
    "filter": json.dumps({"contacto_id": 74}),
    "sort": json.dumps(["id", "ASC"])
})
data = response.json()

print(f"\nTotal: {len(data)} oportunidades")
print("\nDetalles de cada una:")
for opp in data:
    print(f"\nID {opp['id']}:")
    print(f"  - Título: {opp['titulo']}")
    print(f"  - Estado: {opp['estado']}")
    print(f"  - Tipo Operación ID: {opp.get('tipo_operacion_id')}")
    print(f"  - Propiedad ID: {opp.get('propiedad_id')}")

# Probar diferentes combinaciones de filtros
print("\n\n=== TESTS: Combinaciones de filtros ===")

tests = [
    {"contacto_id": 74, "estado": "0-prospect"},
    {"contacto_id": 74, "estado": "3-cotiza"},
    {"contacto_id": 74, "tipo_operacion_id": 3},
    {"contacto_id": 74, "tipo_operacion_id": 1},
]

for i, filtro in enumerate(tests, 1):
    print(f"\nTEST {i}: {filtro}")
    response = requests.get(f"{base_url}/crm/oportunidades", params={
        "filter": json.dumps(filtro)
    })
    data = response.json()
    ids = [item['id'] for item in data]
    print(f"  Resultado: {len(data)} oportunidades - IDs: {ids}")
