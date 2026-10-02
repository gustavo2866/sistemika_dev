from decimal import Decimal

from app.models.erp.libro_mayor import build_libro_mayor_saldos_response


def test_build_libro_mayor_saldos_response_detalla_cuentas_y_totaliza():
    rows = [
        {
            "empresa_id": 1,
            "cuenta_codigo": 100,
            "cuenta_nombre": "Caja",
            "rubro": "01- DISPONIBILIDADES",
            "saldo_inicial": Decimal("1000.25"),
            "saldo_periodo": Decimal("250.50"),
            "saldo_final": Decimal("1250.75"),
        },
        {
            "empresa_id": 2,
            "cuenta_codigo": 101,
            "cuenta_nombre": "Banco",
            "rubro": "01- DISPONIBILIDADES",
            "saldo_inicial": Decimal("500"),
            "saldo_periodo": Decimal("-100"),
            "saldo_final": Decimal("400"),
        },
    ]

    response = build_libro_mayor_saldos_response(
        rows,
        periodo="2026-08",
        rubro="01-DISP",
    )

    assert response["periodo"] == "2026-08"
    assert response["rubros_encontrados"] == ["01- DISPONIBILIDADES"]
    assert len(response["cuentas"]) == 2
    assert response["cuentas"][0]["saldo_inicial"] == 1000.25
    assert response["totales"] == {
        "saldo_inicial": 1500.25,
        "saldo_periodo": 150.5,
        "saldo_final": 1650.75,
    }
