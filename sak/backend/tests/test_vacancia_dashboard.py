from datetime import date

from app.models.vacancia import Vacancia
from app.services.vacancia_dashboard import _calculate_for_vacancia, build_dashboard_payload, CalculatedVacancia


def test_calculate_in_range_closed_cycle():
    start = date(2024, 1, 1)
    end = date(2024, 1, 31)
    v = Vacancia(
        propiedad_id=1,
        fecha_recibida=date(2024, 1, 5),
        fecha_alquilada=date(2024, 1, 20),
    )

    calc = _calculate_for_vacancia(v, start=start, end=end, today=end)
    assert calc is not None
    assert calc.dias_totales == 15
    assert calc.estado_corte == "Alquilada"


def test_calculate_historic_bucket_and_cut():
    start = date(2024, 3, 1)
    end = date(2024, 3, 31)
    v = Vacancia(
        propiedad_id=1,
        fecha_recibida=date(2024, 2, 15),
    )

    calc = _calculate_for_vacancia(v, start=start, end=end, today=end)
    assert calc is not None
    assert calc.bucket == "Historico"
    # corte al fin de rango (no hoy mayor)
    assert calc.dias_totales == (end - start).days


def test_build_dashboard_payload_consistency():
    start = "2024-01-01"
    end = "2024-01-31"
    items = [
        CalculatedVacancia(
            vacancia=Vacancia(id=1, propiedad_id=1),
            dias_totales=10,
            dias_reparacion=3,
            dias_disponible=5,
            estado_corte="Alquilada",
            bucket="2024-01",
        ),
        CalculatedVacancia(
            vacancia=Vacancia(id=2, propiedad_id=1),
            dias_totales=5,
            dias_reparacion=2,
            dias_disponible=3,
            estado_corte="Retirada",
            bucket="Historico",
        ),
    ]

    payload = build_dashboard_payload(items, start, end, limit_top=2)
    assert payload["kpis"]["totalVacancias"] == 2
    assert payload["kpis"]["promedioDiasTotales"] == 7.5
    assert payload["estados_finales"]["alquilada"] == 1
    assert payload["estados_finales"]["retirada"] == 1
    buckets = {b["bucket"]: b for b in payload["buckets"]}
    assert "Historico" in buckets
    assert "2024-01" in buckets
