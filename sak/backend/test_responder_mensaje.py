"""
Script de prueba para el endpoint POST /crm/mensajes/{mensaje_id}/responder

Casos de prueba:
1. Responder mensaje SIN contacto asociado (debe crear contacto + oportunidad)
2. Responder mensaje CON contacto pero SIN oportunidad (debe crear solo oportunidad)
3. Responder mensaje CON contacto Y oportunidad (no crea nada, solo mensaje salida)
4. Validación: intentar responder sin nombre de contacto cuando no existe
5. Validación: intentar responder sin contenido
"""

import requests
import json
from datetime import datetime

# Configuración
BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/crm/mensajes"

# Colores para output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

def print_section(title):
    print(f"\n{Colors.BLUE}{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}{Colors.END}\n")


def crear_mensaje_prueba(tipo="entrada", estado="nuevo", contacto_id=None, oportunidad_id=None):
    """Crea un mensaje de prueba para testear"""
    payload = {
        "tipo": tipo,
        "estado": estado,
        "canal": "whatsapp",
        "asunto": "Consulta sobre propiedad",
        "contenido": "Hola, estoy interesado en ver la propiedad del barrio Centro.",
        "contacto_referencia": "+5491123456789",
        "fecha_mensaje": datetime.now().isoformat(),
        "responsable_id": 1,  # Asumiendo que existe user id=1
    }
    
    if contacto_id:
        payload["contacto_id"] = contacto_id
    
    if oportunidad_id:
        payload["oportunidad_id"] = oportunidad_id
    
    response = requests.post(f"{BASE_URL}/crm/mensajes", json=payload)
    
    if response.status_code == 201:
        return response.json()
    else:
        print_error(f"Error al crear mensaje: {response.status_code}")
        print(response.text)
        return None


def obtener_mensaje(mensaje_id):
    """Obtiene un mensaje por ID"""
    response = requests.get(f"{API_URL}/{mensaje_id}")
    if response.status_code == 200:
        return response.json()
    return None


def responder_mensaje(mensaje_id, asunto, contenido, contacto_nombre=None):
    """Llama al endpoint /responder"""
    payload = {
        "asunto": asunto,
        "contenido": contenido,
    }
    
    if contacto_nombre:
        payload["contacto_nombre"] = contacto_nombre
    
    response = requests.post(f"{API_URL}/{mensaje_id}/responder", json=payload)
    return response


# ============================================================================
# CASOS DE PRUEBA
# ============================================================================

def test_caso_1_sin_contacto_ni_oportunidad():
    """
    CASO 1: Mensaje SIN contacto ni oportunidad
    Debe crear ambos automáticamente
    """
    print_section("CASO 1: Responder mensaje SIN contacto ni oportunidad")
    
    # Crear mensaje de prueba sin contacto
    mensaje = crear_mensaje_prueba(contacto_id=None, oportunidad_id=None)
    if not mensaje:
        print_error("No se pudo crear mensaje de prueba")
        return False
    
    mensaje_id = mensaje.get("id")
    print_info(f"Mensaje de prueba creado: ID={mensaje_id}")
    print_info(f"  - contacto_id: {mensaje.get('contacto_id')}")
    print_info(f"  - oportunidad_id: {mensaje.get('oportunidad_id')}")
    
    # Responder el mensaje
    print_info("\nEnviando respuesta con nombre de contacto...")
    response = responder_mensaje(
        mensaje_id=mensaje_id,
        asunto="RE: Consulta sobre propiedad",
        contenido="Hola Juan, con gusto te mostramos la propiedad. ¿Cuándo tenés disponibilidad?",
        contacto_nombre="Juan Pérez"
    )
    
    if response.status_code == 200:
        resultado = response.json()
        print_success("Respuesta enviada exitosamente!")
        print_info(f"  - contacto_creado: {resultado.get('contacto_creado')}")
        print_info(f"  - contacto_id: {resultado.get('contacto_id')}")
        print_info(f"  - oportunidad_creada: {resultado.get('oportunidad_creada')}")
        print_info(f"  - oportunidad_id: {resultado.get('oportunidad_id')}")
        print_info(f"  - mensaje_salida_id: {resultado.get('mensaje_salida', {}).get('id')}")
        
        # Validar que se crearon contacto y oportunidad
        if resultado.get('contacto_creado') and resultado.get('oportunidad_creada'):
            print_success("✓ Se creó contacto y oportunidad automáticamente")
            
            # Verificar que el mensaje original se actualizó
            mensaje_actualizado = obtener_mensaje(mensaje_id)
            if mensaje_actualizado:
                if mensaje_actualizado.get('estado') == 'recibido':
                    print_success("✓ Mensaje original actualizado a 'recibido'")
                else:
                    print_warning(f"Estado del mensaje: {mensaje_actualizado.get('estado')}")
                
                if mensaje_actualizado.get('contacto_id') == resultado.get('contacto_id'):
                    print_success("✓ Mensaje original vinculado al contacto creado")
                
                if mensaje_actualizado.get('oportunidad_id') == resultado.get('oportunidad_id'):
                    print_success("✓ Mensaje original vinculado a la oportunidad creada")
            
            return True
        else:
            print_error("No se crearon contacto y/o oportunidad como se esperaba")
            return False
    else:
        print_error(f"Error al responder: {response.status_code}")
        print(response.text)
        return False


def test_caso_2_con_contacto_sin_oportunidad():
    """
    CASO 2: Mensaje CON contacto pero SIN oportunidad
    Solo debe crear la oportunidad
    """
    print_section("CASO 2: Responder mensaje CON contacto pero SIN oportunidad")
    
    # Primero crear un contacto
    contacto_payload = {
        "nombre_completo": "María González",
        "telefonos": ["+5491198765432"],
        "email": "maria@example.com",
        "responsable_id": 1
    }
    
    print_info("Creando contacto de prueba...")
    response_contacto = requests.post(f"{BASE_URL}/crm/contactos", json=contacto_payload)
    
    if response_contacto.status_code != 201:
        print_error("No se pudo crear el contacto de prueba")
        return False
    
    contacto = response_contacto.json()
    contacto_id = contacto.get("id")
    print_success(f"Contacto creado: ID={contacto_id}")
    
    # Crear mensaje con contacto pero sin oportunidad
    mensaje = crear_mensaje_prueba(contacto_id=contacto_id, oportunidad_id=None)
    if not mensaje:
        print_error("No se pudo crear mensaje de prueba")
        return False
    
    mensaje_id = mensaje.get("id")
    print_info(f"Mensaje de prueba creado: ID={mensaje_id}")
    print_info(f"  - contacto_id: {mensaje.get('contacto_id')}")
    print_info(f"  - oportunidad_id: {mensaje.get('oportunidad_id')}")
    
    # Responder el mensaje (no es necesario enviar contacto_nombre)
    print_info("\nEnviando respuesta...")
    response = responder_mensaje(
        mensaje_id=mensaje_id,
        asunto="RE: Consulta",
        contenido="Hola María, gracias por tu consulta. Te contactamos pronto."
    )
    
    if response.status_code == 200:
        resultado = response.json()
        print_success("Respuesta enviada exitosamente!")
        print_info(f"  - contacto_creado: {resultado.get('contacto_creado')}")
        print_info(f"  - oportunidad_creada: {resultado.get('oportunidad_creada')}")
        
        if not resultado.get('contacto_creado') and resultado.get('oportunidad_creada'):
            print_success("✓ NO se creó contacto (ya existía)")
            print_success("✓ Se creó oportunidad automáticamente")
            return True
        else:
            print_error("Resultado inesperado")
            return False
    else:
        print_error(f"Error al responder: {response.status_code}")
        print(response.text)
        return False


def test_caso_3_validacion_sin_nombre():
    """
    CASO 3: Validación - intentar responder sin nombre cuando no hay contacto
    Debe fallar con error 400
    """
    print_section("CASO 3: Validación - responder SIN nombre de contacto (debe fallar)")
    
    # Crear mensaje sin contacto
    mensaje = crear_mensaje_prueba(contacto_id=None, oportunidad_id=None)
    if not mensaje:
        print_error("No se pudo crear mensaje de prueba")
        return False
    
    mensaje_id = mensaje.get("id")
    print_info(f"Mensaje de prueba creado: ID={mensaje_id} (sin contacto)")
    
    # Intentar responder SIN enviar contacto_nombre
    print_info("Intentando responder sin nombre de contacto...")
    response = responder_mensaje(
        mensaje_id=mensaje_id,
        asunto="RE: Test",
        contenido="Contenido de prueba"
        # NO se envía contacto_nombre
    )
    
    if response.status_code == 400:
        error = response.json()
        print_success("✓ Validación correcta: error 400")
        print_info(f"  Mensaje de error: {error.get('detail')}")
        return True
    else:
        print_error(f"Se esperaba error 400, pero se obtuvo: {response.status_code}")
        return False


def test_caso_4_validacion_sin_contenido():
    """
    CASO 4: Validación - intentar responder sin contenido
    Debe fallar con error 400
    """
    print_section("CASO 4: Validación - responder SIN contenido (debe fallar)")
    
    # Crear mensaje sin contacto
    mensaje = crear_mensaje_prueba(contacto_id=None, oportunidad_id=None)
    if not mensaje:
        print_error("No se pudo crear mensaje de prueba")
        return False
    
    mensaje_id = mensaje.get("id")
    print_info(f"Mensaje de prueba creado: ID={mensaje_id}")
    
    # Intentar responder SIN contenido
    print_info("Intentando responder sin contenido...")
    response = responder_mensaje(
        mensaje_id=mensaje_id,
        asunto="RE: Test",
        contenido="",  # Vacío
        contacto_nombre="Test User"
    )
    
    if response.status_code == 400:
        error = response.json()
        print_success("✓ Validación correcta: error 400")
        print_info(f"  Mensaje de error: {error.get('detail')}")
        return True
    else:
        print_error(f"Se esperaba error 400, pero se obtuvo: {response.status_code}")
        return False


# ============================================================================
# EJECUTAR TODAS LAS PRUEBAS
# ============================================================================

def ejecutar_todas_las_pruebas():
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  TEST ENDPOINT: POST /crm/mensajes/{id}/responder")
    print(f"{'='*60}{Colors.END}")
    print_info(f"Base URL: {BASE_URL}")
    print_info(f"Fecha/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    resultados = []
    
    # Ejecutar casos de prueba
    resultados.append(("Caso 1: Sin contacto ni oportunidad", test_caso_1_sin_contacto_ni_oportunidad()))
    resultados.append(("Caso 2: Con contacto sin oportunidad", test_caso_2_con_contacto_sin_oportunidad()))
    resultados.append(("Caso 3: Validación sin nombre", test_caso_3_validacion_sin_nombre()))
    resultados.append(("Caso 4: Validación sin contenido", test_caso_4_validacion_sin_contenido()))
    
    # Resumen
    print_section("RESUMEN DE PRUEBAS")
    exitosos = sum(1 for _, resultado in resultados if resultado)
    total = len(resultados)
    
    for nombre, resultado in resultados:
        if resultado:
            print_success(f"{nombre}")
        else:
            print_error(f"{nombre}")
    
    print(f"\n{Colors.BLUE}{'='*60}")
    if exitosos == total:
        print_success(f"  TODOS LOS TESTS PASARON: {exitosos}/{total}")
    else:
        print_warning(f"  TESTS EXITOSOS: {exitosos}/{total}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")
    
    return exitosos == total


if __name__ == "__main__":
    try:
        exito = ejecutar_todas_las_pruebas()
        exit(0 if exito else 1)
    except Exception as e:
        print_error(f"Error durante la ejecución de pruebas: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)
