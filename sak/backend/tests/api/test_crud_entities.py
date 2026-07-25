from uuid import uuid4
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.user import User
from app.models.pais import Paises
from app.models.tipo_operacion import TipoOperacion
from app.models.proveedor import Proveedor


def test_create_item(client: TestClient) -> None:
    payload = {"name": "Item Test", "description": "sample"}
    response = client.post("/items", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["name"] == payload["name"]


def test_create_pais(client: TestClient) -> None:
    payload = {"name": f"Pais-{uuid4().hex[:8]}"}
    response = client.post("/paises", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["name"] == payload["name"]


def test_create_tipo_operacion(client: TestClient) -> None:
    payload = {
        "codigo": f"COD{uuid4().hex[:4]}",
        "descripcion": "Tipo test",
        "requiere_iva": True,
    }
    response = client.post("/tipos-operacion", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["codigo"] == payload["codigo"]


def test_create_user(client: TestClient) -> None:
    payload = {
        "nombre": "Usuario Test",
        "email": f"user-{uuid4().hex[:8]}@example.com",
    }
    response = client.post("/users", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["email"] == payload["email"]



def test_create_articulo(client: TestClient) -> None:
    payload = {
        "nombre": "Articulo Test",
        "tipo_articulo": "Material",
        "unidad_medida": "unidad",
        "marca": "Marca Test",
        "sku": f"ART-{uuid4().hex[:8]}",
        "precio": 12345.67,
        "proveedor_id": None,
    }
    response = client.post("/articulos", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["nombre"] == payload["nombre"]

def test_create_proveedor(client: TestClient) -> None:
    payload = {
        "nombre": "Proveedor Test",
        "razon_social": "Proveedor Test SA",
        "cuit": f"20-{uuid4().hex[:8]}-1",
    }
    response = client.post("/proveedores", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["cuit"] == payload["cuit"]


def test_create_tarea(client: TestClient, db_session: Session) -> None:
    user = User(nombre="Tareas User", email=f"tareas-{uuid4().hex[:8]}@example.com")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    payload = {
        "titulo": "Tarea Test",
        "descripcion": "Detalle",
        "user_id": user.id,
    }
    response = client.post("/tareas", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["titulo"] == payload["titulo"]


def test_create_erp_cuenta_tipo(client: TestClient) -> None:
    payload = {
        "nombre": f"Tipo Cuenta Test {uuid4().hex[:8]}",
        "descripcion": "Tipo de cuenta ERP de prueba",
        "cuenta": "1.01.01",
        "es_impuesto": False,
    }
    response = client.post("/erp/cuenta-tipos", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["nombre"] == payload["nombre"]
    assert body["cuenta"] == payload["cuenta"]


def test_create_erp_cuenta(client: TestClient) -> None:
    rubro_payload = {
        "nombre": f"Rubro Cuenta Test {uuid4().hex[:8]}",
        "activo": True,
        "cuentas": [
            {
                "nro_cuenta": 1,
                "cod_cuenta": f"BOOT-{uuid4().hex[:8]}",
                "descripcion": "Cuenta inicial",
                "activo": True,
            }
        ],
    }
    rubro_response = client.post("/erp/rubros", json=rubro_payload)
    assert rubro_response.status_code == 201, rubro_response.text

    payload = {
        "rubro_id": rubro_response.json()["id"],
        "nro_cuenta": 2,
        "cod_cuenta": f"CTA-{uuid4().hex[:8]}",
        "descripcion": "Cuenta ERP de prueba",
        "activo": True,
        "proyectos_concepto_id": None,
    }
    response = client.post("/erp/cuentas", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["cod_cuenta"] == payload["cod_cuenta"]
    assert body["rubro_id"] == payload["rubro_id"]


def test_create_cliente(client: TestClient) -> None:
    payload = {
        "razon_social": "Cliente Demo",
        "cuit": f"30-{uuid4().hex[:8]}-9",
        "direccion": "Calle Falsa 123",
    }
    response = client.post("/api/v1/clientes/", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cuit"] == payload["cuit"]

    # GET by CUIT
    lookup = client.get(f"/api/v1/clientes/by-cuit/{payload['cuit']}")
    assert lookup.status_code == 200
    assert lookup.json()["id"] == body["id"]

    # DELETE (soft)
    delete_response = client.delete(f"/api/v1/clientes/{body['id']}")
    assert delete_response.status_code == 200

