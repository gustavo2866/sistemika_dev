from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.models.erp.cash_diario_panel import build_cash_diario_panel, build_week_ranges


def _row(
    *,
    row_id: int,
    fecha: date,
    rubro: str,
    debe: str = "0",
    haber: str = "0",
    cuenta_cash_id: int | None = 1,
):
    return SimpleNamespace(
        id=row_id,
        empresa_id=1,
        fecha=fecha,
        tipo_asiento="A",
        nro_asiento="10",
        cuenta_codigo=4100,
        tipo_subcuenta="2",
        nro_subcuenta="15",
        debe=Decimal(debe),
        haber=Decimal(haber),
        descripcion="Movimiento",
        rubro=rubro,
        cuenta_cash_id=cuenta_cash_id,
    )


def test_cash_diario_panel_agrupa_por_semana_y_excluye_disponibilidades():
    rows = [
        (_row(row_id=1, fecha=date(2026, 8, 3), rubro="03-INGRESOS", haber="-100"), "Ingresos"),
        (_row(row_id=2, fecha=date(2026, 8, 10), rubro="04-GASTOS", debe="40"), "Ingresos"),
        (_row(row_id=3, fecha=date(2026, 8, 10), rubro="01 - DISPONIBILIDADES", debe="60"), "Ingresos"),
        (_row(row_id=4, fecha=date(2026, 8, 31), rubro="04-GASTOS", debe="10"), "Ingresos"),
        (_row(row_id=5, fecha=date(2026, 8, 20), rubro="03-INGRESOS", haber="-25", cuenta_cash_id=None), None),
    ]

    panel = build_cash_diario_panel(rows, anio=2026, mes=8)

    assert len(panel["weeks"]) == 4
    assert [group["label"] for group in panel["groups"]] == ["INGRESOS", "EGRESOS", "SIN CUENTA"]

    ingresos, egresos, sin_cuenta = panel["groups"]
    assert ingresos["total"] == 100.0
    assert ingresos["accounts"][0]["movements"][0]["week_key"] == "2026-08-01"
    assert egresos["total"] == -50.0
    assert [movement["id"] for movement in egresos["accounts"][0]["movements"]] == [2, 4]
    assert sin_cuenta["total"] == 25.0
    assert sin_cuenta["accounts"][0]["cuenta_cash_nombre"] == "Sin cuenta Cash"
    assert panel["total"] == 75.0


def test_week_ranges_siempre_genera_cuatro_columnas():
    weeks = build_week_ranges(2028, 2)

    assert [week["label"] for week in weeks] == ["01-07", "08-14", "15-21", "22-29"]
