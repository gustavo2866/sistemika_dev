"""
Test manual con rango de fechas más amplio para incluir datos de prueba.
"""

import requests
from datetime import datetime

API_URL = "http://localhost:8000"

# Rango amplio: desde 2023 hasta hoy
end_date = datetime.now().date()
start_date = datetime(2023, 1, 1).date()

params = {
    'startDate': start_date.isoformat(),
    'endDate': end_date.isoformat(),
    'limitTop': 10,
    'includeItems': False
}

print(f"🔍 Consultando dashboard con rango: {start_date} a {end_date}\n")

response = requests.get(f"{API_URL}/api/dashboard/vacancias", params=params)

if response.status_code == 200:
    data = response.json()
    
    print("📊 KPIs:")
    for key, value in data['kpis'].items():
        print(f"  {key}: {value}")
    
    print(f"\n📦 Buckets: {len(data['buckets'])} encontrados")
    for bucket in data['buckets'][:5]:
        print(f"  {bucket['bucket']}: {bucket['count']} vacancias, {bucket['dias_totales']} días totales")
    
    print(f"\n🏁 Estados finales:")
    for estado, count in data['estados_finales'].items():
        print(f"  {estado}: {count}")
    
    print(f"\n🏆 Top {len(data['top'])} vacancias:")
    for i, item in enumerate(data['top'], 1):
        v = item['vacancia']
        print(f"  {i}. Propiedad #{v['propiedad_id']} - {item['dias_totales']} días totales")
        print(f"     Reparación: {item['dias_reparacion']} días, Disponible: {item['dias_disponible']} días")
        print(f"     Estado corte: {item['estado_corte']}, Bucket: {item['bucket']}")
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)
