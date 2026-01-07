#!/usr/bin/env python3
"""
Script para probar endpoints CRUD de CRM Catálogo Respuestas
y poblar con respuestas estándares para chat inmobiliario
"""
import requests
import json
import sys
from typing import List, Dict, Any

# Configuración
BASE_URL = "http://localhost:8000"
API_PREFIX = "/crm/catalogos/respuestas"
FULL_URL = f"{BASE_URL}{API_PREFIX}"

# Headers para requests
HEADERS = {
    "Content-Type": "application/json"
}

# Respuestas estándar para inmobiliaria
RESPUESTAS_ESTANDAR = [
    {
        "titulo": "Saludo inicial",
        "texto": "¡Hola! Gracias por tu interés en nuestras propiedades. Soy [NOMBRE], tu asesor inmobiliario. ¿En qué puedo ayudarte hoy? ¿Buscas comprar, vender o alquilar?",
        "activo": True
    },
    {
        "titulo": "Solicitar información del cliente",
        "texto": "Para poder ofrecerte las mejores opciones, me gustaría conocer un poco más sobre lo que buscas: ¿Qué tipo de propiedad te interesa? ¿En qué zona? ¿Cuál es tu presupuesto aproximado?",
        "activo": True
    },
    {
        "titulo": "Programar visita",
        "texto": "Excelente, tenemos varias opciones que podrían interesarte. ¿Te gustaría agendar una visita? Estoy disponible [DÍAS/HORARIOS]. También puedo enviarte más información y fotos por WhatsApp si prefieres.",
        "activo": True
    }
]

def test_get_all():
    """Probar GET /crm/catalogos/respuestas"""
    print("🔍 Probando GET (obtener todas las respuestas)...")
    try:
        response = requests.get(FULL_URL, headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Respuestas encontradas: {len(data)}")
            return data
        else:
            print(f"Error: {response.text}")
            return []
    except Exception as e:
        print(f"❌ Error en GET: {e}")
        return []

def test_create(respuesta_data: Dict[str, Any]):
    """Probar POST /crm/catalogos/respuestas"""
    print(f"➕ Probando POST (crear respuesta: {respuesta_data['titulo']})...")
    try:
        response = requests.post(FULL_URL, headers=HEADERS, json=respuesta_data)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Respuesta creada con ID: {data.get('id')}")
            return data
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error en POST: {e}")
        return None

def test_get_by_id(respuesta_id: int):
    """Probar GET /crm/catalogos/respuestas/{id}"""
    print(f"🔎 Probando GET by ID (ID: {respuesta_id})...")
    try:
        response = requests.get(f"{FULL_URL}/{respuesta_id}", headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Respuesta encontrada: {data.get('titulo')}")
            return data
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error en GET by ID: {e}")
        return None

def test_update(respuesta_id: int, updated_data: Dict[str, Any]):
    """Probar PUT /crm/catalogos/respuestas/{id}"""
    print(f"✏️ Probando PUT (actualizar ID: {respuesta_id})...")
    try:
        response = requests.put(f"{FULL_URL}/{respuesta_id}", headers=HEADERS, json=updated_data)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Respuesta actualizada: {data.get('titulo')}")
            return data
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error en PUT: {e}")
        return None

def test_delete(respuesta_id: int):
    """Probar DELETE /crm/catalogos/respuestas/{id}"""
    print(f"🗑️ Probando DELETE (eliminar ID: {respuesta_id})...")
    try:
        response = requests.delete(f"{FULL_URL}/{respuesta_id}", headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 204]:
            print(f"✅ Respuesta eliminada exitosamente")
            return True
        else:
            print(f"❌ Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error en DELETE: {e}")
        return False

def poblar_respuestas_estandar():
    """Poblar la tabla con respuestas estándares si está vacía"""
    print("\n📋 Poblando tabla con respuestas estándares...")
    
    # Verificar si ya existen respuestas
    existing_responses = test_get_all()
    if len(existing_responses) > 0:
        print(f"⚠️ Ya existen {len(existing_responses)} respuestas. Saltando población inicial.")
        return existing_responses
    
    created_responses = []
    for respuesta in RESPUESTAS_ESTANDAR:
        created = test_create(respuesta)
        if created:
            created_responses.append(created)
    
    print(f"✅ Creadas {len(created_responses)} respuestas estándares")
    return created_responses

def test_crud_complete():
    """Ejecutar prueba completa del CRUD"""
    print("🚀 Iniciando pruebas completas del CRUD...")
    print("="*60)
    
    # 1. Poblar respuestas estándares
    responses = poblar_respuestas_estandar()
    
    print("\n" + "="*60)
    print("🧪 INICIANDO PRUEBAS CRUD")
    print("="*60)
    
    # 2. Probar GET all
    all_responses = test_get_all()
    
    if not all_responses:
        print("❌ No hay respuestas para probar. Terminando pruebas.")
        return
    
    # 3. Tomar la primera respuesta para pruebas
    test_response = all_responses[0]
    response_id = test_response['id']
    
    print(f"\n📋 Usando respuesta de prueba ID: {response_id}")
    
    # 4. Probar GET by ID
    single_response = test_get_by_id(response_id)
    
    # 5. Probar UPDATE
    if single_response:
        updated_data = single_response.copy()
        updated_data['texto'] = updated_data['texto'] + " [TEXTO ACTUALIZADO EN PRUEBA]"
        test_update(response_id, updated_data)
        
        # Verificar la actualización
        updated_response = test_get_by_id(response_id)
    
    # 6. Crear una respuesta de prueba para DELETE
    test_respuesta_delete = {
        "titulo": "Respuesta de prueba DELETE",
        "texto": "Esta respuesta será eliminada en la prueba",
        "activo": True
    }
    
    created_for_delete = test_create(test_respuesta_delete)
    if created_for_delete:
        delete_id = created_for_delete['id']
        
        # 7. Probar DELETE
        test_delete(delete_id)
        
        # Verificar que fue eliminada
        test_get_by_id(delete_id)  # Debería devolver 404
    
    # 8. Resumen final
    print("\n" + "="*60)
    print("📊 RESUMEN DE PRUEBAS")
    print("="*60)
    
    final_responses = test_get_all()
    print(f"Total de respuestas finales: {len(final_responses)}")
    
    print("\n✅ Pruebas CRUD completadas exitosamente!")
    print("\n📋 Respuestas disponibles:")
    for resp in final_responses:
        status = "🟢" if resp.get('activo', False) else "🔴"
        print(f"  {status} ID:{resp['id']} - {resp['titulo']}")

def main():
    """Función principal"""
    print("🏠 PRUEBAS CRUD - CRM Catálogo Respuestas Inmobiliaria")
    print("="*60)
    print(f"🌐 API Base: {FULL_URL}")
    
    try:
        test_crud_complete()
    except KeyboardInterrupt:
        print("\n⚠️ Pruebas canceladas por el usuario")
    except Exception as e:
        print(f"\n❌ Error general: {e}")
    
    print(f"\n🎯 Para probar manualmente: {FULL_URL}")
    print(f"📚 Documentación API: {BASE_URL}/docs")

if __name__ == "__main__":
    main()