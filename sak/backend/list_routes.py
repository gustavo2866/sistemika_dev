from app.main import app

print("🔍 Rutas con 'responder':")
for route in app.routes:
    if hasattr(route, 'path') and 'responder' in str(route.path):
        print(f"  {route.methods if hasattr(route, 'methods') else 'N/A'} {route.path}")

print("\n🔍 Rutas de crm/mensajes:")
for route in app.routes:
    if hasattr(route, 'path') and 'mensajes' in str(route.path):
        print(f"  {route.methods if hasattr(route, 'methods') else 'N/A'} {route.path}")
