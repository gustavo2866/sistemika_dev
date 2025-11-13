"""
Tests de endpoints de CentroCosto

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_endpoints.py
Ejecución: pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_endpoints.py -v

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


# Base URL del API
BASE_URL = "http://localhost:8000/api"


@pytest.fixture
def centro_costo_test() -> Generator[Dict[str, Any], None, None]:
    """Crear un centro de costo de prueba y limpiarlo después"""
    # Crear centro de costo
    payload = {
        "nombre": f"Test Centro API {id({})}",  # Nombre único usando hash
        "tipo": "General",
        "codigo_contable": f"TEST-{id({}) % 10000:04d}",
        "descripcion": "Centro de costo para tests de API",
        "activo": True
    }
    
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload)
    assert response.status_code == 201, f"Error creando fixture: {response.text}"
    
    centro = response.json()
    
    yield centro
    
    # Cleanup: eliminar el centro de costo
    try:
        requests.delete(f"{BASE_URL}/centros-costo/{centro['id']}")
    except:
        pass  # Si falla el cleanup, no es crítico


def test_server_is_running():
    """Verificar que el servidor esté corriendo"""
    try:
        response = requests.get(f"{BASE_URL}/../health", timeout=5)
        assert response.status_code == 200
        print("✅ Servidor está corriendo")
    except requests.exceptions.ConnectionError:
        pytest.skip("Servidor no está corriendo en http://localhost:8000")


def test_get_all_centros_costo(centro_costo_test: Dict[str, Any]):
    """GET /api/centros-costo - Listar todos"""
    response = requests.get(f"{BASE_URL}/centros-costo")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    
    # Verificar que nuestro centro de prueba está en la lista
    ids = [item["id"] for item in data]
    assert centro_costo_test["id"] in ids
    
    print(f"✅ Test passed: {len(data)} centros de costo encontrados")


def test_get_centro_costo_by_id(centro_costo_test: Dict[str, Any]):
    """GET /api/centros-costo/{id} - Obtener por ID"""
    centro_id = centro_costo_test["id"]
    response = requests.get(f"{BASE_URL}/centros-costo/{centro_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == centro_id
    assert data["nombre"] == centro_costo_test["nombre"]
    assert data["tipo"] == "General"
    
    print(f"✅ Test passed: Centro de costo {centro_id} obtenido correctamente")


def test_create_centro_costo():
    """POST /api/centros-costo - Crear nuevo"""
    payload = {
        "nombre": f"Nuevo Centro Test {id({})}",
        "tipo": "General",
        "codigo_contable": f"NEW-{id({}) % 10000:04d}",
        "descripcion": "Descripción de prueba",
        "activo": True
    }
    
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload)
    assert response.status_code == 201
    
    data = response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["codigo_contable"] == payload["codigo_contable"]
    assert data["tipo"] == "General"
    assert "id" in data
    
    # Cleanup
    requests.delete(f"{BASE_URL}/centros-costo/{data['id']}")
    
    print(f"✅ Test passed: Centro de costo creado con ID {data['id']}")


def test_create_centro_costo_all_types():
    """POST /api/centros-costo - Crear centros de todos los tipos"""
    tipos = ["General", "Proyecto", "Propiedad", "Socios"]
    created_ids = []
    
    for tipo in tipos:
        payload = {
            "nombre": f"Test {tipo} {id({})}",
            "tipo": tipo,
            "codigo_contable": f"{tipo[:4].upper()}-{id({}) % 10000:04d}",
            "activo": True
        }
        
        response = requests.post(f"{BASE_URL}/centros-costo", json=payload)
        assert response.status_code == 201
        
        data = response.json()
        assert data["tipo"] == tipo
        created_ids.append(data["id"])
    
    # Cleanup
    for centro_id in created_ids:
        requests.delete(f"{BASE_URL}/centros-costo/{centro_id}")
    
    print(f"✅ Test passed: Creados centros de {len(tipos)} tipos")


def test_update_centro_costo(centro_costo_test: Dict[str, Any]):
    """PUT /api/centros-costo/{id} - Actualizar"""
    centro_id = centro_costo_test["id"]
    
    payload = {
        "nombre": f"Nombre Actualizado {id({})}",
        "tipo": "General",
        "codigo_contable": centro_costo_test["codigo_contable"],
        "activo": True
    }
    
    response = requests.put(f"{BASE_URL}/centros-costo/{centro_id}", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["id"] == centro_id
    
    print(f"✅ Test passed: Centro de costo {centro_id} actualizado")


def test_delete_centro_costo():
    """DELETE /api/centros-costo/{id} - Soft delete"""
    # Crear un centro para eliminar
    payload = {
        "nombre": f"Centro Para Eliminar {id({})}",
        "tipo": "General",
        "codigo_contable": f"DEL-{id({}) % 10000:04d}",
        "activo": True
    }
    
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload)
    assert response.status_code == 201
    centro_id = response.json()["id"]
    
    # Eliminar
    response = requests.delete(f"{BASE_URL}/centros-costo/{centro_id}")
    assert response.status_code == 204
    
    # Verificar que ya no existe (o está marcado como deleted)
    response = requests.get(f"{BASE_URL}/centros-costo/{centro_id}")
    # Puede ser 404 (eliminado) o 200 con deleted_at (soft delete)
    assert response.status_code in [200, 404]
    
    print(f"✅ Test passed: Centro de costo {centro_id} eliminado")


def test_filter_by_tipo():
    """GET /api/centros-costo?filter={tipo:General} - Filtrar por tipo"""
    response = requests.get(f"{BASE_URL}/centros-costo", params={"filter": '{"tipo":"General"}'})
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    
    # Todos los items deben ser tipo General
    for item in data:
        assert item["tipo"] == "General"
    
    print(f"✅ Test passed: {len(data)} centros de costo tipo General")


def test_filter_by_activo():
    """GET /api/centros-costo?filter={activo:true} - Filtrar por activo"""
    response = requests.get(f"{BASE_URL}/centros-costo", params={"filter": '{"activo":true}'})
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    
    # Todos los items deben estar activos
    for item in data:
        assert item["activo"] is True
    
    print(f"✅ Test passed: {len(data)} centros de costo activos")


def test_search_by_nombre():
    """GET /api/centros-costo?q=General - Búsqueda por nombre"""
    response = requests.get(f"{BASE_URL}/centros-costo", params={"q": "General"})
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    
    # Al menos uno debe contener "General" en el nombre o código
    found = any("General" in item.get("nombre", "") or "General" in item.get("tipo", "") for item in data)
    assert found
    
    print(f"✅ Test passed: Búsqueda encontró {len(data)} resultados")


def test_create_duplicate_codigo_contable(centro_costo_test: Dict[str, Any]):
    """POST con codigo_contable duplicado debe ser permitido"""
    payload = {
        "nombre": f"Otro Centro Duplicado {id({})}",
        "tipo": "General",
        "codigo_contable": centro_costo_test["codigo_contable"],  # Duplicado permitido
        "activo": True
    }
    
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload)
    assert response.status_code == 201  # Debe permitir duplicados
    
    data = response.json()
    assert data["codigo_contable"] == centro_costo_test["codigo_contable"]
    
    # Cleanup
    requests.delete(f"{BASE_URL}/centros-costo/{data['id']}")
    
    print("✅ Test passed: codigo_contable duplicado permitido")


def test_create_duplicate_nombre_fails():
    """POST con nombre duplicado debe fallar"""
    nombre_unico = f"Centro Nombre Unico {id({})}"
    
    # Crear primer centro
    payload = {
        "nombre": nombre_unico,
        "tipo": "General",
        "codigo_contable": f"UNQ1-{id({}) % 10000:04d}",
        "activo": True
    }
    
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload)
    assert response.status_code == 201
    centro_id = response.json()["id"]
    
    # Intentar crear otro con el mismo nombre
    payload2 = {
        "nombre": nombre_unico,  # Mismo nombre
        "tipo": "General",
        "codigo_contable": f"UNQ2-{id({}) % 10000:04d}",
        "activo": True
    }
    
    response = requests.post(f"{BASE_URL}/centros-costo", json=payload2)
    assert response.status_code in [400, 422, 500]  # Debe fallar
    
    # Cleanup
    requests.delete(f"{BASE_URL}/centros-costo/{centro_id}")
    
    print("✅ Test passed: nombre duplicado rechazado")


def test_pagination():
    """GET /api/centros-costo?range=[0,4] - Paginación"""
    response = requests.get(f"{BASE_URL}/centros-costo", params={"range": "[0,4]"})
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 5  # Máximo 5 elementos (0 a 4 inclusive)
    
    print(f"✅ Test passed: Paginación retornó {len(data)} elementos")


if __name__ == "__main__":
    print("🧪 Ejecutando tests de endpoints CentroCosto...")
    print("⚠️  Asegúrate de que el servidor esté corriendo en http://localhost:8000\n")
    pytest.main([__file__, "-v", "--tb=short"])
