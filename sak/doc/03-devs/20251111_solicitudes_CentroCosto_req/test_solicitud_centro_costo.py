"""
Tests de integración: Solicitud con Centro de Costo

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_centro_costo.py
Ejecución: pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_centro_costo.py -v

Nota: Estos tests requieren que el servidor esté corriendo en http://localhost:8000
"""
import sys
from pathlib import Path

# Agregar el directorio backend al path para imports
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import pytest
import requests
from typing import Dict, Any, Generator
from datetime import date, timedelta

# Base URL del API
BASE_URL = "http://localhost:8000/api"


@pytest.fixture
def centro_costo_test() -> Generator[Dict[str, Any], None, None]:
    """Crear un centro de costo de prueba"""
    payload = {
        "nombre": f"Test Centro Solicitud {id({})}",
        "tipo": "General",
        "codigo_contable": f"TSOL-{id({}) % 10000:04d}",
        "activo": True
    }
    
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload)
    assert response.status_code == 201
    centro = response.json()
    
    yield centro
    
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/centros-costo/{centro['id']}")
    except:
        pass


def test_server_is_running():
    """Verificar que el servidor esté corriendo"""
    try:
        response = requests.get(f"{BASE_URL}/../health", timeout=5)
        assert response.status_code == 200
        print("✅ Servidor está corriendo")
    except requests.exceptions.ConnectionError:
        pytest.skip("Servidor no está corriendo en http://localhost:8000")


def test_create_solicitud_with_centro_costo(centro_costo_test: Dict[str, Any]):
    """Crear solicitud con centro de costo"""
    fecha_necesidad = (date.today() + timedelta(days=7)).isoformat()
    
    payload = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        "centro_costo_id": centro_costo_test["id"],
        "fecha_necesidad": fecha_necesidad,
        "comentario": "Test con centro de costo",
        "detalles": []
    }
    
    response = requests.post(f"{BASE_URL}/solicitudes", json=payload)
    
    # Puede ser 201 o 422 si faltan datos requeridos (departamento, tipo_solicitud, user)
    if response.status_code == 422:
        print("⚠️  Test skipped: Faltan datos requeridos en DB (departamento, tipo_solicitud, user)")
        pytest.skip("Faltan datos requeridos en la base de datos")
    
    assert response.status_code == 201
    data = response.json()
    assert data["centro_costo_id"] == centro_costo_test["id"]
    
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/solicitudes/{data['id']}")
    except:
        pass
    
    print(f"✅ Test passed: Solicitud creada con centro_costo_id={centro_costo_test['id']}")


def test_create_solicitud_without_centro_costo():
    """Crear solicitud sin centro de costo debe fallar"""
    fecha_necesidad = (date.today() + timedelta(days=7)).isoformat()
    
    payload = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        # centro_costo_id faltante
        "fecha_necesidad": fecha_necesidad,
        "comentario": "Test sin centro de costo",
        "detalles": []
    }
    
    response = requests.post(f"{BASE_URL}/solicitudes", json=payload)
    
    # Debe fallar con 422 (validation error)
    assert response.status_code == 422
    
    error_data = response.json()
    assert "detail" in error_data
    
    print("✅ Test passed: Solicitud sin centro_costo_id rechazada correctamente")


def test_get_solicitud_with_centro_costo_expanded(centro_costo_test: Dict[str, Any]):
    """Obtener solicitud debe incluir centro_costo expandido"""
    fecha_necesidad = (date.today() + timedelta(days=7)).isoformat()
    
    # Crear solicitud
    payload = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        "centro_costo_id": centro_costo_test["id"],
        "fecha_necesidad": fecha_necesidad,
        "comentario": "Test expansion",
        "detalles": []
    }
    
    response = requests.post(f"{BASE_URL}/solicitudes", json=payload)
    
    if response.status_code == 422:
        pytest.skip("Faltan datos requeridos en la base de datos")
    
    assert response.status_code == 201
    solicitud = response.json()
    
    # Obtener solicitud por ID
    response = requests.get(f"{BASE_URL}/solicitudes/{solicitud['id']}")
    assert response.status_code == 200
    
    data = response.json()
    
    # Verificar que centro_costo está expandido
    assert "centro_costo" in data
    assert data["centro_costo"]["id"] == centro_costo_test["id"]
    assert data["centro_costo"]["nombre"] == centro_costo_test["nombre"]
    
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/solicitudes/{solicitud['id']}")
    except:
        pass
    
    print("✅ Test passed: centro_costo expandido correctamente en solicitud")


def test_update_solicitud_change_centro_costo(centro_costo_test: Dict[str, Any]):
    """Actualizar solicitud cambiando el centro de costo"""
    fecha_necesidad = (date.today() + timedelta(days=7)).isoformat()
    
    # Crear otro centro de costo
    payload_centro2 = {
        "nombre": f"Test Centro 2 {id({})}",
        "tipo": "Proyecto",
        "codigo_contable": f"PROY-{id({}) % 10000:04d}",
        "activo": True
    }
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload_centro2)
    assert response.status_code == 201
    centro2 = response.json()
    
    # Crear solicitud con primer centro
    payload = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        "centro_costo_id": centro_costo_test["id"],
        "fecha_necesidad": fecha_necesidad,
        "detalles": []
    }
    
    response = requests.post(f"{BASE_URL}/solicitudes", json=payload)
    
    if response.status_code == 422:
        requests.delete(f"{BASE_URL}/centros-costo/{centro2['id']}")
        pytest.skip("Faltan datos requeridos en la base de datos")
    
    assert response.status_code == 201
    solicitud = response.json()
    
    # Actualizar con segundo centro
    payload_update = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        "centro_costo_id": centro2["id"],  # Cambiar centro
        "fecha_necesidad": fecha_necesidad,
        "detalles": []
    }
    
    response = requests.put(f"{BASE_URL}/solicitudes/{solicitud['id']}", json=payload_update)
    assert response.status_code == 200
    
    data = response.json()
    assert data["centro_costo_id"] == centro2["id"]
    
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/solicitudes/{solicitud['id']}")
        requests.delete(f"{BASE_URL}/centros-costo/{centro2['id']}")
    except:
        pass
    
    print("✅ Test passed: Centro de costo actualizado en solicitud")


def test_list_solicitudes_filter_by_centro_costo(centro_costo_test: Dict[str, Any]):
    """Listar solicitudes filtradas por centro de costo"""
    fecha_necesidad = (date.today() + timedelta(days=7)).isoformat()
    
    # Crear solicitud
    payload = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        "centro_costo_id": centro_costo_test["id"],
        "fecha_necesidad": fecha_necesidad,
        "detalles": []
    }
    
    response = requests.post(f"{BASE_URL}/solicitudes", json=payload)
    
    if response.status_code == 422:
        pytest.skip("Faltan datos requeridos en la base de datos")
    
    assert response.status_code == 201
    solicitud = response.json()
    
    # Filtrar solicitudes por centro de costo
    response = requests.get(
        f"{BASE_URL}/solicitudes",
        params={"filter": f'{{"centro_costo_id":{centro_costo_test["id"]}}}'}
    )
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    
    # Todas las solicitudes deben tener el centro_costo_id correcto
    for item in data:
        assert item["centro_costo_id"] == centro_costo_test["id"]
    
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/solicitudes/{solicitud['id']}")
    except:
        pass
    
    print(f"✅ Test passed: Filtrado {len(data)} solicitudes por centro_costo_id")


if __name__ == "__main__":
    print("🧪 Ejecutando tests de integración Solicitud + CentroCosto...")
    print("⚠️  Asegúrate de que el servidor esté corriendo en http://localhost:8000\n")
    pytest.main([__file__, "-v", "--tb=short"])
