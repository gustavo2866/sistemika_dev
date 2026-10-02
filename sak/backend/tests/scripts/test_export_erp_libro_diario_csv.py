from decimal import Decimal

import pytest

from scripts.export_erp_libro_diario_csv import enrich_cash_fields


def _row(
    *,
    asiento: str,
    cuenta: int,
    rubro: str,
    cuenta_nombre: str | None = None,
    debe: str = "0",
    haber: str = "0",
) -> dict:
    return {
        "empresa_id": 1,
        "fecha": "2026-08-01",
        "tipo_asiento": "A",
        "nro_asiento": asiento,
        "cuenta_codigo": cuenta,
        "cuenta_nombre": cuenta_nombre,
        "rubro": rubro,
        "debe": Decimal(debe),
        "haber": Decimal(haber),
    }


def test_enrich_cash_fields_propaga_cash_y_asigna_cuenta_contrapartida():
    ingreso = _row(
        asiento="1",
        cuenta=4100,
        rubro="INGRESOS",
        haber="-100",
    )
    caja_debe = _row(
        asiento="1",
        cuenta=1,
        rubro="01- DISPONIBILIDADES",
        cuenta_nombre="Caja",
        debe="100",
    )
    egreso = _row(
        asiento="2",
        cuenta=5100,
        rubro="GASTOS",
        debe="50",
    )
    banco_haber = _row(
        asiento="2",
        cuenta=2,
        rubro="01-DISPONIBILIDADES",
        cuenta_nombre="Banco",
        haber="-50",
    )
    sin_cash = _row(
        asiento="3",
        cuenta=1200,
        rubro="CREDITOS",
        debe="25",
    )

    rows = enrich_cash_fields([ingreso, caja_debe, egreso, banco_haber, sin_cash])

    assert [row["cash"] for row in rows] == ["SI", "SI", "SI", "SI", "NO"]
    assert ingreso["cuenta_cash_id"] == 1
    assert ingreso["cuenta_cash_nombre"] == "Caja"
    assert caja_debe["cuenta_cash_id"] is None
    assert caja_debe["cuenta_cash_nombre"] is None
    assert egreso["cuenta_cash_id"] == 2
    assert egreso["cuenta_cash_nombre"] == "Banco"
    assert banco_haber["cuenta_cash_id"] is None
    assert banco_haber["cuenta_cash_nombre"] is None
    assert sin_cash["cuenta_cash_id"] is None
    assert sin_cash["cuenta_cash_nombre"] is None


def test_enrich_cash_fields_rechaza_multiples_cuentas_cash_en_el_mismo_lado():
    rows = [
        _row(
            asiento="1",
            cuenta=1,
            rubro="01-DISPONIBILIDADES",
            debe="60",
        ),
        _row(
            asiento="1",
            cuenta=2,
            rubro="01-DISPONIBILIDADES",
            debe="40",
        ),
    ]

    with pytest.raises(ValueError, match="mÃ¡s de una cuenta"):
        enrich_cash_fields(rows)
