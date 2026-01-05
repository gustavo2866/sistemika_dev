"""
Buscar en qué página está la oportunidad 107
"""
import requests
import json

base_url = "http://localhost:8000"

# Buscar página por página
page_size = 25
total_pages = 5  # 118 oportunidades / 25 por página = ~5 páginas

for page in range(1, total_pages + 1):
    start = (page - 1) * page_size
    end = start + page_size - 1
    
    params = {
        "range": json.dumps([start, end]),
        "sort": json.dumps(["created_at", "DESC"])
    }
    
    response = requests.get(f"{base_url}/crm/oportunidades", params=params)
    data = response.json()
    
    oportunidad_107 = [item for item in data if item['id'] == 107]
    
    if oportunidad_107:
        print(f"\n✅ Oportunidad 107 encontrada en PÁGINA {page}")
        print(f"   Range: {start}-{end}")
        print(f"   Content-Range: {response.headers.get('Content-Range')}")
        print(f"   Created At: {oportunidad_107[0]['created_at']}")
        print(f"   Posición en página: {data.index(oportunidad_107[0]) + 1}")
        break
    else:
        print(f"❌ Página {page} (range {start}-{end}): NO encontrada")
        print(f"   IDs en esta página: {[item['id'] for item in data[:5]]}... (mostrando 5)")
