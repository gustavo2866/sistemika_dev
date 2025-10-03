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

def test_create_solicitud_with_detalle(client: TestClient, db_session: Session) -> None:
    user = User(nombre="Solicitudes Test", email=f"sol-{uuid4().hex[:8]}@example.com")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    solicitud_payload = {
        "tipo": "normal",
        "fecha_necesidad": "2025-10-01",
        "comentario": "Materiales para obra",
        "solicitante_id": user.id,
    }
    solicitud_response = client.post("/solicitudes", json=solicitud_payload)
    assert solicitud_response.status_code == 201, solicitud_response.text
    solicitud_data = solicitud_response.json()
    assert solicitud_data["solicitante_id"] == user.id
    assert solicitud_data["tipo"] == "normal"

    articulo_payload = {
        "nombre": "Arena fina",
        "tipo_articulo": "Material",
        "unidad_medida": "m3",
        "marca": "Generica",
        "sku": f"ARE-{uuid4().hex[:6]}",
        "precio": 1500.50,
        "proveedor_id": None,
    }
    articulo_response = client.post("/articulos", json=articulo_payload)
    assert articulo_response.status_code == 201, articulo_response.text
    articulo_id = articulo_response.json()["id"]

    detalle_payload = {
        "solicitud_id": solicitud_data["id"],
        "articulo_id": articulo_id,
        "descripcion": "Arena fina para relleno",
        "unidad_medida": "m3",
        "cantidad": 2.5,
    }
    detalle_response = client.post("/solicitud-detalles", json=detalle_payload)
    assert detalle_response.status_code == 201, detalle_response.text
    detalle_data = detalle_response.json()
    assert detalle_data["solicitud_id"] == solicitud_data["id"]
    assert Decimal(str(detalle_data["cantidad"])) == Decimal("2.5")

    fetched = client.get(f"/solicitudes/{solicitud_data['id']}")
    assert fetched.status_code == 200, fetched.text
    fetched_data = fetched.json()
    assert fetched_data["id"] == solicitud_data["id"]

    detalle_list = client.get(f"/solicitud-detalles?solicitud_id={solicitud_data['id']}")
    assert detalle_list.status_code == 200, detalle_list.text
    detalle_items = detalle_list.json()
    assert any(item["id"] == detalle_data["id"] for item in detalle_items)
    assert any(item["descripcion"] == detalle_payload["descripcion"] for item in detalle_items)
