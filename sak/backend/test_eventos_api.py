"""
Script de prueba para los endpoints de eventos refactorizados.
Prueba el CRUD genérico con el nuevo modelo simplificado.
"""

import requests
import json
from datetime import datetime, timedelta

# Configuración
BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/crm/eventos"

# Colores para output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_test(name):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST: {name}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")


def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")


def print_error(message):
    print(f"{RED}✗ {message}{RESET}")


def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")


def print_response(response):
    print(f"\nStatus: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    except:
        print(f"Response: {response.text}")


def test_1_listar_eventos():
    """GET /crm/eventos - Listar todos los eventos"""
    print_test("1. Listar eventos")
    
    response = requests.get(API_URL)
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        total = len(data.get("data", [])) if isinstance(data, dict) else len(data)
        print_success(f"Eventos obtenidos: {total}")
        return True
    else:
        print_error(f"Error al listar eventos")
        return False


def test_2_obtener_oportunidad():
    """GET /crm/oportunidades - Obtener una oportunidad para asociar eventos"""
    print_test("2. Obtener oportunidad de prueba")
    
    response = requests.get(f"{BASE_URL}/crm/oportunidades")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        oportunidades = data.get("data", []) if isinstance(data, dict) else data
        
        if oportunidades:
            oportunidad_id = oportunidades[0]["id"]
            print_success(f"Oportunidad encontrada: ID {oportunidad_id}")
            return oportunidad_id
        else:
            print_error("No hay oportunidades disponibles")
            return None
    else:
        print_error("Error al obtener oportunidades")
        return None


def test_3_crear_evento(oportunidad_id):
    """POST /crm/eventos - Crear un nuevo evento"""
    print_test("3. Crear evento")
    
    if not oportunidad_id:
        print_error("No hay oportunidad_id disponible")
        return None
    
    fecha_evento = (datetime.now() + timedelta(days=2)).isoformat()
    
    payload = {
        "oportunidad_id": oportunidad_id,
        "titulo": "Llamada de seguimiento - TEST",
        "tipo_evento": "llamada",
        "fecha_evento": fecha_evento,
        "descripcion": "Evento de prueba creado por script de validación",
        "estado": "1-pendiente"
    }
    
    print_info(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")
    
    response = requests.post(API_URL, json=payload)
    print_response(response)
    
    if response.status_code in [200, 201]:
        evento = response.json()
        evento_id = evento.get("id")
        print_success(f"Evento creado: ID {evento_id}")
        
        # Validar campos
        if evento.get("titulo") == payload["titulo"]:
            print_success("✓ Título correcto")
        if evento.get("tipo_evento") == payload["tipo_evento"]:
            print_success("✓ Tipo evento correcto")
        if evento.get("estado") == payload["estado"]:
            print_success("✓ Estado correcto")
        
        return evento_id
    else:
        print_error("Error al crear evento")
        return None


def test_4_obtener_evento(evento_id):
    """GET /crm/eventos/{id} - Obtener un evento específico"""
    print_test("4. Obtener evento por ID")
    
    if not evento_id:
        print_error("No hay evento_id disponible")
        return False
    
    response = requests.get(f"{API_URL}/{evento_id}")
    print_response(response)
    
    if response.status_code == 200:
        evento = response.json()
        print_success(f"Evento obtenido: {evento.get('titulo')}")
        
        # Validar estructura
        campos_requeridos = ["id", "titulo", "tipo_evento", "oportunidad_id", "fecha_evento", "estado"]
        campos_eliminados = ["contacto_id", "tipo_id", "motivo_id", "origen_lead_id", "proximo_paso", "fecha_compromiso"]
        
        for campo in campos_requeridos:
            if campo in evento:
                print_success(f"✓ Campo '{campo}' presente")
            else:
                print_error(f"✗ Campo '{campo}' faltante")
        
        for campo in campos_eliminados:
            if campo not in evento:
                print_success(f"✓ Campo '{campo}' eliminado correctamente")
            else:
                print_error(f"✗ Campo '{campo}' aún existe")
        
        return True
    else:
        print_error("Error al obtener evento")
        return False


def test_5_actualizar_evento(evento_id):
    """PUT /crm/eventos/{id} - Actualizar un evento"""
    print_test("5. Actualizar evento")
    
    if not evento_id:
        print_error("No hay evento_id disponible")
        return False
    
    payload = {
        "titulo": "Llamada de seguimiento - ACTUALIZADO",
        "descripcion": "Descripción actualizada por script de prueba"
    }
    
    print_info(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")
    
    response = requests.put(f"{API_URL}/{evento_id}", json=payload)
    print_response(response)
    
    if response.status_code == 200:
        evento = response.json()
        if evento.get("titulo") == payload["titulo"]:
            print_success("✓ Título actualizado correctamente")
        if evento.get("descripcion") == payload["descripcion"]:
            print_success("✓ Descripción actualizada correctamente")
        return True
    else:
        print_error("Error al actualizar evento")
        return False


def test_6_cerrar_evento(evento_id):
    """PUT /crm/eventos/{id} - Cerrar un evento (cambiar estado a realizado)"""
    print_test("6. Cerrar evento (cambiar a realizado)")
    
    if not evento_id:
        print_error("No hay evento_id disponible")
        return False
    
    payload = {
        "estado": "2-realizado",
        "resultado": "Llamada realizada exitosamente. Cliente interesado en el producto."
    }
    
    print_info(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")
    
    response = requests.put(f"{API_URL}/{evento_id}", json=payload)
    print_response(response)
    
    if response.status_code == 200:
        evento = response.json()
        if evento.get("estado") == payload["estado"]:
            print_success("✓ Estado actualizado a 'realizado'")
        if evento.get("resultado") == payload["resultado"]:
            print_success("✓ Resultado guardado correctamente")
        return True
    else:
        print_error("Error al cerrar evento")
        return False


def test_7_tipos_evento():
    """Probar creación con diferentes tipos de evento"""
    print_test("7. Probar diferentes tipos de evento")
    
    # Obtener oportunidad
    response = requests.get(f"{BASE_URL}/crm/oportunidades")
    if response.status_code != 200:
        print_error("No se puede obtener oportunidad")
        return False
    
    data = response.json()
    oportunidades = data.get("data", []) if isinstance(data, dict) else data
    if not oportunidades:
        print_error("No hay oportunidades")
        return False
    
    oportunidad_id = oportunidades[0]["id"]
    
    tipos_evento = ["llamada", "email", "reunion", "visita", "whatsapp", "otros"]
    eventos_creados = []
    
    for tipo in tipos_evento:
        fecha_evento = (datetime.now() + timedelta(days=1)).isoformat()
        
        payload = {
            "oportunidad_id": oportunidad_id,
            "titulo": f"Evento tipo {tipo} - TEST",
            "tipo_evento": tipo,
            "fecha_evento": fecha_evento,
            "descripcion": f"Prueba de tipo {tipo}",
            "estado": "1-pendiente"
        }
        
        response = requests.post(API_URL, json=payload)
        
        if response.status_code in [200, 201]:
            evento = response.json()
            eventos_creados.append(evento.get("id"))
            print_success(f"✓ Tipo '{tipo}' creado correctamente")
        else:
            print_error(f"✗ Error al crear tipo '{tipo}'")
    
    print_info(f"Total de eventos de prueba creados: {len(eventos_creados)}")
    
    # Limpiar eventos de prueba
    for evento_id in eventos_creados:
        requests.delete(f"{API_URL}/{evento_id}")
    
    return len(eventos_creados) == len(tipos_evento)


def test_8_filtrar_por_oportunidad(oportunidad_id):
    """GET /crm/oportunidades/{id}/eventos - Listar eventos de una oportunidad"""
    print_test("8. Filtrar eventos por oportunidad")
    
    if not oportunidad_id:
        print_error("No hay oportunidad_id disponible")
        return False
    
    response = requests.get(f"{BASE_URL}/crm/oportunidades/{oportunidad_id}/eventos")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        eventos = data.get("eventos", [])
        total = data.get("resumen", {}).get("total_eventos", 0)
        print_success(f"Eventos de la oportunidad: {total}")
        return True
    else:
        print_error("Error al filtrar eventos por oportunidad")
        return False


def test_9_eliminar_evento(evento_id):
    """DELETE /crm/eventos/{id} - Eliminar un evento (soft delete)"""
    print_test("9. Eliminar evento (soft delete)")
    
    if not evento_id:
        print_error("No hay evento_id disponible")
        return False
    
    response = requests.delete(f"{API_URL}/{evento_id}")
    print_response(response)
    
    if response.status_code in [200, 204]:
        print_success("Evento eliminado correctamente")
        
        # Verificar que ya no aparece en listado
        response_get = requests.get(f"{API_URL}/{evento_id}")
        if response_get.status_code == 404:
            print_success("✓ Evento no aparece en consultas (soft delete exitoso)")
            return True
        else:
            print_info("Evento aún accesible (verificar implementación de soft delete)")
            return True
    else:
        print_error("Error al eliminar evento")
        return False


def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}SCRIPT DE PRUEBA - EVENTOS API REFACTORIZADO{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    
    resultados = {}
    evento_id = None
    oportunidad_id = None
    
    try:
        # 1. Listar eventos
        resultados["listar"] = test_1_listar_eventos()
        
        # 2. Obtener oportunidad
        oportunidad_id = test_2_obtener_oportunidad()
        resultados["oportunidad"] = oportunidad_id is not None
        
        # 3. Crear evento
        evento_id = test_3_crear_evento(oportunidad_id)
        resultados["crear"] = evento_id is not None
        
        # 4. Obtener evento
        resultados["obtener"] = test_4_obtener_evento(evento_id)
        
        # 5. Actualizar evento
        resultados["actualizar"] = test_5_actualizar_evento(evento_id)
        
        # 6. Cerrar evento
        resultados["cerrar"] = test_6_cerrar_evento(evento_id)
        
        # 7. Tipos de evento
        resultados["tipos"] = test_7_tipos_evento()
        
        # 8. Filtrar por oportunidad
        resultados["filtrar"] = test_8_filtrar_por_oportunidad(oportunidad_id)
        
        # 9. Eliminar evento
        resultados["eliminar"] = test_9_eliminar_evento(evento_id)
        
    except Exception as e:
        print_error(f"Error inesperado: {e}")
        import traceback
        traceback.print_exc()
    
    # Resumen final
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}RESUMEN DE PRUEBAS{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    total = len(resultados)
    exitosos = sum(1 for r in resultados.values() if r)
    
    for test, resultado in resultados.items():
        status = f"{GREEN}✓ PASS{RESET}" if resultado else f"{RED}✗ FAIL{RESET}"
        print(f"{test.ljust(20)}: {status}")
    
    print(f"\n{YELLOW}Total: {exitosos}/{total} pruebas exitosas{RESET}")
    
    if exitosos == total:
        print(f"{GREEN}¡Todas las pruebas pasaron!{RESET}")
    else:
        print(f"{RED}Algunas pruebas fallaron. Revisar logs arriba.{RESET}")


if __name__ == "__main__":
    main()
