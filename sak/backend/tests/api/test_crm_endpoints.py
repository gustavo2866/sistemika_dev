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
