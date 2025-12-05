import requests

BASE_URL = 'http://localhost:8000'

# Configuraciones iniciales del sistema
configuraciones = [
    {
        "clave": "crm.kanban_limit",
        "valor": "500",
        "descripcion": "Límite de registros a cargar en el panel Kanban de CRM"
    },
]

print("=== Poblando tabla Settings con configuraciones iniciales ===\n")

for config in configuraciones:
    try:
        response = requests.post(f'{BASE_URL}/settings', json=config)
        if response.status_code == 201:
            print(f"✓ Creado: {config['clave']} = {config['valor']}")
        else:
            print(f"✗ Error al crear {config['clave']}: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"✗ Excepción al crear {config['clave']}: {str(e)}")

print(f"\n=== Verificando settings creados ===\n")
response = requests.get(f'{BASE_URL}/settings')
if response.status_code == 200:
    settings = response.json()
    print(f"Total settings en la base de datos: {len(settings)}\n")
    for setting in settings:
        print(f"  {setting['clave']}: {setting['valor']}")
        if setting.get('descripcion'):
            print(f"    → {setting['descripcion']}")
else:
    print(f"Error al verificar: {response.status_code}")
