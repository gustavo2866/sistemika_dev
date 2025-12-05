import requests
import json
from collections import Counter

# Probar endpoint con perPage=500
response = requests.get(
    'http://localhost:8000/crm/oportunidades',
    params={'filter': json.dumps({'activo': True}), '_end': 500, '_start': 0}
)

print(f'Status: {response.status_code}')
data = response.json()

# El endpoint devuelve una lista directamente
if isinstance(data, list):
    registros = data
else:
    registros = data.get("data", [])
    
print(f'Total registros devueltos: {len(registros)}')

# Contar por estado
estados = [r['estado'] for r in registros]
conteo = Counter(estados)

print('\nConteo por estado:')
for estado, count in sorted(conteo.items()):
    print(f'  {estado}: {count}')

# Verificar específicamente ganada y perdida
ganadas = [r for r in registros if r['estado'] == '5-ganada']
perdidas = [r for r in registros if r['estado'] == '6-perdida']

print(f'\n✓ Registros en estado 5-ganada: {len(ganadas)}')
print(f'✓ Registros en estado 6-perdida: {len(perdidas)}')

if len(ganadas) > 0:
    print(f'\nEjemplo de oportunidad ganada: ID={ganadas[0]["id"]}, titulo={ganadas[0].get("titulo", "N/A")}')
if len(perdidas) > 0:
    print(f'Ejemplo de oportunidad perdida: ID={perdidas[0]["id"]}, titulo={perdidas[0].get("titulo", "N/A")}')
