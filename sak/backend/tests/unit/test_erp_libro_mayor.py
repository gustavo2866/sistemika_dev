from decimal import Decimal

from app.models.erp.libro_mayor import build_libro_mayor_saldos_response, get_libro_mayor_saldos
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_map import ErpCashMap
from app.routers import erp_libro_mayor_router


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
        account_codes={100, 101},
    )

    assert response["periodo"] == "2026-08"
    assert response["cuentas_fondo"] == [100, 101]
    assert response["rubros_encontrados"] == ["01- DISPONIBILIDADES"]
    assert len(response["cuentas"]) == 2
    assert response["cuentas"][0]["saldo_inicial"] == 1000.25
    assert response["totales"] == {
        "saldo_inicial": 1500.25,
        "saldo_periodo": 150.5,
        "saldo_final": 1650.75,
    }


def test_get_libro_mayor_saldos_sin_mapeos_fondo_no_consulta_origen():
    response = get_libro_mayor_saldos("2026-08", set())

    assert response["cuentas_fondo"] == []
    assert response["cuentas"] == []
    assert response["totales"] == {
        "saldo_inicial": 0.0,
        "saldo_periodo": 0.0,
        "saldo_final": 0.0,
    }


def test_endpoint_saldos_usa_cuentas_mapeadas_como_fondo(db_session, monkeypatch):
    fondo = ErpCashCuenta(descripcion="FONDO BANCOS")
    ingreso = ErpCashCuenta(descripcion="INGR COBROS")
    db_session.add_all([fondo, ingreso])
    db_session.flush()
    db_session.add_all(
        [
            ErpCashMap(
                nro_cta=100,
                moneda="ARS",
                map_debe_id=fondo.id,
                map_haber_id=fondo.id,
            ),
            ErpCashMap(
                nro_cta=200,
                moneda="ARS",
                map_debe_id=ingreso.id,
                map_haber_id=ingreso.id,
            ),
        ]
    )
    db_session.commit()
    captured = {}

    def fake_get_saldos(periodo, account_codes):
        captured["periodo"] = periodo
        captured["account_codes"] = account_codes
        return {"ok": True}

    monkeypatch.setattr(erp_libro_mayor_router, "get_libro_mayor_saldos", fake_get_saldos)

    response = erp_libro_mayor_router.get_erp_libro_mayor_saldos("2026-08", db_session)

    assert response == {"ok": True}
    assert captured == {"periodo": "2026-08", "account_codes": {100}}
