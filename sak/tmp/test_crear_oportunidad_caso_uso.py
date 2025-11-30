"""
Caso de Uso Completo: Crear Oportunidad desde Mensaje

Este script prueba el flujo completo de creación de oportunidad desde un mensaje CRM:
1. Crea un mensaje de prueba
2. Crea una oportunidad desde ese mensaje
3. Verifica las asociaciones
4. Muestra los datos para verificar en las pantallas
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def print_section(title):
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80 + "\n")

def print_json(data, title=""):
    if title:
        print(f"\n--- {title} ---")
    print(json.dumps(data, indent=2, ensure_ascii=False))

# ============================================================================
# PASO 1: Obtener datos necesarios
# ============================================================================

print_section("PASO 1: Obtener Catálogos y Usuario")

# Obtener tipos de operación
print("Obteniendo tipos de operación...")
response = requests.get(f"{BASE_URL}/crm/catalogos/tipos-operacion")
tipos_operacion = response.json()
print(f"✓ Tipos de operación disponibles: {len(tipos_operacion)}")
for tipo in tipos_operacion:
    print(f"  - ID: {tipo['id']}, Nombre: {tipo['nombre']}, Código: {tipo['codigo']}")

tipo_venta = next((t for t in tipos_operacion if t['codigo'] == 'venta'), tipos_operacion[0] if tipos_operacion else None)
if tipo_venta:
    print(f"\n✓ Tipo 'Venta' encontrado: ID={tipo_venta['id']}")

# Obtener usuarios (responsables)
print("\nObteniendo usuarios...")
response = requests.get(f"{BASE_URL}/users?filter=%7B%7D&range=%5B0%2C10%5D&sort=%5B%22id%22%2C%22ASC%22%5D")
usuarios = response.json()
print(f"✓ Usuarios disponibles: {len(usuarios)}")
if usuarios:
    usuario_test = usuarios[0]
    print(f"  - Usuario de prueba: ID={usuario_test['id']}, Nombre={usuario_test.get('nombre', 'N/A')}")

# Obtener emprendimientos
print("\nObteniendo emprendimientos...")
response = requests.get(f"{BASE_URL}/emprendimientos?filter=%7B%7D&range=%5B0%2C10%5D&sort=%5B%22id%22%2C%22ASC%22%5D")
emprendimientos = response.json()
print(f"✓ Emprendimientos disponibles: {len(emprendimientos)}")
if emprendimientos:
    emprendimiento_test = emprendimientos[0]
    print(f"  - Emprendimiento de prueba: ID={emprendimiento_test['id']}, Nombre={emprendimiento_test.get('nombre', 'N/A')}")

# ============================================================================
# PASO 2: Crear mensaje de prueba
# ============================================================================

print_section("PASO 2: Crear Mensaje de Prueba")

mensaje_payload = {
    "canal": "whatsapp",
    "estado": "recibido",
    "contenido": "Hola, estoy interesado en comprar un departamento de 2 dormitorios en zona norte. Mi presupuesto es de USD 150,000. ¿Tienen disponibilidad?",
    "contacto_alias": "+549111234567",
    "origen_externo_id": "whatsapp_msg_" + datetime.now().strftime("%Y%m%d_%H%M%S"),
    "responsable_id": usuario_test['id'] if usuarios else 1,
}

print("Creando mensaje...")
print_json(mensaje_payload, "Payload del mensaje")

response = requests.post(f"{BASE_URL}/crm/mensajes", json=mensaje_payload)
if response.status_code in [200, 201]:
    mensaje_creado = response.json()
    print(f"\n✓ Mensaje creado exitosamente")
    print(f"  - ID: {mensaje_creado['id']}")
    print(f"  - Canal: {mensaje_creado['canal']}")
    print(f"  - Estado: {mensaje_creado['estado']}")
    print(f"  - Contenido: {mensaje_creado['contenido'][:80]}...")
else:
    print(f"✗ Error al crear mensaje: {response.status_code}")
    print(response.text)
    exit(1)

mensaje_id = mensaje_creado['id']

# ============================================================================
# PASO 3: Crear oportunidad desde el mensaje
# ============================================================================

print_section("PASO 3: Crear Oportunidad desde Mensaje")

oportunidad_payload = {
    "contacto_nombre": "Juan Pérez",
    "contacto_referencia": "+549111234567",
    "tipo_operacion_id": tipo_venta['id'] if tipo_venta else 2,
    "emprendimiento_id": emprendimiento_test['id'] if emprendimientos else None,
    "responsable_id": usuario_test['id'] if usuarios else 1,
    "nombre_oportunidad": "Compra departamento 2 dormitorios - Zona Norte",
    "descripcion": "Cliente interesado en departamento de 2 dormitorios en zona norte. Presupuesto USD 150,000. Requiere financiación."
}

print("Creando oportunidad desde mensaje...")
print_json(oportunidad_payload, "Payload de la oportunidad")

response = requests.post(
    f"{BASE_URL}/crm/mensajes/{mensaje_id}/crear-oportunidad",
    json=oportunidad_payload
)

if response.status_code in [200, 201]:
    mensaje_actualizado = response.json()
    print(f"\n✓ Oportunidad creada exitosamente")
    print(f"  - Mensaje ID: {mensaje_actualizado['id']}")
    print(f"  - Contacto ID: {mensaje_actualizado.get('contacto_id', 'N/A')}")
    print(f"  - Oportunidad ID: {mensaje_actualizado.get('oportunidad_id', 'N/A')}")
else:
    print(f"✗ Error al crear oportunidad: {response.status_code}")
    print(response.text)
    exit(1)

contacto_id = mensaje_actualizado.get('contacto_id')
oportunidad_id = mensaje_actualizado.get('oportunidad_id')

# ============================================================================
# PASO 4: Verificar contacto creado
# ============================================================================

print_section("PASO 4: Verificar Contacto Creado")

if contacto_id:
    response = requests.get(f"{BASE_URL}/crm/contactos/{contacto_id}")
    if response.status_code == 200:
        contacto = response.json()
        print("✓ Contacto creado:")
        print(f"  - ID: {contacto['id']}")
        print(f"  - Nombre: {contacto.get('nombre_completo', 'N/A')}")
        print(f"  - Email: {contacto.get('email', 'N/A')}")
        print(f"  - Teléfonos: {contacto.get('telefonos', [])}")
        print(f"  - Responsable ID: {contacto.get('responsable_id', 'N/A')}")
else:
    print("✗ No se creó contacto")

# ============================================================================
# PASO 5: Verificar oportunidad creada
# ============================================================================

print_section("PASO 5: Verificar Oportunidad Creada")

if oportunidad_id:
    response = requests.get(f"{BASE_URL}/crm/oportunidades/{oportunidad_id}")
    if response.status_code == 200:
        oportunidad = response.json()
        print("✓ Oportunidad creada:")
        print(f"  - ID: {oportunidad['id']}")
        print(f"  - Descripción Estado: {oportunidad.get('descripcion_estado', 'N/A')}")
        print(f"  - Descripción: {oportunidad.get('descripcion', 'N/A')[:80]}...")
        print(f"  - Contacto ID: {oportunidad.get('contacto_id', 'N/A')}")
        print(f"  - Tipo Operación ID: {oportunidad.get('tipo_operacion_id', 'N/A')}")
        print(f"  - Emprendimiento ID: {oportunidad.get('emprendimiento_id', 'N/A')}")
        print(f"  - Responsable ID: {oportunidad.get('responsable_id', 'N/A')}")
        print(f"  - Estado: {oportunidad.get('estado', 'N/A')}")
else:
    print("✗ No se creó oportunidad")

# ============================================================================
# PASO 6: Verificar eventos asociados
# ============================================================================

print_section("PASO 6: Verificar Eventos Asociados a la Oportunidad")

if oportunidad_id:
    # Buscar eventos de esta oportunidad
    response = requests.get(
        f"{BASE_URL}/crm/eventos?filter=%7B%22oportunidad_id%22%3A{oportunidad_id}%7D&range=%5B0%2C10%5D&sort=%5B%22id%22%2C%22DESC%22%5D"
    )
    if response.status_code == 200:
        eventos = response.json()
        print(f"✓ Eventos encontrados: {len(eventos)}")
        for evento in eventos:
            print(f"\n  Evento ID: {evento['id']}")
            print(f"  - Descripción: {evento.get('descripcion', 'N/A')}")
            print(f"  - Tipo: {evento.get('tipo_id', 'N/A')}")
            print(f"  - Motivo: {evento.get('motivo_id', 'N/A')}")
            print(f"  - Oportunidad ID: {evento.get('oportunidad_id', 'N/A')}")
            print(f"  - Contacto ID: {evento.get('contacto_id', 'N/A')}")
    else:
        print("ℹ No se encontraron eventos (posiblemente no hay catálogos configurados)")

# ============================================================================
# PASO 7: Resumen para verificación en pantallas
# ============================================================================

print_section("PASO 7: Resumen - URLs para Verificar en Pantallas")

print("📋 URLs para verificar en el frontend:\n")

print(f"1. Ver MENSAJE creado:")
print(f"   http://localhost:3000/admin/crm-mensajes/{mensaje_id}/show")
print(f"   - Debe mostrar el mensaje con el contenido del cliente")
print(f"   - Debe mostrar la asociación con el contacto")
print(f"   - Debe mostrar la asociación con la oportunidad")

if contacto_id:
    print(f"\n2. Ver CONTACTO creado:")
    print(f"   http://localhost:3000/admin/crm-contactos/{contacto_id}/show")
    print(f"   - Nombre: Juan Pérez")
    print(f"   - Teléfono: +549111234567")
    print(f"   - Debe tener la oportunidad asociada")

if oportunidad_id:
    print(f"\n3. Ver OPORTUNIDAD creada:")
    print(f"   http://localhost:3000/admin/crm-oportunidades/{oportunidad_id}/show")
    print(f"   - Nombre: Compra departamento 2 dormitorios - Zona Norte")
    print(f"   - Tipo: Venta")
    print(f"   - Debe mostrar el contacto asociado")
    print(f"   - Debe mostrar eventos de seguimiento")

print(f"\n4. Ver lista de MENSAJES:")
print(f"   http://localhost:3000/admin/crm-mensajes")
print(f"   - Buscar el mensaje ID {mensaje_id}")
print(f"   - Debe mostrar estado 'recibido'")
print(f"   - Debe tener la opción de 'Crear oportunidad' deshabilitada")

print(f"\n5. Ver lista de OPORTUNIDADES:")
print(f"   http://localhost:3000/admin/crm-oportunidades")
print(f"   - Buscar oportunidad ID {oportunidad_id}")
print(f"   - Debe aparecer con el nombre asignado")

# ============================================================================
# Datos para pruebas manuales
# ============================================================================

print_section("DATOS PARA PRUEBAS MANUALES")

print("📝 IDs generados en este test:")
print(f"  - Mensaje ID: {mensaje_id}")
print(f"  - Contacto ID: {contacto_id}")
print(f"  - Oportunidad ID: {oportunidad_id}")

print("\n✅ Caso de uso completado exitosamente!")
print("\n💡 Próximos pasos:")
print("   1. Verificar las URLs del frontend")
print("   2. Comprobar que todos los datos se muestran correctamente")
print("   3. Verificar las relaciones entre entidades")
print("   4. Probar crear otra oportunidad desde un mensaje diferente")
