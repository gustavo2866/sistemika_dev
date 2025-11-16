from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia


class FakeResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class FakeSession:
    def __init__(self, items):
        self._items = items

    def exec(self, _query):
        return FakeResult(self._items)


@pytest.fixture(autouse=True)
def override_session():
    # Datos de prueba con distintos escenarios
    prop = Propiedad(
        id=1,
        nombre="P1",
        tipo="Depto",
        propietario="Juan",
        estado="2-en_reparacion",
        estado_fecha=datetime.utcnow(),
    )

    vacancias = [
        Vacancia(
            id=1,
            propiedad_id=1,
            propiedad=prop,
            fecha_recibida=datetime(2024, 1, 5),
            fecha_en_reparacion=datetime(2024, 1, 6),
            fecha_disponible=datetime(2024, 1, 10),
            fecha_alquilada=datetime(2024, 1, 20),
        ),
        Vacancia(
            id=2,
            propiedad_id=1,
            propiedad=prop,
            fecha_recibida=datetime(2023, 12, 15),
            fecha_en_reparacion=datetime(2023, 12, 16),
            fecha_disponible=datetime(2023, 12, 20),
            fecha_retirada=datetime(2024, 1, 8),
        ),
    ]

    fake = FakeSession(vacancias)
    app.dependency_overrides[get_session] = lambda: fake
    yield
    app.dependency_overrides.pop(get_session, None)


def test_dashboard_endpoint_summary_and_top():
    client = TestClient(app)
    resp = client.get(
        "/api/dashboard/vacancias",
        params={"startDate": "2024-01-01", "endDate": "2024-01-31", "includeItems": "true"},
    )
    assert resp.status_code == 200
    data = resp.json()

    # KPIs consistentes con los dos ciclos en rango
    assert data["kpis"]["totalVacancias"] == 2
    buckets = {b["bucket"]: b for b in data["buckets"]}
    assert "Historico" in buckets  # vacancia que empezó antes del rango
    assert any(top["vacancia"]["id"] == 1 for top in data["top"])
    assert "items" in data and len(data["items"]) == 2


def test_dashboard_detalle_pagination_and_order():
    client = TestClient(app)
    resp = client.get(
        "/api/dashboard/vacancias/detalle",
        params={
            "startDate": "2024-01-01",
            "endDate": "2024-01-31",
            "page": 1,
            "perPage": 1,
            "orderBy": "dias_totales",
            "orderDir": "desc",
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total"] == 2
    assert len(payload["data"]) == 1
    # primer elemento debe ser el de mayor dias_totales
    assert payload["data"][0]["vacancia"]["id"] in {1, 2}

