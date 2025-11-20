import pytest
from sqlmodel import Session

from app.models import User, Propiedad


@pytest.fixture
def crm_base(db_session: Session):
    """Crear usuario y propiedad base para las pruebas CRM."""
    user = User(nombre="CRM Tester", email="crm_tester@example.com")
    propiedad = Propiedad(
        nombre="Propiedad CRM",
        tipo="Departamento",
        propietario="Tester",
        estado="3-disponible",
    )
    db_session.add(user)
    db_session.add(propiedad)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(propiedad)
    return {"user_id": user.id, "propiedad_id": propiedad.id}


def _post(client, url, payload):
    response = client.post(url, json=payload)
    assert response.status_code in (200, 201)
    return response.json()


def test_crm_contacto_busqueda(client, crm_base):
    # Crear catálogos mínimos
    _post(
        client,
        "/crm/catalogos/tipos-operacion",
        {"codigo": "alquiler", "nombre": "Alquiler", "activo": True},
    )
    _post(
        client,
        "/crm/catalogos/origenes-lead",
        {"codigo": "online", "nombre": "Online"},
    )

    contacto = _post(
        client,
        "/crm/contactos",
        {
            "nombre_completo": "Juan CRM",
            "telefonos": ["+541100000001"],
            "email": "juan.crm@example.com",
            "origen_lead_id": 1,
            "responsable_id": crm_base["user_id"],
        },
    )

    resp = client.post("/crm/contactos/buscar", json={"email": contacto["email"]})
    assert resp.status_code == 200
    assert resp.json()["email"] == "juan.crm@example.com"


def test_crm_oportunidad_cambio_estado_y_logs(client, crm_base):
    # Catálogos básicos
    tipo = _post(
        client,
        "/crm/catalogos/tipos-operacion",
        {"codigo": "venta", "nombre": "Venta"},
    )
    _post(
        client,
        "/crm/catalogos/motivos-perdida",
        {"codigo": "precio", "nombre": "Precio"},
    )
    condicion = _post(
        client,
        "/crm/catalogos/condiciones-pago",
        {"codigo": "contado", "nombre": "Contado"},
    )
    moneda = _post(
        client,
        "/crm/catalogos/monedas",
        {"codigo": "USD", "nombre": "Dólar", "simbolo": "U$", "es_moneda_base": False},
    )
    _post(
        client,
        "/crm/catalogos/origenes-lead",
        {"codigo": "referidos", "nombre": "Referidos"},
    )

    contacto = _post(
        client,
        "/crm/contactos",
        {
            "nombre_completo": "María CRM",
            "telefonos": ["+541199999999"],
            "email": "maria.crm@example.com",
            "origen_lead_id": 1,
            "responsable_id": crm_base["user_id"],
        },
    )

    oportunidad = _post(
        client,
        "/crm/oportunidades",
        {
            "contacto_id": contacto["id"],
            "tipo_operacion_id": tipo["id"],
            "propiedad_id": crm_base["propiedad_id"],
            "estado": "1-abierta",
            "fecha_estado": "2025-11-20T10:00:00",
            "responsable_id": crm_base["user_id"],
            "descripcion_estado": "Consulta inicial",
        },
    )

    # Pasar por estado intermedio permitido
    resp = client.post(
        f"/crm/oportunidades/{oportunidad['id']}/cambiar-estado",
        json={
            "nuevo_estado": "3-cotiza",
            "descripcion": "En cotización",
            "usuario_id": crm_base["user_id"],
        },
    )
    assert resp.status_code == 200

    resp = client.post(
        f"/crm/oportunidades/{oportunidad['id']}/cambiar-estado",
        json={
            "nuevo_estado": "5-ganada",
            "descripcion": "Operación cerrada",
            "usuario_id": crm_base["user_id"],
            "monto": 250000,
            "moneda_id": moneda["id"],
            "condicion_pago_id": condicion["id"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["estado"] == "5-ganada"

    # Logs
    resp_logs = client.get(f"/crm/oportunidades/{oportunidad['id']}/logs")
    assert resp_logs.status_code == 200
    assert len(resp_logs.json()) >= 1


def test_cotizacion_convertir_endpoint(client):
    usd = _post(
        client,
        "/crm/catalogos/monedas",
        {"codigo": "USD", "nombre": "Dólar", "simbolo": "U$", "es_moneda_base": False},
    )
    ars = _post(
        client,
        "/crm/catalogos/monedas",
        {"codigo": "ARS", "nombre": "Peso", "simbolo": "$", "es_moneda_base": True},
    )
    _post(
        client,
        "/crm/cotizaciones",
        {
            "moneda_origen_id": usd["id"],
            "moneda_destino_id": ars["id"],
            "tipo_cambio": 900,
            "fecha_vigencia": "2025-11-19",
        },
    )

    resp = client.get(
        "/crm/cotizaciones/convertir",
        params={
            "monto": 100,
            "moneda_origen": "USD",
            "moneda_destino": "ARS",
            "fecha": "2025-11-20",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["monto_convertido"] == 90000.0
