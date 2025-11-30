import requests
from datetime import datetime
import random

BASE_URL = "http://localhost:8000"

print("=" * 70)
print("TEST: Cambio de estado al crear oportunidad")
print("=" * 70)
print()

# Crear dos mensajes: uno con estado "nuevo" y otro con estado "recibido"
mensajes_test = []

for i, estado_inicial in enumerate(["nuevo", "recibido"], 1):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = random.randint(1000, 9999)
    referencia = f"+549{random.randint(11, 99)}{random.randint(100000, 999999)}"
    
    mensaje_payload = {
        "canal": "email",
        "estado": estado_inicial,
        "contenido": f"Mensaje de prueba #{i} con estado inicial: {estado_inicial}",
        "contacto_alias": referencia,
        "origen_externo_id": f"test_estado_{timestamp}_{random_suffix}_{i}",
        "responsable_id": 1
    }
    
    print(f"Test {i}: Creando mensaje con estado '{estado_inicial}'...")
    response = requests.post(f"{BASE_URL}/crm/mensajes", json=mensaje_payload)
    
    if response.status_code in [200, 201]:
        mensaje = response.json()
        print(f"  ✓ Mensaje creado - ID: {mensaje['id']}, Estado: {mensaje['estado']}")
        mensajes_test.append({
            "id": mensaje["id"],
            "estado_inicial": estado_inicial,
            "estado_antes": mensaje["estado"]
        })
    else:
        print(f"  ✗ Error: {response.status_code}")
        continue

print()
print("=" * 70)
print("Creando oportunidades desde los mensajes...")
print("=" * 70)
print()

for i, test_msg in enumerate(mensajes_test, 1):
    print(f"Test {i}: Mensaje ID {test_msg['id']} (estado inicial: '{test_msg['estado_inicial']}')")
    
    oportunidad_payload = {
        "contacto_nombre": f"Cliente Test {i}",
        "contacto_referencia": f"+549111111{i:03d}",
        "tipo_operacion_id": 2,  # Venta
        "emprendimiento_id": 1,
        "responsable_id": 1,
        "nombre_oportunidad": f"Oportunidad Test {i}",
        "descripcion": f"Oportunidad de prueba para mensaje con estado '{test_msg['estado_inicial']}'"
    }
    
    response = requests.post(
        f"{BASE_URL}/crm/mensajes/{test_msg['id']}/crear-oportunidad",
        json=oportunidad_payload
    )
    
    if response.status_code in [200, 201]:
        mensaje_actualizado = response.json()
        estado_despues = mensaje_actualizado['estado']
        oportunidad_id = mensaje_actualizado.get('oportunidad_id')
        
        print(f"  ✓ Oportunidad creada - ID: {oportunidad_id}")
        print(f"  📌 Estado ANTES: '{test_msg['estado_antes']}'")
        print(f"  📌 Estado DESPUÉS: '{estado_despues}'")
        
        # Verificar comportamiento esperado
        if test_msg['estado_inicial'] == 'nuevo':
            if estado_despues == 'recibido':
                print(f"  ✅ CORRECTO: Estado cambió de 'nuevo' a 'recibido'")
            else:
                print(f"  ❌ ERROR: Estado debería ser 'recibido' pero es '{estado_despues}'")
        else:
            if estado_despues == test_msg['estado_antes']:
                print(f"  ✅ CORRECTO: Estado se mantuvo en '{estado_despues}' (no era 'nuevo')")
            else:
                print(f"  ❌ ERROR: Estado cambió de '{test_msg['estado_antes']}' a '{estado_despues}' (no debería cambiar)")
    else:
        print(f"  ✗ Error al crear oportunidad: {response.status_code}")
        print(f"  {response.text}")
    
    print()

print("=" * 70)
print("RESUMEN DEL TEST")
print("=" * 70)
print()
print("Regla implementada:")
print("  • Si mensaje.estado == 'nuevo' → cambiar a 'recibido'")
print("  • Si mensaje.estado != 'nuevo' → mantener estado actual")
print()
