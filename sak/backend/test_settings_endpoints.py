import requests
import json

BASE_URL = "http://localhost:8000/settings"

print("=== Probando endpoints de Settings ===\n")

# 1. GET - Listar todos los settings (debería estar vacío)
print("1. GET /settings - Listar todos")
response = requests.get(BASE_URL, params={"_start": 0, "_end": 10})
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}\n")

# 2. POST - Crear settings
print("2. POST /settings - Crear nuevos settings")
settings_to_create = [
    {
        "clave": "sistema_nombre",
        "valor": "Sistema de Gestión SAK",
        "descripcion": "Nombre del sistema"
    },
    {
        "clave": "email_soporte",
        "valor": "soporte@sistemika.com",
        "descripcion": "Email de soporte técnico"
    },
    {
        "clave": "timezone",
        "valor": "America/Asuncion",
        "descripcion": "Zona horaria del sistema"
    },
    {
        "clave": "max_upload_size",
        "valor": "10485760",
        "descripcion": "Tamaño máximo de archivo en bytes (10MB)"
    }
]

created_ids = []
for setting in settings_to_create:
    response = requests.post(BASE_URL, json=setting)
    print(f"  Crear '{setting['clave']}' - Status: {response.status_code}")
    if response.status_code == 200:
        created = response.json()
        created_ids.append(created['id'])
        print(f"    ID: {created['id']}, Clave: {created['clave']}")
print()

# 3. GET - Listar todos los settings nuevamente
print("3. GET /settings - Listar todos (después de crear)")
response = requests.get(BASE_URL, params={"_start": 0, "_end": 10})
print(f"Status: {response.status_code}")
settings_list = response.json()
print(f"Total settings: {len(settings_list)}")
for s in settings_list:
    print(f"  - {s['clave']}: {s['valor']}")
print()

# 4. GET - Obtener un setting por ID
if created_ids:
    setting_id = created_ids[0]
    print(f"4. GET /settings/{setting_id} - Obtener setting por ID")
    response = requests.get(f"{BASE_URL}/{setting_id}")
    print(f"Status: {response.status_code}")
    setting = response.json()
    print(f"Setting: {setting['clave']} = {setting['valor']}\n")

# 5. PUT - Actualizar un setting
if created_ids:
    setting_id = created_ids[1]
    print(f"5. PUT /settings/{setting_id} - Actualizar setting")
    update_data = {
        "clave": "email_soporte",
        "valor": "soporte@sistemika.com.py",
        "descripcion": "Email de soporte técnico actualizado"
    }
    response = requests.put(f"{BASE_URL}/{setting_id}", json=update_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        updated = response.json()
        print(f"Actualizado: {updated['clave']} = {updated['valor']}\n")

# 6. GET - Buscar settings (usando el campo de búsqueda)
print("6. GET /settings?q=email - Buscar settings")
response = requests.get(BASE_URL, params={"q": "email", "_start": 0, "_end": 10})
print(f"Status: {response.status_code}")
search_results = response.json()
print(f"Resultados encontrados: {len(search_results)}")
for s in search_results:
    print(f"  - {s['clave']}: {s['valor']}")
print()

# 7. GET - Filtrar por clave específica
print("7. GET /settings?filter={\"clave\":\"timezone\"} - Filtrar por clave")
filter_data = json.dumps({"clave": "timezone"})
response = requests.get(BASE_URL, params={"filter": filter_data, "_start": 0, "_end": 10})
print(f"Status: {response.status_code}")
filtered_results = response.json()
print(f"Resultados: {len(filtered_results)}")
for s in filtered_results:
    print(f"  - {s['clave']}: {s['valor']}")
print()

# 8. DELETE - Eliminar un setting (soft delete)
if created_ids and len(created_ids) > 2:
    setting_id = created_ids[2]
    print(f"8. DELETE /settings/{setting_id} - Eliminar setting")
    response = requests.delete(f"{BASE_URL}/{setting_id}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Setting eliminado (soft delete)\n")

# 9. GET - Verificar que el setting eliminado no aparece
print("9. GET /settings - Verificar settings después de eliminar")
response = requests.get(BASE_URL, params={"_start": 0, "_end": 10})
print(f"Status: {response.status_code}")
final_list = response.json()
print(f"Total settings activos: {len(final_list)}")
for s in final_list:
    print(f"  - {s['clave']}: {s['valor']}")
print()

print("=== Pruebas completadas ===")
