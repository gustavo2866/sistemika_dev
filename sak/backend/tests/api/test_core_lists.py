import pytest
from fastapi.testclient import TestClient

LIST_ENDPOINTS = [
    "/items",
    "/users",
    "/paises",
    "/tareas",
    "/proveedores",
    "/tipos-operacion",
    "/facturas",
    "/factura-detalles",
    "/factura-impuestos",
    "/facturas-extracciones",
    "/api/v1/clientes/",
]


@pytest.mark.parametrize("endpoint", LIST_ENDPOINTS)
def test_list_endpoint_returns_array(client: TestClient, endpoint: str) -> None:
    response = client.get(endpoint)
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
