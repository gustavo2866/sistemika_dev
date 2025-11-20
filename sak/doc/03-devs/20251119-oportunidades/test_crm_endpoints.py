"""
Tests de Endpoints CRM
Valida que todos los endpoints REST funcionan correctamente
"""
import sys
import os

# Agregar el directorio backend al path para imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    """Test básico de salud de la API"""
    response = client.get("/")
    assert response.status_code in [200, 404]
    print("✅ Test Health: API responde")


# ============================================================================
# TESTS CRUD CONTACTOS
# ============================================================================

def test_listar_contactos():
    """GET /crm/contactos"""
    response = client.get("/crm/contactos")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Listar Contactos: {len(data)} contactos encontrados")


def test_crear_contacto():
    """POST /crm/contactos"""
    payload = {
        "nombre_completo": "Test Endpoint Usuario",
        "telefonos": ["1144556677"],
        "email": "test.endpoint@example.com",
        "origen_lead_id": 1,
        "responsable_id": 1
    }
    response = client.post("/crm/contactos", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["nombre_completo"] == "Test Endpoint Usuario"
    print(f"✅ Test Crear Contacto: ID {data['id']} creado")
    return data["id"]


def test_obtener_contacto():
    """GET /crm/contactos/{id}"""
    # Crear uno primero
    contacto_id = test_crear_contacto()
    
    response = client.get(f"/crm/contactos/{contacto_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == contacto_id
    print(f"✅ Test Obtener Contacto: ID {contacto_id} obtenido")


def test_actualizar_contacto():
    """PUT /crm/contactos/{id}"""
    contacto_id = test_crear_contacto()
    
    payload = {"notas": "Notas actualizadas desde test"}
    response = client.put(f"/crm/contactos/{contacto_id}", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["notas"] == "Notas actualizadas desde test"
    print(f"✅ Test Actualizar Contacto: ID {contacto_id} actualizado")


def test_eliminar_contacto():
    """DELETE /crm/contactos/{id}"""
    response = client.delete("/crm/contactos/99999")  # ID inexistente
    assert response.status_code == 404
    print("✅ Test Eliminar Contacto: Validación ID inexistente funciona")


# ============================================================================
# TESTS CRUD OPORTUNIDADES
# ============================================================================

def test_listar_oportunidades():
    """GET /crm/oportunidades"""
    response = client.get("/crm/oportunidades")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Listar Oportunidades: {len(data)} oportunidades encontradas")


def test_crear_oportunidad():
    """POST /crm/oportunidades"""
    payload = {
        "contacto_id": 1,
        "tipo_operacion_id": 1,
        "propiedad_id": 2,
        "estado": "1-abierta",
        "responsable_id": 1,
        "moneda_id": 1,
        "descripcion_estado": "Test endpoint oportunidad"
    }
    response = client.post("/crm/oportunidades", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["estado"] == "1-abierta"
    print(f"✅ Test Crear Oportunidad: ID {data['id']} creado")
    return data["id"]


def test_obtener_oportunidad():
    """GET /crm/oportunidades/{id}"""
    oportunidad_id = test_crear_oportunidad()
    
    response = client.get(f"/crm/oportunidades/{oportunidad_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == oportunidad_id
    print(f"✅ Test Obtener Oportunidad: ID {oportunidad_id} obtenido")


def test_cambiar_estado_oportunidad():
    """POST /crm/oportunidades/{id}/cambiar-estado"""
    oportunidad_id = test_crear_oportunidad()
    
    payload = {
        "nuevo_estado": "2-visita",
        "descripcion": "Cliente visitó la propiedad desde test",
        "usuario_id": 1
    }
    response = client.post(f"/crm/oportunidades/{oportunidad_id}/cambiar-estado", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "2-visita"
    print(f"✅ Test Cambiar Estado: Oportunidad {oportunidad_id} -> visita")


def test_cambiar_estado_transicion_invalida():
    """POST /crm/oportunidades/{id}/cambiar-estado con transición inválida"""
    oportunidad_id = test_crear_oportunidad()
    
    payload = {
        "nuevo_estado": "5-ganada",  # Desde abierta directamente (inválido)
        "descripcion": "Intento inválido",
        "usuario_id": 1
    }
    response = client.post(f"/crm/oportunidades/{oportunidad_id}/cambiar-estado", json=payload)
    assert response.status_code == 400  # Debe rechazar
    print("✅ Test Transición Inválida: Rechazada correctamente")


def test_listar_logs_oportunidad():
    """GET /crm/oportunidades/{id}/logs"""
    # Crear y cambiar estado para generar logs
    oportunidad_id = test_crear_oportunidad()
    client.post(f"/crm/oportunidades/{oportunidad_id}/cambiar-estado", json={
        "nuevo_estado": "2-visita",
        "descripcion": "Generar log",
        "usuario_id": 1
    })
    
    response = client.get(f"/crm/oportunidades/{oportunidad_id}/logs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1  # Al menos un log
    print(f"✅ Test Listar Logs: {len(data)} logs encontrados")


# ============================================================================
# TESTS CATÁLOGOS
# ============================================================================

def test_listar_tipos_operacion():
    """GET /crm/tipos-operacion"""
    response = client.get("/crm/tipos-operacion")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3  # Al menos alquiler, venta, emprendimiento
    print(f"✅ Test Tipos Operación: {len(data)} tipos encontrados")


def test_listar_monedas():
    """GET /crm/monedas"""
    response = client.get("/crm/monedas")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3  # ARS, USD, EUR
    print(f"✅ Test Monedas: {len(data)} monedas encontradas")


def test_listar_motivos_perdida():
    """GET /crm/motivos-perdida"""
    response = client.get("/crm/motivos-perdida")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Motivos Pérdida: {len(data)} motivos encontrados")


def test_listar_condiciones_pago():
    """GET /crm/condiciones-pago"""
    response = client.get("/crm/condiciones-pago")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Condiciones Pago: {len(data)} condiciones encontradas")


def test_listar_origenes_lead():
    """GET /crm/origenes-lead"""
    response = client.get("/crm/origenes-lead")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Orígenes Lead: {len(data)} orígenes encontrados")


# ============================================================================
# TESTS COTIZACIONES
# ============================================================================

def test_listar_cotizaciones():
    """GET /crm/cotizaciones"""
    response = client.get("/crm/cotizaciones")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Cotizaciones: {len(data)} cotizaciones encontradas")


def test_convertir_monto():
    """GET /crm/cotizaciones/convertir"""
    params = {
        "monto": 100000,
        "moneda_origen": 1,
        "moneda_destino": 2,
        "fecha": "2025-11-20"
    }
    response = client.get("/crm/cotizaciones/convertir", params=params)
    # Puede ser 200 si hay cotización o 400/404 si no hay
    assert response.status_code in [200, 400, 404]
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Test Convertir Monto: Conversión exitosa")
    else:
        print(f"⚠️  Test Convertir Monto: No hay cotización disponible (esperado)")


# ============================================================================
# TESTS EVENTOS
# ============================================================================

def test_listar_eventos():
    """GET /crm/eventos"""
    response = client.get("/crm/eventos")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Eventos: {len(data)} eventos encontrados")


def test_crear_evento():
    """POST /crm/eventos"""
    payload = {
        "contacto_id": 1,
        "tipo_id": 1,
        "motivo_id": 1,
        "fecha_evento": "2025-11-20T10:00:00",
        "descripcion": "Test endpoint evento",
        "asignado_a_id": 1,
        "estado_evento": "hecho"
    }
    response = client.post("/crm/eventos", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    print(f"✅ Test Crear Evento: ID {data['id']} creado")


# ============================================================================
# TESTS EMPRENDIMIENTOS
# ============================================================================

def test_listar_emprendimientos():
    """GET /emprendimientos"""
    response = client.get("/emprendimientos")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Test Emprendimientos: {len(data)} emprendimientos encontrados")


# ============================================================================
# EJECUCIÓN DE TODOS LOS TESTS
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*80)
    print("EJECUTANDO TESTS: Endpoints CRM")
    print("="*80 + "\n")
    
    try:
        # Health check
        test_health()
        
        # Contactos
        print("\n--- TESTS CONTACTOS ---")
        test_listar_contactos()
        test_crear_contacto()
        test_obtener_contacto()
        test_actualizar_contacto()
        test_eliminar_contacto()
        
        # Oportunidades
        print("\n--- TESTS OPORTUNIDADES ---")
        test_listar_oportunidades()
        test_crear_oportunidad()
        test_obtener_oportunidad()
        test_cambiar_estado_oportunidad()
        test_cambiar_estado_transicion_invalida()
        test_listar_logs_oportunidad()
        
        # Catálogos
        print("\n--- TESTS CATÁLOGOS ---")
        test_listar_tipos_operacion()
        test_listar_monedas()
        test_listar_motivos_perdida()
        test_listar_condiciones_pago()
        test_listar_origenes_lead()
        
        # Cotizaciones
        print("\n--- TESTS COTIZACIONES ---")
        test_listar_cotizaciones()
        test_convertir_monto()
        
        # Eventos
        print("\n--- TESTS EVENTOS ---")
        test_listar_eventos()
        test_crear_evento()
        
        # Emprendimientos
        print("\n--- TESTS EMPRENDIMIENTOS ---")
        test_listar_emprendimientos()
        
        print("\n" + "="*80)
        print("✅ TODOS LOS TESTS DE ENDPOINTS PASARON")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR EN TESTS: {e}")
        import traceback
        traceback.print_exc()
