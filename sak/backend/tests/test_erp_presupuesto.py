from datetime import date
from decimal import Decimal

from app.models.erp.presupuesto import ErpPresupuesto
from app.routers.erp_presupuesto_router import (
    EXPECTED_PRESUPUESTO_IMPORT_HEADERS,
    distribute_presupuesto_conceptos_to_erp_rows,
    distribute_presupuesto_ingresos_to_erp_rows,
    erp_presupuesto_router,
)


def test_erp_presupuesto_model_and_router_registration():
    presupuesto = ErpPresupuesto(
        fecha=date.today(),
        proyecto_id=1,
        erp_cuenta_id=2,
        egreso=Decimal("100.50"),
        ingres=Decimal("200.25"),
        obreros_cantidad=Decimal("5"),
        obreros_costo=Decimal("300.00"),
    )

    assert presupuesto.proyecto_id == 1
    assert presupuesto.erp_cuenta_id == 2
    assert presupuesto.egreso == Decimal("100.50")
    assert presupuesto.ingres == Decimal("200.25")
    assert presupuesto.obreros_cantidad == Decimal("5")

    routes = [route.path for route in erp_presupuesto_router.routes]
    assert "/erp/presupuestos" in routes
    assert "/erp/presupuestos/panel" in routes
    assert "/erp/presupuestos/panel/copy" in routes
    assert "/erp/presupuestos/panel/clear" in routes
    assert "/erp/presupuestos/panel/real-income" in routes


def test_erp_presupuesto_export_import_headers_include_real_values():
    assert EXPECTED_PRESUPUESTO_IMPORT_HEADERS == [
        "centro costo",
        "periodo",
        "rubro",
        "cuenta",
        "empleados",
        "egresos",
        "ingresos",
        "real_ingresos",
        "real_egresos",
    ]


def test_distribute_presupuesto_conceptos_to_erp_rows_uses_real_egreso_weights():
    rows = [
        {"erp_cuenta_id": 1, "concepto_id": 10, "real_egreso": Decimal("100")},
        {"erp_cuenta_id": 2, "concepto_id": 10, "real_egreso": Decimal("300")},
        {"erp_cuenta_id": 3, "concepto_id": 20, "real_egreso": Decimal("200")},
    ]

    result = distribute_presupuesto_conceptos_to_erp_rows(
        rows=rows,
        concepto_montos={10: Decimal("1200"), 20: Decimal("400")},
    )

    assert result == [
        {"erp_cuenta_id": 1, "concepto_id": 10, "real_egreso": Decimal("100"), "monto_distribuido": Decimal("300")},
        {"erp_cuenta_id": 2, "concepto_id": 10, "real_egreso": Decimal("300"), "monto_distribuido": Decimal("900")},
        {"erp_cuenta_id": 3, "concepto_id": 20, "real_egreso": Decimal("200"), "monto_distribuido": Decimal("400")},
    ]


def test_distribute_presupuesto_ingresos_to_erp_rows_uses_egreso_weights():
    rows = [
        {"erp_cuenta_id": 1, "egreso": Decimal("100"), "ingres": Decimal("0")},
        {"erp_cuenta_id": 2, "egreso": Decimal("300"), "ingres": Decimal("0")},
        {"erp_cuenta_id": 3, "egreso": Decimal("0"), "ingres": Decimal("0")},
    ]

    result = distribute_presupuesto_ingresos_to_erp_rows(
        rows=rows,
        monto_total=Decimal("400"),
    )

    assert result == [
        {"erp_cuenta_id": 1, "egreso": Decimal("100"), "ingres": Decimal("0"), "monto_distribuido": Decimal("100")},
        {"erp_cuenta_id": 2, "egreso": Decimal("300"), "ingres": Decimal("0"), "monto_distribuido": Decimal("300")},
    ]
