from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from scripts.generate_erp_cash_proyectado import build_generation, project_account_values


def test_project_account_values_repite_mes_homologo_y_promedia_faltantes():
    baseline = (date(2026, 1, 1), date(2026, 2, 1))
    targets = (
        date(2026, 1, 1),
        date(2026, 2, 1),
        date(2026, 3, 1),
        date(2027, 1, 1),
    )

    values = project_account_values(
        {
            date(2026, 1, 1): Decimal("100"),
            date(2026, 2, 1): Decimal("300"),
        },
        baseline,
        targets,
    )

    assert values == {
        date(2026, 1, 1): Decimal("100.00"),
        date(2026, 2, 1): Decimal("300.00"),
        date(2026, 3, 1): Decimal("200.00"),
        date(2027, 1, 1): Decimal("100.00"),
    }


def test_build_generation_crea_un_registro_por_cuenta_y_periodo():
    rows = [
        SimpleNamespace(
            cuenta_cash_id=20,
            cuenta_nombre="INGRESOS",
            periodo_anio=2026,
            periodo_mes=1,
            importe=Decimal("100"),
        ),
        SimpleNamespace(
            cuenta_cash_id=20,
            cuenta_nombre="INGRESOS",
            periodo_anio=2026,
            periodo_mes=2,
            importe=Decimal("300"),
        ),
        SimpleNamespace(
            cuenta_cash_id=1,
            cuenta_nombre="EGRESOS",
            periodo_anio=2026,
            periodo_mes=1,
            importe=Decimal("-50"),
        ),
    ]

    generation = build_generation(rows, start=date(2026, 1, 1), months=3)

    assert generation.baseline_months == (date(2026, 1, 1), date(2026, 2, 1))
    assert len(generation.seeds) == 6
    ingresos = [seed for seed in generation.seeds if seed.cuenta_cash_id == 20]
    egresos = [seed for seed in generation.seeds if seed.cuenta_cash_id == 1]
    assert [seed.importe for seed in ingresos] == [
        Decimal("100.00"),
        Decimal("300.00"),
        Decimal("200.00"),
    ]
    assert [seed.importe for seed in egresos] == [
        Decimal("-50.00"),
        Decimal("0.00"),
        Decimal("-25.00"),
    ]
