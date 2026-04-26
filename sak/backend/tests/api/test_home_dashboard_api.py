import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from urllib.parse import parse_qs, unquote, urlparse

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.auth import create_token
from app.models.compras import PoInvoice, PoInvoiceStatus, PoOrder, PoOrderStatus
from app.models.contrato import Contrato
from app.models.crm import CRMContacto, CRMEvento, CRMMensaje, CRMOportunidad, CRMTipoEvento
from app.models.departamento import Departamento
from app.models.enums import EstadoEvento, EstadoMensaje, EstadoOportunidad, TipoMensaje
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.proveedor import Proveedor
from app.models.tipo_solicitud import TipoSolicitud
from app.models.user import User
from app.services.propiedades_dashboard import _get_inmobiliaria_alert_days, build_prop_selectors


def _seed_home_dashboard_data(
    db_session: Session,
    *,
    departamento_nombre: str = "Direccion",
) -> User:
    today = date.today()
    now = datetime.now(UTC)
    future_event_at = datetime.combine(today + timedelta(days=5), datetime.min.time(), tzinfo=UTC)
    overdue_event_at = datetime.combine(today - timedelta(days=5), datetime.min.time(), tzinfo=UTC)

    departamento_me = Departamento(nombre=departamento_nombre, activo=True)
    departamento_other = Departamento(nombre=f"{departamento_nombre} Other", activo=True)
    db_session.add(departamento_me)
    db_session.add(departamento_other)
    db_session.commit()
    db_session.refresh(departamento_me)
    db_session.refresh(departamento_other)

    me = User(
        nombre="Dashboard User",
        email="dashboard@example.com",
        departamento_id=departamento_me.id,
    )
    other = User(
        nombre="Other User",
        email="other@example.com",
        departamento_id=departamento_other.id,
    )
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
    recent_open = CRMOportunidad(
        titulo="Oportunidad reciente",
        contacto_id=contacto_me.id,
        responsable_id=me.id,
        estado=EstadoOportunidad.VISITA.value,
        activo=True,
        fecha_estado=now - timedelta(days=5),
    )
    foreign_stale = CRMOportunidad(
        titulo="Oportunidad ajena sin actividad",
        contacto_id=contacto_other.id,
        responsable_id=other.id,
        estado=EstadoOportunidad.COTIZA.value,
        activo=True,
        fecha_estado=now - timedelta(days=45),
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
    db_session.add(recent_open)
    db_session.add(foreign_stale)
    db_session.add(foreign)
    db_session.commit()
    db_session.refresh(prospect)
    db_session.refresh(stale)
    db_session.refresh(recent_open)
    db_session.refresh(foreign_stale)
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

    solicitada = PoOrderStatus(nombre="solicitada", descripcion="Solicitada", orden=0)
    emitida = PoOrderStatus(nombre="emitida", descripcion="Emitida", orden=1)
    aprobada = PoOrderStatus(nombre="aprobada", descripcion="Aprobada", orden=2)
    confirmada = PoInvoiceStatus(nombre="confirmada", descripcion="Confirmada", orden=1)
    cerrada = PoInvoiceStatus(nombre="cerrada", descripcion="Cerrada", orden=2)
    tipo_solicitud = TipoSolicitud(nombre="General")
    proveedor = Proveedor(nombre="Proveedor Uno", razon_social="Proveedor Uno SA", cuit="20123456789")
    db_session.add(solicitada)
    db_session.add(emitida)
    db_session.add(aprobada)
    db_session.add(confirmada)
    db_session.add(cerrada)
    db_session.add(tipo_solicitud)
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(solicitada)
    db_session.refresh(emitida)
    db_session.refresh(aprobada)
    db_session.refresh(confirmada)
    db_session.refresh(cerrada)
    db_session.refresh(tipo_solicitud)
    db_session.refresh(proveedor)

    db_session.add(
        PoOrder(
            titulo="Solicitud mia",
            tipo_solicitud_id=tipo_solicitud.id,
            order_status_id=solicitada.id,
            metodo_pago_id=1,
            solicitante_id=me.id,
            proveedor_id=proveedor.id,
            total=Decimal("500.00"),
        )
    )
    db_session.add(
        PoOrder(
            titulo="Solicitud ajena",
            tipo_solicitud_id=tipo_solicitud.id,
            order_status_id=solicitada.id,
            metodo_pago_id=1,
            solicitante_id=other.id,
            proveedor_id=proveedor.id,
            total=Decimal("700.00"),
        )
    )
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
        PoOrder(
            titulo="OC aprobada",
            tipo_solicitud_id=tipo_solicitud.id,
            order_status_id=aprobada.id,
            metodo_pago_id=1,
            solicitante_id=me.id,
            proveedor_id=proveedor.id,
            total=Decimal("1500.00"),
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

    propiedad_vencer = Propiedad(
        nombre="Propiedad por vencer",
        propietario="Propietario 1",
        propiedad_status_id=realizada.id,
        vencimiento_contrato=today + timedelta(days=15),
    )
    propiedad_actualizar = Propiedad(
        nombre="Propiedad por actualizar",
        propietario="Propietario 2",
        propiedad_status_id=realizada.id,
        fecha_renovacion=today + timedelta(days=20),
        vencimiento_contrato=today + timedelta(days=120),
    )
    propiedad_vacancia = Propiedad(
        nombre="Vacancia larga",
        propietario="Propietario 3",
        propiedad_status_id=disponible.id,
        vacancia_fecha=today - timedelta(days=120),
    )
    propiedad_fuera_radar = Propiedad(
        nombre="Propiedad fuera de radar",
        propietario="Propietario 4",
        propiedad_status_id=realizada.id,
        vencimiento_contrato=today + timedelta(days=180),
    )
    db_session.add(propiedad_vencer)
    db_session.add(propiedad_actualizar)
    db_session.add(propiedad_vacancia)
    db_session.add(propiedad_fuera_radar)
    db_session.commit()
    db_session.refresh(propiedad_vencer)
    db_session.refresh(propiedad_actualizar)
    db_session.refresh(propiedad_vacancia)
    db_session.refresh(propiedad_fuera_radar)

    db_session.add(
        Contrato(
            propiedad_id=propiedad_vencer.id,
            fecha_inicio=today - timedelta(days=350),
            fecha_vencimiento=today + timedelta(days=15),
            valor_alquiler=150000,
            moneda="ARS",
            inquilino_nombre="Ana",
            inquilino_apellido="Vencer",
            estado="vigente",
        )
    )
    db_session.add(
        Contrato(
            propiedad_id=propiedad_actualizar.id,
            fecha_inicio=today - timedelta(days=340),
            fecha_vencimiento=today + timedelta(days=120),
            fecha_renovacion=today + timedelta(days=20),
            valor_alquiler=175000,
            moneda="ARS",
            inquilino_nombre="Beto",
            inquilino_apellido="Actualizar",
            estado="vigente",
        )
    )
    db_session.add(
        Contrato(
            propiedad_id=propiedad_fuera_radar.id,
            fecha_inicio=today - timedelta(days=120),
            fecha_vencimiento=today + timedelta(days=180),
            valor_alquiler=190000,
            moneda="ARS",
            inquilino_nombre="Carla",
            inquilino_apellido="FueraRadar",
            estado="vigente",
        )
    )
    db_session.add(
        Contrato(
            propiedad_id=propiedad_fuera_radar.id,
            fecha_inicio=today - timedelta(days=45),
            fecha_vencimiento=today + timedelta(days=10),
            valor_alquiler=110000,
            moneda="ARS",
            inquilino_nombre="Diego",
            inquilino_apellido="Borrador",
            estado="borrador",
        )
    )
    db_session.commit()

    return me


def _item_map(items: list[dict]) -> dict:
    return {item["key"]: item for item in items}


def _item_keys(items: list[dict]) -> list[str]:
    return [item["key"] for item in items]


def _extract_filter_from_href(href: str) -> dict:
    parsed = urlparse(href)
    raw_filter = parse_qs(parsed.query).get("filter", [None])[0]
    assert raw_filter is not None
    return json.loads(unquote(raw_filter))


def _get_order_status_id(db_session: Session, nombre: str) -> int:
    status_id = db_session.exec(
        select(PoOrderStatus.id).where(PoOrderStatus.nombre == nombre)
    ).first()
    assert status_id is not None
    return status_id


def test_home_dashboard_bundle_returns_cross_module_payload(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session)
    solicitada_status_id = _get_order_status_id(db_session, "solicitada")
    emitida_status_id = _get_order_status_id(db_session, "emitida")
    aprobada_status_id = _get_order_status_id(db_session, "aprobada")
    dias_vencimiento, dias_actualizacion, _ = _get_inmobiliaria_alert_days(db_session)
    token = create_token(me.id)

    response = client.get(
        "/api/dashboard/home/bundle",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["environment"]["label"]
    assert body["environment"]["color"]
    assert "quickActions" not in body
    assert "sections" not in body
    assert "alert_days" not in body
    assert "summary" not in body

    mi_dia = _item_map(body["miDia"]["items"])
    assert body["miDia"]["total"] == 6
    assert mi_dia["chats_nuevos"]["count"] == 1
    assert mi_dia["chats_nuevos"]["href"] == "/crm/chat"
    assert mi_dia["agenda"]["count"] == 2
    assert mi_dia["agenda"]["href"] == "/crm/crm-eventos"
    assert mi_dia["agenda"]["meta"]["pendientes"] == 1
    assert mi_dia["agenda"]["meta"]["vencidos"] == 1
    assert "aprobaciones_pendientes" not in mi_dia
    assert "solicitudes_pendientes" not in mi_dia
    assert mi_dia["mis_compras"]["count"] == 3
    assert mi_dia["mis_compras"]["scope"] == "personal"
    assert _extract_filter_from_href(mi_dia["mis_compras"]["href"]) == {
        "solicitante_id": me.id,
        "order_status_id__in": [solicitada_status_id, emitida_status_id, aprobada_status_id],
    }

    assert _item_keys(body["radar"]["items"]) == [
        "aprobaciones_pendientes",
        "solicitudes_pendientes",
        "contratos_proximos_vencer",
        "contratos_proximos_actualizar",
        "vacancias_prolongadas",
        "oportunidades_sin_actividad",
        "oportunidades_prospect",
    ]
    radar = _item_map(body["radar"]["items"])
    assert "chats_nuevos" not in radar
    assert "agenda_pendiente" not in radar
    assert "agenda_vencida" not in radar
    assert "facturas_vencidas" not in radar
    assert radar["aprobaciones_pendientes"]["count"] == 1
    assert radar["aprobaciones_pendientes"]["href"] == "/po-orders-approval"
    assert radar["aprobaciones_pendientes"]["scope"] == "global"
    assert radar["aprobaciones_pendientes"]["sectionLabel"] == "Compras"
    assert radar["aprobaciones_pendientes"]["meta"]["ordenes_compra_emitidas"] == 1
    assert "facturas_confirmadas" not in radar["aprobaciones_pendientes"]["meta"]
    assert radar["solicitudes_pendientes"]["count"] == 2
    assert radar["solicitudes_pendientes"]["scope"] == "global"
    assert radar["solicitudes_pendientes"]["sectionLabel"] == "Compras"
    assert _extract_filter_from_href(radar["solicitudes_pendientes"]["href"]) == {
        "order_status_id": solicitada_status_id,
    }
    assert radar["contratos_proximos_vencer"]["count"] == 1
    assert _extract_filter_from_href(radar["contratos_proximos_vencer"]["href"]) == {
        "estado": "vigente",
        "fecha_vencimiento": {
            "lte": (date.today() + timedelta(days=dias_vencimiento)).isoformat(),
        },
    }
    assert radar["contratos_proximos_actualizar"]["count"] == 1
    assert _extract_filter_from_href(radar["contratos_proximos_actualizar"]["href"]) == {
        "estado": "vigente",
        "fecha_renovacion": {
            "lte": (date.today() + timedelta(days=dias_actualizacion)).isoformat(),
        },
    }
    assert radar["vacancias_prolongadas"]["count"] == 1
    assert radar["oportunidades_sin_actividad"]["count"] == 2
    assert _extract_filter_from_href(radar["oportunidades_sin_actividad"]["href"]) == {
        "sin_actividad_days": 30,
    }
    assert radar["oportunidades_prospect"]["count"] == 1
    assert radar["oportunidades_prospect"]["scope"] == "personal"
    assert radar["oportunidades_prospect"]["sectionLabel"] == "CRM"
    assert _extract_filter_from_href(radar["oportunidades_prospect"]["href"]) == {
        "estado": "0-prospect",
    }

    assert body["user"]["id"] == me.id
    assert body["user"]["nombre"] == me.nombre


def test_home_dashboard_domain_endpoints_return_independent_sections(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session)
    token = create_token(me.id)
    headers = {"Authorization": f"Bearer {token}"}

    context_response = client.get("/api/dashboard/home/context", headers=headers)
    assert context_response.status_code == 200, context_response.text
    context = context_response.json()
    assert set(context.keys()) == {"generatedAt", "environment", "user"}
    assert context["user"]["id"] == me.id

    expected_sections = {
        "/api/dashboard/home/personal": "personal",
        "/api/dashboard/home/poorders": "compras",
        "/api/dashboard/home/oportunidades": "crm",
        "/api/dashboard/home/contratos": "contratos",
        "/api/dashboard/home/propiedades": "propiedades",
    }

    section_items: dict[str, list[str]] = {}
    for endpoint, section_key in expected_sections.items():
        response = client.get(endpoint, headers=headers)
        assert response.status_code == 200, response.text
        body = response.json()
        assert set(body.keys()) == {"generatedAt", "section"}
        assert body["section"]["key"] == section_key
        section_items[section_key] = _item_keys(body["section"]["items"])

    assert section_items["personal"] == [
        "chats_nuevos",
        "agenda_pendiente",
        "agenda_vencida",
    ]
    assert section_items["compras"] == [
        "aprobaciones_pendientes",
        "mis_compras",
        "solicitudes_pendientes",
    ]
    assert section_items["crm"] == [
        "oportunidades_prospect",
        "oportunidades_sin_actividad",
    ]
    assert section_items["contratos"] == [
        "contratos_proximos_vencer",
        "contratos_proximos_actualizar",
    ]
    assert section_items["propiedades"] == ["vacancias_prolongadas"]


def test_home_dashboard_contract_links_apply_filters_on_contratos_list(
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
    radar = _item_map(response.json()["radar"]["items"])

    contratos_vencer_response = client.get(
        radar["contratos_proximos_vencer"]["href"],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert contratos_vencer_response.status_code == 200, contratos_vencer_response.text
    contratos_vencer = contratos_vencer_response.json()
    assert len(contratos_vencer) == 1
    assert contratos_vencer[0]["inquilino_apellido"] == "Vencer"
    assert contratos_vencer[0]["estado"] == "vigente"

    contratos_actualizar_response = client.get(
        radar["contratos_proximos_actualizar"]["href"],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert contratos_actualizar_response.status_code == 200, contratos_actualizar_response.text
    contratos_actualizar = contratos_actualizar_response.json()
    assert len(contratos_actualizar) == 1
    assert contratos_actualizar[0]["inquilino_apellido"] == "Actualizar"
    assert contratos_actualizar[0]["estado"] == "vigente"


def test_home_dashboard_oportunidades_sin_actividad_link_applies_filters(
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
    radar = _item_map(response.json()["radar"]["items"])

    oportunidades_response = client.get(
        radar["oportunidades_sin_actividad"]["href"],
        headers={"Authorization": f"Bearer {token}"},
    )

    assert oportunidades_response.status_code == 200, oportunidades_response.text
    oportunidades = oportunidades_response.json()
    assert len(oportunidades) == 2
    titulos = {oportunidad["titulo"] for oportunidad in oportunidades}
    assert titulos == {"Oportunidad sin actividad", "Oportunidad ajena sin actividad"}
    responsables = {oportunidad["responsable_id"] for oportunidad in oportunidades}
    assert me.id in responsables
    assert any(responsable_id != me.id for responsable_id in responsables)


def test_home_and_prop_dashboard_include_overdue_contract_alerts(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session)
    today = date.today()
    realizada = db_session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    assert realizada is not None

    propiedad_vencida = Propiedad(
        nombre="Propiedad con vencimiento vencido",
        propietario="Propietario vencido",
        propiedad_status_id=realizada.id,
        vencimiento_contrato=today - timedelta(days=5),
    )
    propiedad_actualizacion_vencida = Propiedad(
        nombre="Propiedad con actualizacion vencida",
        propietario="Propietario actualizacion",
        propiedad_status_id=realizada.id,
        fecha_renovacion=today - timedelta(days=10),
        vencimiento_contrato=today + timedelta(days=90),
    )
    db_session.add(propiedad_vencida)
    db_session.add(propiedad_actualizacion_vencida)
    db_session.commit()
    db_session.refresh(propiedad_vencida)
    db_session.refresh(propiedad_actualizacion_vencida)

    db_session.add(
        Contrato(
            propiedad_id=propiedad_vencida.id,
            fecha_inicio=today - timedelta(days=365),
            fecha_vencimiento=today - timedelta(days=5),
            valor_alquiler=100000,
            moneda="ARS",
            inquilino_nombre="Valeria",
            inquilino_apellido="Vencida",
            estado="vigente",
        )
    )
    db_session.add(
        Contrato(
            propiedad_id=propiedad_actualizacion_vencida.id,
            fecha_inicio=today - timedelta(days=180),
            fecha_vencimiento=today + timedelta(days=90),
            fecha_renovacion=today - timedelta(days=10),
            valor_alquiler=130000,
            moneda="ARS",
            inquilino_nombre="Ramon",
            inquilino_apellido="ActualizacionVencida",
            estado="vigente",
        )
    )
    db_session.commit()

    selectors = build_prop_selectors(db_session, pivot_date=today)

    token = create_token(me.id)
    response = client.get(
        "/api/dashboard/home/bundle",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    radar = _item_map(response.json()["radar"]["items"])
    assert radar["contratos_proximos_vencer"]["count"] == selectors["realizada"]["vencimiento_lt_60"]
    assert radar["contratos_proximos_vencer"]["count"] == 2
    assert radar["contratos_proximos_actualizar"]["count"] == selectors["realizada"]["renovacion_lt_60"]
    assert radar["contratos_proximos_actualizar"]["count"] == 2


def test_home_dashboard_contracts_proximos_actualizar_matches_propiedades_dashboard_logic(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session)
    today = date.today()
    realizada = db_session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    assert realizada is not None

    propiedad_sincronizada = Propiedad(
        nombre="Propiedad sincronizada",
        propietario="Propietario 99",
        propiedad_status_id=realizada.id,
        fecha_renovacion=today + timedelta(days=10),
        vencimiento_contrato=today + timedelta(days=40),
    )
    db_session.add(propiedad_sincronizada)
    db_session.commit()
    db_session.refresh(propiedad_sincronizada)

    db_session.add(
        Contrato(
            propiedad_id=propiedad_sincronizada.id,
            fecha_inicio=today - timedelta(days=90),
            fecha_vencimiento=today + timedelta(days=40),
            fecha_renovacion=today + timedelta(days=10),
            valor_alquiler=125000,
            moneda="ARS",
            inquilino_nombre="Sofia",
            inquilino_apellido="Sincronizada",
            estado="vigente",
        )
    )
    db_session.commit()

    selectors = build_prop_selectors(db_session, pivot_date=today)
    expected_count = selectors["realizada"]["renovacion_lt_60"]

    token = create_token(me.id)
    response = client.get(
        "/api/dashboard/home/bundle",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    radar = _item_map(response.json()["radar"]["items"])
    assert radar["contratos_proximos_actualizar"]["count"] == expected_count
    assert expected_count == 2


def test_home_dashboard_bundle_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/dashboard/home/bundle")

    assert response.status_code == 401


def test_home_dashboard_bundle_shows_global_aprobaciones_for_non_direccion_users(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session, departamento_nombre="Ventas")
    solicitada_status_id = _get_order_status_id(db_session, "solicitada")
    emitida_status_id = _get_order_status_id(db_session, "emitida")
    aprobada_status_id = _get_order_status_id(db_session, "aprobada")
    token = create_token(me.id)

    response = client.get(
        "/api/dashboard/home/bundle",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()

    mi_dia = _item_map(body["miDia"]["items"])
    radar = _item_map(body["radar"]["items"])
    assert body["miDia"]["total"] == 6
    assert "aprobaciones_pendientes" not in mi_dia
    assert "solicitudes_pendientes" not in mi_dia
    assert mi_dia["mis_compras"]["count"] == 3
    assert _extract_filter_from_href(mi_dia["mis_compras"]["href"]) == {
        "solicitante_id": me.id,
        "order_status_id__in": [solicitada_status_id, emitida_status_id, aprobada_status_id],
    }
    assert radar["aprobaciones_pendientes"]["count"] == 1
    assert radar["aprobaciones_pendientes"]["scope"] == "global"
    assert radar["aprobaciones_pendientes"]["href"] == "/po-orders-approval"
    assert radar["aprobaciones_pendientes"]["meta"]["ordenes_compra_emitidas"] == 1
    assert "facturas_confirmadas" not in radar["aprobaciones_pendientes"]["meta"]
    assert radar["solicitudes_pendientes"]["count"] == 2
    assert radar["solicitudes_pendientes"]["scope"] == "global"
    assert _extract_filter_from_href(radar["solicitudes_pendientes"]["href"]) == {
        "order_status_id": solicitada_status_id,
    }


def test_home_dashboard_bundle_shows_all_solicitudes_for_compras_users(
    client: TestClient,
    db_session: Session,
) -> None:
    me = _seed_home_dashboard_data(db_session, departamento_nombre="Compras")
    solicitada_status_id = _get_order_status_id(db_session, "solicitada")
    token = create_token(me.id)

    response = client.get(
        "/api/dashboard/home/bundle",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()

    mi_dia = _item_map(body["miDia"]["items"])
    radar = _item_map(body["radar"]["items"])
    assert body["miDia"]["total"] == 6
    assert mi_dia["mis_compras"]["count"] == 3
    assert "solicitudes_pendientes" not in mi_dia
    assert radar["solicitudes_pendientes"]["count"] == 2
    assert radar["solicitudes_pendientes"]["scope"] == "global"
    assert _extract_filter_from_href(radar["solicitudes_pendientes"]["href"]) == {
        "order_status_id": solicitada_status_id,
    }


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

    assert set(body.keys()) == {"generatedAt", "miDia"}
    assert body["miDia"]["total"] == 6
    assert "radar" not in body
