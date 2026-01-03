"""Listar rutas de webhook"""
from app.main import app

print("Rutas con 'webhook':")
for route in app.routes:
    if hasattr(route, 'path') and 'webhook' in str(route.path).lower():
        methods = route.methods if hasattr(route, 'methods') else 'N/A'
        print(f"  {methods} {route.path}")
