"""Tests del servicio ConstructoraPedidoService.create_from_agent_message."""
import pytest
from decimal import Decimal
from sqlmodel import Session, select

from app.models import (
    User,
    CRMContacto,
    CRMOportunidad,
    CRMTipoOperacion,
    CRMMensaje,
)
from app.models.constructora.pedido import (
    ConstructoraPedido,
    ConstructoraPedidoDetalle,
    PedidoObraDetalleEstado,
    PedidoObraDetalleOrigen,
    PedidoObraEstado,
    PedidoObraOrigen,
)
from app.services.constructora_pedido_service import constructora_pedido_service


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def seed_base(db_session: Session):
    user = User(nombre="Tester", email="svc_tester@example.com")
    db_session.add(user)
    db_session.flush()

    tipo_op = CRMTipoOperacion(nombre="Venta SVC", codigo="VSVC")
    db_session.add(tipo_op)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Ana Lopez",
        email="ana@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Obra Sur SVC",
        contacto_id=contacto.id,
        responsable_id=user.id,
    )
    db_session.add(oportunidad)
    db_session.commit()
    db_session.refresh(oportunidad)
    return {"user": user, "contacto": contacto, "oportunidad": oportunidad}


def _make_mensaje(
    db_session: Session,
    oportunidad_id: int,
    contacto_id: int,
    pedido_listo: bool = True,
    tipo: str = "pedido_obra_reply",
    items: list | None = None,
) -> CRMMensaje:
    if items is None:
        items = [
            {"item_id": "abc01", "descripcion": "Cemento", "cantidad": 50, "unidad": "kg"},
            {"item_id": "abc02", "descripcion": "Arena", "cantidad": 10, "unidad": "m3"},
        ]
    metadata = {
        "agent_v3": {
            "result": {
                "type": tipo,
                "pedido_listo": pedido_listo,
                "oportunidad_id": oportunidad_id,
                "items": items,
            }
        }
    }
    mensaje = CRMMensaje(
        contacto_id=contacto_id,
        oportunidad_id=oportunidad_id,
        contenido="Confirmando pedido de obra",
        metadata_json=metadata,
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)
    return mensaje


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_create_from_agent_message_happy_path(db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = _make_mensaje(db_session, oportunidad_id, contacto_id)

    pedido = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)

    assert pedido.id is not None
    assert pedido.estado == PedidoObraEstado.BORRADOR
    assert pedido.origen == PedidoObraOrigen.AGENTE
    assert pedido.oportunidad_id == oportunidad_id
    assert pedido.contacto_id == contacto_id
    assert pedido.mensaje_origen_id == mensaje.id
    assert pedido.fecha_confirmacion_agente is not None


def test_create_from_agent_message_detalles(db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = _make_mensaje(db_session, oportunidad_id, contacto_id)
    pedido = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)

    detalles = db_session.exec(
        select(ConstructoraPedidoDetalle).where(ConstructoraPedidoDetalle.pedido_id == pedido.id)
    ).all()

    assert len(detalles) == 2
    descripciones = {d.descripcion for d in detalles}
    assert "Cemento" in descripciones
    assert "Arena" in descripciones

    cemento = next(d for d in detalles if d.descripcion == "Cemento")
    assert cemento.cantidad == Decimal("50")
    assert cemento.cantidad_original == Decimal("50")
    assert cemento.unidad_medida == "kg"
    assert cemento.estado == PedidoObraDetalleEstado.ACTIVA
    assert cemento.origen == PedidoObraDetalleOrigen.AGENTE
    assert cemento.metadata_json == {"agent_item_id": "abc01"}

    # Orden asignado
    ordenes = sorted(d.orden for d in detalles)
    assert ordenes == [0, 1]


def test_create_writes_back_pedido_obra_id(db_session: Session, seed_base):
    """El servicio debe escribir pedido_obra_id en mensaje.metadata_json."""
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = _make_mensaje(db_session, oportunidad_id, contacto_id)
    pedido = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)

    db_session.refresh(mensaje)
    agent_v3 = mensaje.metadata_json.get("agent_v3", {})
    assert agent_v3.get("pedido_obra_id") == pedido.id


# ---------------------------------------------------------------------------
# Idempotencia
# ---------------------------------------------------------------------------

def test_idempotencia_mismo_mensaje(db_session: Session, seed_base):
    """Llamar dos veces con el mismo mensaje_id retorna el mismo pedido."""
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = _make_mensaje(db_session, oportunidad_id, contacto_id)

    pedido1 = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)
    pedido2 = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)

    assert pedido1.id == pedido2.id

    # No se crearon pedidos duplicados
    pedidos = db_session.exec(
        select(ConstructoraPedido).where(ConstructoraPedido.mensaje_origen_id == mensaje.id)
    ).all()
    assert len(pedidos) == 1


# ---------------------------------------------------------------------------
# Casos de error
# ---------------------------------------------------------------------------

def test_error_mensaje_no_encontrado(db_session: Session):
    with pytest.raises(ValueError, match="no encontrado"):
        constructora_pedido_service.create_from_agent_message(db_session, 999999)


def test_error_pedido_listo_false(db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = _make_mensaje(db_session, oportunidad_id, contacto_id, pedido_listo=False)

    with pytest.raises(ValueError, match="pedido_listo"):
        constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)


def test_error_tipo_incorrecto(db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = _make_mensaje(
        db_session, oportunidad_id, contacto_id, tipo="otro_tipo"
    )

    with pytest.raises(ValueError, match="pedido_obra_reply"):
        constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)


def test_error_metadata_vacia(db_session: Session, seed_base):
    """Mensaje sin metadata_json del agente lanza ValueError."""
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = CRMMensaje(
        contacto_id=contacto_id,
        oportunidad_id=oportunidad_id,
        contenido="Sin metadata",
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    with pytest.raises(ValueError):
        constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_items_vacios_crea_pedido_sin_detalles(db_session: Session, seed_base):
    """Lista de ítems vacía crea pedido válido sin líneas."""
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    mensaje = _make_mensaje(db_session, oportunidad_id, contacto_id, items=[])
    pedido = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)

    assert pedido.id is not None
    detalles = db_session.exec(
        select(ConstructoraPedidoDetalle).where(ConstructoraPedidoDetalle.pedido_id == pedido.id)
    ).all()
    assert len(detalles) == 0


def test_oportunidad_id_desde_mensaje(db_session: Session, seed_base):
    """Si result no tiene oportunidad_id, usa el del mensaje."""
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    metadata = {
        "agent_v3": {
            "result": {
                "type": "pedido_obra_reply",
                "pedido_listo": True,
                # sin oportunidad_id en result
                "items": [{"item_id": "x1", "descripcion": "Ladrillo", "cantidad": 200, "unidad": "u"}],
            }
        }
    }
    mensaje = CRMMensaje(
        contacto_id=contacto_id,
        oportunidad_id=oportunidad_id,
        contenido="Test fallback oportunidad",
        metadata_json=metadata,
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    pedido = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)
    assert pedido.oportunidad_id == oportunidad_id


def test_create_from_agent_message_soporta_metadata_agent_v3(db_session: Session, seed_base):
    oportunidad_id = seed_base["oportunidad"].id
    contacto_id = seed_base["contacto"].id

    metadata = {
        "agent_v3": {
            "result": {
                "type": "pedido_obra_reply",
                "pedido_listo": True,
                "oportunidad_id": oportunidad_id,
                "proyecto_id": 123,
                "items": [{"item_id": "v3-1", "descripcion": "Cemento", "cantidad": 20, "unidad": "bolsas"}],
            },
            "conversation_id": "meta:phone:contact",
            "channel_event_id": 55,
        }
    }
    mensaje = CRMMensaje(
        contacto_id=contacto_id,
        oportunidad_id=oportunidad_id,
        contenido="Pedido confirmado desde v3",
        metadata_json=metadata,
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    pedido = constructora_pedido_service.create_from_agent_message(db_session, mensaje.id)

    assert pedido.metadata_json["agent_source"] == "agent_v3"
    db_session.refresh(mensaje)
    assert mensaje.metadata_json["agent_v3"]["pedido_obra_id"] == pedido.id
