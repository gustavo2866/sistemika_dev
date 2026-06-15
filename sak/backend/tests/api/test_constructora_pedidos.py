"""Tests de endpoint para constructora/pedidos."""
import pytest
from decimal import Decimal
from sqlmodel import Session

from app.models import (
    User,
    CRMContacto,
    CRMOportunidad,
    CRMTipoOperacion,
)
from app.models.constructora.pedido import (
    ConstructoraPedido,
    ConstructoraPedidoDetalle,
    PedidoObraDetalleEstado,
    PedidoObraDetalleOrigen,
    PedidoObraEstado,
    PedidoObraOrigen,
)


@pytest.fixture()
def seed_base(db_session: Session):
    user = User(nombre="Tester", email="tester@example.com")
    db_session.add(user)
    db_session.flush()

    tipo_op = CRMTipoOperacion(nombre="Venta", codigo="VNT")
    db_session.add(tipo_op)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Juan Perez",
        email="juan@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Obra Norte",
        contacto_id=contacto.id,
        responsable_id=user.id,
    )
    db_session.add(oportunidad)
    db_session.commit()
    db_session.refresh(oportunidad)
    return {"user": user, "contacto": contacto, "oportunidad": oportunidad}


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

def test_crear_pedido_basico(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    res = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido de materiales semana 1",
        "origen": "manual",
        "detalles": [
            {
                "descripcion": "Cemento Portland",
                "cantidad": "50.000",
                "unidad_medida": "kg",
            }
        ],
    })
    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data["titulo"] == "Pedido de materiales semana 1"
    assert data["estado"] == PedidoObraEstado.BORRADOR.value
    assert data["origen"] == PedidoObraOrigen.MANUAL.value

    # Verificar detalles via GET
    detail = client.get(f"/constructora/pedidos/{data['id']}").json()
    assert len(detail["detalles"]) == 1
    assert detail["detalles"][0]["descripcion"] == "Cemento Portland"
    assert Decimal(str(detail["detalles"][0]["cantidad_original"])) == Decimal("50.000")


def test_crear_pedido_desde_agente(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    res = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido agente chat",
        "origen": "agente",
        "detalles": [
            {"descripcion_original": "5 bolsas arena", "descripcion": "Arena fina", "cantidad": "5.000"},
        ],
    })
    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data["origen"] == PedidoObraOrigen.AGENTE.value
    assert data["estado"] == PedidoObraEstado.BORRADOR.value


# ---------------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------------

def test_listar_pedidos(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido A",
        "detalles": [{"descripcion": "Item A", "cantidad": "1.000"}],
    })
    client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido B",
        "detalles": [{"descripcion": "Item B", "cantidad": "2.000"}],
    })
    res = client.get("/constructora/pedidos")
    assert res.status_code == 200
    assert len(res.json()) >= 2


def test_obtener_pedido_por_id(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    created = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido detalle",
        "detalles": [{"descripcion": "Varillas", "cantidad": "10.000"}],
    }).json()
    res = client.get(f"/constructora/pedidos/{created['id']}")
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


# ---------------------------------------------------------------------------
# UPDATE — sync detalles
# ---------------------------------------------------------------------------

def test_editar_cantidad_detalle(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    created = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido editable",
        "detalles": [{"descripcion": "Ladrillos", "cantidad": "100.000", "id": None}],
    }).json()

    # Obtener detalle_id via GET
    detail_res = client.get(f"/constructora/pedidos/{created['id']}").json()
    detalle_id = detail_res["detalles"][0]["id"]

    res = client.put(f"/constructora/pedidos/{created['id']}", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido editable",
        "detalles": [{"id": detalle_id, "descripcion": "Ladrillos", "cantidad": "200.000"}],
    })
    assert res.status_code == 200, res.text
    updated = client.get(f"/constructora/pedidos/{created['id']}").json()
    assert any(float(d["cantidad"]) == 200.0 for d in updated["detalles"])


def test_agregar_linea_en_update(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    created = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido con lineas",
        "detalles": [{"descripcion": "Item 1", "cantidad": "1.000"}],
    }).json()

    detail_res = client.get(f"/constructora/pedidos/{created['id']}").json()
    detalle_id = detail_res["detalles"][0]["id"]

    res = client.put(f"/constructora/pedidos/{created['id']}", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido con lineas",
        "detalles": [
            {"id": detalle_id, "descripcion": "Item 1", "cantidad": "1.000"},
            {"descripcion": "Item 2 nuevo", "cantidad": "3.000"},
        ],
    })
    assert res.status_code == 200, res.text
    updated = client.get(f"/constructora/pedidos/{created['id']}").json()
    assert len(updated["detalles"]) == 2


def test_eliminar_linea_en_update(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    created = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido 2 lineas",
        "detalles": [
            {"descripcion": "A", "cantidad": "1.000"},
            {"descripcion": "B", "cantidad": "2.000"},
        ],
    }).json()

    detail_res = client.get(f"/constructora/pedidos/{created['id']}").json()
    primera_id = detail_res["detalles"][0]["id"]

    res = client.put(f"/constructora/pedidos/{created['id']}", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido 2 lineas",
        "detalles": [{"id": primera_id, "descripcion": "A", "cantidad": "1.000"}],
    })
    assert res.status_code == 200, res.text
    updated = client.get(f"/constructora/pedidos/{created['id']}").json()
    assert len(updated["detalles"]) == 1


def test_quitar_linea_agente_no_la_borra_ni_cancela_en_update(client, db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    created = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido agente 2 lineas",
        "origen": "agente",
        "detalles": [
            {
                "descripcion": "A",
                "cantidad": "1.000",
                "origen": "agente",
                "estado": "activa",
            },
            {
                "descripcion": "B",
                "cantidad": "2.000",
                "origen": "agente",
                "estado": "activa",
            },
        ],
    }).json()

    detail_res = client.get(f"/constructora/pedidos/{created['id']}").json()
    primera = detail_res["detalles"][0]
    segunda = detail_res["detalles"][1]

    res = client.put(f"/constructora/pedidos/{created['id']}", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido agente 2 lineas",
        "origen": "agente",
        "detalles": [
            {
                "id": primera["id"],
                "descripcion": primera["descripcion"],
                "cantidad": primera["cantidad"],
                "origen": "agente",
                "estado": "activa",
            }
        ],
    })
    assert res.status_code == 200, res.text
    updated = client.get(f"/constructora/pedidos/{created['id']}").json()
    assert len(updated["detalles"]) == 2
    conservada = next(d for d in updated["detalles"] if d["id"] == segunda["id"])
    assert conservada["estado"] == PedidoObraDetalleEstado.ACTIVA.value
    assert conservada["origen"] == PedidoObraDetalleOrigen.AGENTE.value
    db_detalle = db_session.get(ConstructoraPedidoDetalle, segunda["id"])
    assert db_detalle is not None
    db_session.refresh(db_detalle)
    assert db_detalle.estado == PedidoObraDetalleEstado.ACTIVA


def test_quitar_linea_manual_la_borra_en_update(client, db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    created = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido manual 2 lineas",
        "detalles": [
            {
                "descripcion": "A",
                "cantidad": "1.000",
                "origen": "manual",
                "estado": "activa",
            },
            {
                "descripcion": "B",
                "cantidad": "2.000",
                "origen": "manual",
                "estado": "activa",
            },
        ],
    }).json()

    detail_res = client.get(f"/constructora/pedidos/{created['id']}").json()
    primera = detail_res["detalles"][0]
    segunda = detail_res["detalles"][1]

    res = client.put(f"/constructora/pedidos/{created['id']}", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido manual 2 lineas",
        "detalles": [
            {
                "id": primera["id"],
                "descripcion": primera["descripcion"],
                "cantidad": primera["cantidad"],
                "origen": "manual",
                "estado": "activa",
            }
        ],
    })
    assert res.status_code == 200, res.text
    updated = client.get(f"/constructora/pedidos/{created['id']}").json()
    assert len(updated["detalles"]) == 1
    assert db_session.get(ConstructoraPedidoDetalle, segunda["id"]) is None


# ---------------------------------------------------------------------------
# DELETE (soft)
# ---------------------------------------------------------------------------

def test_soft_delete_pedido(client, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    created = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido a borrar",
        "detalles": [{"descripcion": "Item", "cantidad": "1.000"}],
    }).json()
    res = client.delete(f"/constructora/pedidos/{created['id']}")
    assert res.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Constraint único mensaje_origen_id
# ---------------------------------------------------------------------------

def test_mensaje_origen_id_unico(client, db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id

    # Insertar pedido directamente con mensaje_origen_id=999
    pedido = ConstructoraPedido(
        oportunidad_id=oportunidad_id,
        titulo="Pedido original",
        mensaje_origen_id=999,
        origen=PedidoObraOrigen.AGENTE,
    )
    db_session.add(pedido)
    db_session.commit()

    # Intentar crear otro con el mismo mensaje_origen_id vía API
    res = client.post("/constructora/pedidos", json={
        "oportunidad_id": oportunidad_id,
        "titulo": "Pedido duplicado",
        "mensaje_origen_id": 999,
        "origen": "agente",
        "detalles": [{"descripcion": "Item", "cantidad": "1.000"}],
    })
    assert res.status_code in (400, 409, 422, 500)
