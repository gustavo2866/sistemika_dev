from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.articulo import Articulo
from app.models.metodo_pago import MetodoPago
from app.models.tipo_solicitud import TipoSolicitud
from app.models.proveedor import Proveedor
from app.models.user import User


def _seed_po_orden_compra_refs(
    db_session: Session,
) -> tuple[User, Proveedor, MetodoPago, TipoSolicitud, Articulo]:
    user = User(nombre="OC Tester", email=f"oc-{uuid4().hex[:8]}@example.com")
    proveedor = Proveedor(
        nombre="Proveedor OC",
        razon_social="Proveedor OC SA",
        cuit=f"20-{uuid4().hex[:8]}-1",
    )
    tipo = TipoSolicitud(nombre=f"Tipo OC {uuid4().hex[:6]}")
    db_session.add(user)
    db_session.add(proveedor)
    db_session.add(tipo)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(proveedor)
    db_session.refresh(tipo)

    metodo_pago = db_session.exec(select(MetodoPago)).first()
    assert metodo_pago is not None
    articulo = db_session.exec(select(Articulo)).first()
    assert articulo is not None
    return user, proveedor, metodo_pago, tipo, articulo


def _base_payload(user: User, proveedor: Proveedor, metodo_pago: MetodoPago) -> dict:
    return {
        "numero": f"OC-{uuid4().hex[:6]}",
        "fecha_emision": "2026-01-10",
        "subtotal": 1000,
        "total_impuestos": 0,
        "total": 1000,
        "proveedor_id": proveedor.id,
        "usuario_responsable_id": user.id,
        "registrado_por_id": user.id,
        "metodo_pago_id": metodo_pago.id,
    }


def test_create_po_orden_compra_sanitizes_detalle_fk(
    client: TestClient,
    db_session: Session,
) -> None:
    user, proveedor, metodo_pago, _tipo, articulo = _seed_po_orden_compra_refs(db_session)

    payload = _base_payload(user, proveedor, metodo_pago)
    payload["detalles"] = [
        {
            "articulo_id": articulo.id,
            "descripcion": "Linea test",
            "cantidad": 1,
            "unidad_medida": "UN",
            "precio_unitario": 1000,
            "subtotal": 1000,
            "porcentaje_descuento": 0,
            "importe_descuento": 0,
            "porcentaje_iva": 0,
            "importe_iva": 0,
            "total_linea": 1000,
            "orden": 1,
            "solicitud_detalle_id": 9999,
            "po_solicitud_id": None,
        }
    ]

    response = client.post("/po-ordenes-compra", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["id"]
    assert data["proveedor_id"] == proveedor.id
    orden_id = data["id"]

    get_response = client.get(f"/po-ordenes-compra/{orden_id}")
    assert get_response.status_code == 200, get_response.text
    orden = get_response.json()
    assert len(orden.get("detalles", [])) == 1
    assert orden["detalles"][0].get("articulo_id") == articulo.id


def test_get_po_orden_compra(client: TestClient, db_session: Session) -> None:
    user, proveedor, metodo_pago, _tipo, articulo = _seed_po_orden_compra_refs(db_session)

    payload = _base_payload(user, proveedor, metodo_pago)
    payload["subtotal"] = 500
    payload["total"] = 500
    payload["detalles"] = [
        {
            "articulo_id": articulo.id,
            "descripcion": "Linea test",
            "cantidad": 1,
            "unidad_medida": "UN",
            "precio_unitario": 500,
            "subtotal": 500,
            "porcentaje_descuento": 0,
            "importe_descuento": 0,
            "porcentaje_iva": 0,
            "importe_iva": 0,
            "total_linea": 500,
            "orden": 1,
            "solicitud_detalle_id": None,
            "po_solicitud_id": None,
        }
    ]

    create_response = client.post("/po-ordenes-compra", json=payload)
    assert create_response.status_code == 201, create_response.text
    orden_id = create_response.json()["id"]

    response = client.get(f"/po-ordenes-compra/{orden_id}")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == orden_id


def test_list_po_ordenes_compra(client: TestClient, db_session: Session) -> None:
    user, proveedor, metodo_pago, _tipo, articulo = _seed_po_orden_compra_refs(db_session)

    payload = _base_payload(user, proveedor, metodo_pago)
    payload["detalles"] = [
        {
            "articulo_id": articulo.id,
            "descripcion": "Linea list",
            "cantidad": 1,
            "unidad_medida": "UN",
            "precio_unitario": 200,
            "subtotal": 200,
            "porcentaje_descuento": 0,
            "importe_descuento": 0,
            "porcentaje_iva": 0,
            "importe_iva": 0,
            "total_linea": 200,
            "orden": 1,
        }
    ]
    create_response = client.post("/po-ordenes-compra", json=payload)
    assert create_response.status_code == 201, create_response.text

    list_response = client.get("/po-ordenes-compra")
    assert list_response.status_code == 200, list_response.text
    data = list_response.json()
    assert isinstance(data, list)
    assert any(item["id"] == create_response.json()["id"] for item in data)


def test_update_po_orden_compra_optional_fks(
    client: TestClient, db_session: Session
) -> None:
    user, proveedor, metodo_pago, tipo, articulo = _seed_po_orden_compra_refs(db_session)

    payload = _base_payload(user, proveedor, metodo_pago)
    payload["detalles"] = [
        {
            "articulo_id": articulo.id,
            "descripcion": "Linea update",
            "cantidad": 1,
            "unidad_medida": "UN",
            "precio_unitario": 300,
            "subtotal": 300,
            "porcentaje_descuento": 0,
            "importe_descuento": 0,
            "porcentaje_iva": 0,
            "importe_iva": 0,
            "total_linea": 300,
            "orden": 1,
            "solicitud_detalle_id": 9999,
            "po_solicitud_id": None,
        }
    ]
    create_response = client.post("/po-ordenes-compra", json=payload)
    assert create_response.status_code == 201, create_response.text
    orden_id = create_response.json()["id"]

    update_payload = _base_payload(user, proveedor, metodo_pago)
    update_payload["estado"] = "emitida"
    update_payload["tipo_solicitud_id"] = tipo.id
    update_payload["centro_costo_id"] = None
    update_payload["detalles"] = [
        {
            "articulo_id": articulo.id,
            "descripcion": "Linea update 2",
            "cantidad": 2,
            "unidad_medida": "UN",
            "precio_unitario": 300,
            "subtotal": 600,
            "porcentaje_descuento": 0,
            "importe_descuento": 0,
            "porcentaje_iva": 0,
            "importe_iva": 0,
            "total_linea": 600,
            "orden": 1,
            "solicitud_detalle_id": 12345,
            "po_solicitud_id": None,
            "centro_costo_id": None,
        }
    ]

    update_response = client.put(f"/po-ordenes-compra/{orden_id}", json=update_payload)
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["estado"] == "emitida"
    assert updated["tipo_solicitud_id"] == tipo.id
    assert updated.get("centro_costo_id") is None

    get_response = client.get(f"/po-ordenes-compra/{orden_id}")
    assert get_response.status_code == 200, get_response.text
    orden = get_response.json()
    assert len(orden.get("detalles", [])) == 1
    assert orden["detalles"][0].get("articulo_id") == articulo.id


def test_patch_and_delete_po_orden_compra(
    client: TestClient, db_session: Session
) -> None:
    user, proveedor, metodo_pago, _tipo, articulo = _seed_po_orden_compra_refs(db_session)

    payload = _base_payload(user, proveedor, metodo_pago)
    payload["detalles"] = [
        {
            "articulo_id": articulo.id,
            "descripcion": "Linea delete",
            "cantidad": 1,
            "unidad_medida": "UN",
            "precio_unitario": 100,
            "subtotal": 100,
            "porcentaje_descuento": 0,
            "importe_descuento": 0,
            "porcentaje_iva": 0,
            "importe_iva": 0,
            "total_linea": 100,
            "orden": 1,
        }
    ]
    create_response = client.post("/po-ordenes-compra", json=payload)
    assert create_response.status_code == 201, create_response.text
    orden_id = create_response.json()["id"]

    patch_response = client.patch(
        f"/po-ordenes-compra/{orden_id}", json={"estado": "anulada"}
    )
    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json()["estado"] == "anulada"

    delete_response = client.delete(f"/po-ordenes-compra/{orden_id}")
    assert delete_response.status_code == 200, delete_response.text
