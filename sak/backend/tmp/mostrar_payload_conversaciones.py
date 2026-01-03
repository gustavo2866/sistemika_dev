"""Mostrar payload completo del endpoint de conversaciones"""
import requests
import json

url = "http://localhost:8000/crm/mensajes/acciones/conversaciones"
params = {
    "limit": 3,
    "canal": "whatsapp"
}

print("=" * 70)
print("PAYLOAD COMPLETO DEL ENDPOINT")
print("=" * 70)
print(f"URL: {url}")
print(f"Params: {params}\n")

try:
    response = requests.get(url, params=params)
    print(f"Status Code: {response.status_code}\n")
    
    if response.status_code == 200:
        data = response.json()
        
        # Mostrar JSON completo formateado
        print("PAYLOAD JSON:")
        print("=" * 70)
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("=" * 70)
        
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Error: {e}")
