"""Verificar rutas disponibles consultando el servidor"""
import requests

try:
    response = requests.get("http://localhost:8000/openapi.json")
    if response.status_code == 200:
        openapi = response.json()
        paths = openapi.get("paths", {})
        
        print("Rutas con 'webhook':")
        for path, methods in paths.items():
            if "webhook" in path.lower():
                for method in methods.keys():
                    print(f"  {method.upper()} {path}")
                    
except Exception as e:
    print(f"Error: {e}")
