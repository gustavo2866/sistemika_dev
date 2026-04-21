from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.auth import create_token
from app.models.compras import PoInvoice, PoInvoiceStatus, PoOrder, PoOrderStatus
from app.models.crm import CRMContacto, CRMEvento, CRMMensaje, CRMOportunidad, CRMTipoEvento
from app.models.enums import EstadoEvento, EstadoMensaje, EstadoOportunidad, TipoMensaje
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.proveedor import Proveedor
from app.models.tipo_solicitud import TipoSolicitud
from app.models.user import User


def _seed_home_dashboard_data(db_session: Session) -> User:
    today = date.today()
    now = datetime.now(UTC)
    future_event_at = datetime.combine(today + timedelta(days=5), datetime.min.time(), tzinfo=UTC)
    overdue_event_at = datetime.combine(today - timedelta(days=5), datetime.min.time(), tzinfo=UTC)

    me = User(nombre="Dashboard User", email="dashboard@example.com")
    other = User(nombre="Other User", email="other@example.com")
    db_session.add(me)
    db_session.add(other)
    db_session.commit()
    db_session.refresh(me)
    db_session.refresh(other)

    tipo_evento = CRMTipoEvento(codigo="call", nombre="Llamada")
    contacto_me = CRMContacto(nombre_completo="Contacto Me", responsable_id=me.id)
    contacto_other = CRMContacto(nombre_completo="Contacto Other", responsable_id=other.id)
    db_session.add(tipo_evento)
    db_session.add(contacto_me)
    db_session.add(contacto_other)
    db_session.commit()
    db_session.refresh(tipo_evento)
    db_session.refresh(contacto_me)
    db_session.refresh(contacto_other)

    prospect = CRMOportunidad(
        titulo="Prospect activo",
        contacto_id=contacto_me.id,
        responsable_id=me.id,
        estado=EstadoOportunidad.PROSPECT.value,
        activo=True,
        fecha_estado=now - timedelta(days=5),
    )
    stale = CRMOportunidad(
        titulo="Oportunidad sin actividad",
        contacto_id=contacto_me.id,
        responsable_id=me.id,
        estado=EstadoOportunidad.ABIERTA.value,
        activo=True,
        fecha_estado=now - timedelta(days=40),
    )
    foreign = CRMOportunidad(
        titulo="Ajena",
        contacto_id=contacto_other.id,
        responsable_id=other.id,
        estado=EstadoOportunidad.PROSPECT.value,
        activo=True,
        fecha_estado=now - timedelta(days=3),
    )
    db_session.add(prospect)
    db_session.add(stale)
    db_session.add(foreign)
    db_session.commit()
    db_session.refresh(prospect)
    db_session.refresh(stale)
    db_session.refresh(foreign)

    db_session.add(
        CRMMensaje(
            contacto_id=contacto_me.id,
            oportunidad_id=prospect.id,
            tipo=TipoMensaje.ENTRADA.value,
            estado=EstadoMensaje.NUEVO.value,
            contenido="Nuevo chat",
        )
    )
    db_session.add(
        CRMMensaje(
            contacto_id=contacto_other.id,
            oportunidad_id=foreign.id,
            tipo=TipoMensaje.ENTRADA.value,
            estado=EstadoMensaje.NUEVO.value,
            contenido="No debe contar",
        )
    )
    db_session.add(
        CRMEvento(
            contacto_id=contacto_me.id,
            oportunidad_id=prospect.id,
            tipo_id=tipo_evento.id,
            titulo="Evento futuro",
            asignado_a_id=me.id,
            estado_evento=EstadoEvento.PENDIENTE.value,
            fecha_evento=future_event_at,
        )
    )
    db_session.add(
        CRMEvento(
            contacto_id=contacto_me.id,
            oportunidad_id=stale.id,
            tipo_id=tipo_evento.id,
            titulo="Evento vencido",
            asignado_a_id=me.id,
            estado_evento=EstadoEvento.PENDIENTE.value,
            fecha_evento=overdue_event_at,
        )
    )
    db_session.add(
        CRMEvento(
            contacto_id=contacto_other.id,
            oportunidad_id=foreign.id,
            tipo_id=tipo_evento.id,
            titulo="Evento ajeno",
            asignado_a_id=other.id,
            estado_evento=EstadoEvento.PENDIENTE.value,
            fecha_evento=overdue_event_at,
        )
    )

    emitida = PoOrderStatus(nombre="emitida", descripcion="Emitida", orden=1)
    confirmada = PoInvoiceStatus(nombre="confirmada", descripcion="Confirmada", orden=1)
    cerrada = PoInvoiceStatus(nombre="cerrada", descripcion="Cerrada", orden=2)
    tipo_solicitud = TipoSolicitud(nombre="General")
    proveedor = Proveedor(nombre="Proveedor Uno", razon_social="Proveedor Uno SA", cuit="20123456789")
    db_session.add(emitida)
    db_session.add(confirmada)
    db_session.add(cerrada)
    db_session.add(tipo_solicitud)
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(emitida)
    db_session.refresh(confirmada)
    db_session.refresh(cerrada)
    db_session.refresh(tipo_solicitud)
    db_session.refresh(proveedor)

    db_session.add(
        PoOrder(
            titulo="OC emitida",
            tipo_solicitud_id=tipo_solicitud.id,
            order_status_id=emitida.id,
            metodo_pago_id=1,
            solicitante_id=me.id,
            proveedor_id=proveedor.id,
            total=Decimal("1000.00"),
        )
    )
    db_session.add(
        PoInvoice(
            titulo="FC confirmada",
            numero="FC-001",
            fecha_emision=today.isoformat(),
            fecha_vencimiento=(today - timedelta(days=2)).isoformat(),
            subtotal=Decimal("1000.00"),
            total_impuestos=Decimal("210.00"),
            total=Decimal("1210.00"),
            proveedor_id=proveedor.id,
            usuario_responsable_id=me.id,
            invoice_status_id=confirmada.id,
        )
    )
    db_session.add(
        PoInvoice(
            titulo="FC cerrada",
            numero="FC-002",
            fecha_emision=today.isoformat(),
            fecha_vencimiento=(today - timedelta(days=2)).isoformat(),
            subtotal=Decimal("500.00"),
            total_impuestos=Decimal("105.00"),
            total=Decimal("605.00"),
            proveedor_id=proveedor.id,
            usuario_responsable_id=me.id,
            invoice_status_id=cerrada.id,
        )
    )

    realizada = PropiedadesStatus(nombre="Realizada", descripcion="Ocupada", orden=4)
    disponible = PropiedadesStatus(nombre="Disponible", descripcion="Disponible", orden=3)
    db_session.add(realizada)
    db_session.add(disponible)
    db_session.commit()
    db_session.refresh(realizada)
    db_session.refresh(disponible)

    db_session.add(
        Propiedad(
            nombre="Propiedad por vencer",
            propietario="Propietario 1",
            propiedad_status_id=realizada.id,
            vencimiento_contrato=today + timedelta(days=15),
        )
    )
    db_session.add(
        Propiedad(
            nombre="Propiedad por actualizar",
            propietario="Propietario 2",
            propiedad_status_id=realizada.id,
            fecha_renovacion=today + timedelta(days=20),
            vencimiento_contrato=today + timedelta(days=120),
        )
    )
    db_session.add(
        Propiedad(
            nombre="Vacancia larga",
            propietario="Propietario 3",
            propiedad_status_id=disponible.id,
            vacancia_fecha=today - timedelta(days=120),
        )
    )
    db_session.commit()

    return me


def _item_map(items: list[dict]) -> dict:
    return {item["key"]: item for item in items}


def test_home_dashboard_bundle_returns_cross_module_summary(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session)
    token = create_token(me.id)

    response = client.get(
        "/api/dashboard/home/bundle",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["environment"]["label"]
    assert body["environment"]["color"]
    assert len(body["quickActions"]) == 3
    assert "sections" not in body
    assert "alert_days" not in body

    mi_dia = _item_map(body["miDia"]["items"])
    assert body["miDia"]["total"] == 5
    assert mi_dia["chats_nuevos"]["count"] == 1
    assert mi_dia["chats_nuevos"]["href"] == "/crm/chat"
    assert mi_dia["agenda"]["count"] == 2
    assert mi_dia["agenda"]["href"] == "/crm/crm-eventos"
    assert mi_dia["agenda"]["meta"]["pendientes"] == 1
    assert mi_dia["agenda"]["meta"]["vencidos"] == 1
    assert mi_dia["aprobaciones_pendientes"]["count"] == 2
    assert mi_dia["aprobaciones_pendientes"]["href"] == "/po-orders-approval"
    assert mi_dia["aprobaciones_pendientes"]["meta"]["ordenes_compra_emitidas"] == 1
    assert mi_dia["aprobaciones_pendientes"]["meta"]["facturas_confirmadas"] == 1

    radar = _item_map(body["radar"]["items"])
    assert "chats_nuevos" not in radar
    assert "agenda_pendiente" not in radar
    assert "agenda_vencida" not in radar
    assert "aprobaciones_pendientes" not in radar
    assert radar["facturas_vencidas"]["count"] == 1
    assert radar["facturas_vencidas"]["href"] == "/po-invoices-agenda"
    assert radar["contratos_proximos_vencer"]["count"] == 1
    assert radar["oportunidades_sin_actividad"]["count"] == 1

    assert body["summary"]["total"] == 11
    assert body["user"]["id"] == me.id
    assert body["user"]["nombre"] == me.nombre


def test_home_dashboard_bundle_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/dashboard/home/bundle")

    assert response.status_code == 401


def test_home_dashboard_partial_returns_only_requested_blocks(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session)
    token = create_token(me.id)

    response = client.get(
        "/api/dashboard/home/partial?keys=miDia,summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert set(body.keys()) == {"generatedAt", "miDia", "summary"}
    assert body["miDia"]["total"] == 5
    assert body["summary"]["total"] == 11
    assert "radar" not in body
