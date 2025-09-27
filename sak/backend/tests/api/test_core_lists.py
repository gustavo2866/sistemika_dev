"""Core list endpoints smoke tests."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

LIST_ENDPOINTS = [
    "/items",
    "/users",
    "/tareas",
    "/paises",
    "/proveedores",
    "/tipos-operacion",
    "/facturas",
    "/factura-detalles",
    "/factura-impuestos",
]


@pytest.mark.parametrize("endpoint", LIST_ENDPOINTS)
def test_list_endpoint_returns_array(client: TestClient, endpoint: str) -> None:
    response = client.get(endpoint)
    assert response.status_code == 200
    body = response.json()
    if isinstance(body, dict):
        assert "data" in body
        assert isinstance(body["data"], list)
    else:
        assert isinstance(body, list)
