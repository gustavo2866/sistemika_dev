from datetime import date
from decimal import Decimal

from app.models.erp.presupuesto import ErpPresupuesto
from app.routers.erp_presupuesto_router import (
    EXPECTED_PRESUPUESTO_IMPORT_HEADERS,
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


def test_erp_presupuesto_export_import_headers_include_real_ingresos():
    assert EXPECTED_PRESUPUESTO_IMPORT_HEADERS == [
        "centro costo",
        "periodo",
        "rubro",
        "cuenta",
        "empleados",
        "egresos",
        "ingresos",
        "real_ingresos",
    ]
