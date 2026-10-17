from datetime import date
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import UploadFile
from openpyxl import Workbook

from app.models.erp.presupuesto import ErpPresupuesto
from app.routers.erp_presupuesto_router import (
    EXPECTED_PRESUPUESTO_IMPORT_HEADERS,
    HONORARIOS_PROYECTO_CUENTA,
    distribute_presupuesto_conceptos_to_erp_rows,
    distribute_presupuesto_ingresos_to_erp_rows,
    erp_presupuesto_router,
    get_erp_presupuesto_panel,
    import_erp_presupuesto_panel_project,
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


@pytest.mark.parametrize(
    "incluir_honorarios",
    [True, False],
)
def test_erp_presupuesto_panel_can_toggle_honorarios_account(
    incluir_honorarios,
):
    session = MagicMock()
    session.exec.return_value.all.return_value = []

    result = get_erp_presupuesto_panel(
        fecha_desde=date(2026, 9, 1),
        fecha_hasta=date(2026, 9, 30),
        estado="all",
        proyecto_id=None,
        incluir_honorarios=incluir_honorarios,
        session=session,
    )

    statement = session.exec.call_args.args[0]
    assert "erp_cuentas.cod_cuenta !=" not in str(statement)
    assert HONORARIOS_PROYECTO_CUENTA not in statement.compile().params.values()
    assert result["incluir_honorarios"] is incluir_honorarios
    assert result["rows"] == []


def test_erp_presupuesto_panel_excludes_gestion_and_keeps_its_income_adjustment():
    session = MagicMock()
    common = {
        "proyecto_id": 1,
        "proyecto_nombre": "Proyecto de prueba",
        "year": 2026,
        "month": 9,
        "ingresos": Decimal("0"),
        "egresos": Decimal("0"),
        "real_egresos": Decimal("0"),
        "empleados": Decimal("0"),
        "presupuesto_id": 1,
        "record_count": 1,
    }
    session.exec.return_value.all.return_value = [
        SimpleNamespace(
            **common,
            rubro_id=10,
            rubro_nombre="Trab Prelim",
            cuenta_id=100,
            cuenta_codigo=HONORARIOS_PROYECTO_CUENTA,
            cuenta_nombre="Gestion",
            cuenta_orden=1,
            real_ingresos=Decimal("20000000"),
        ),
        SimpleNamespace(
            **common,
            rubro_id=20,
            rubro_nombre="Ingresos",
            cuenta_id=200,
            cuenta_codigo="4.01.01.001",
            cuenta_nombre="Ingresos contables",
            cuenta_orden=2,
            real_ingresos=Decimal("272296531"),
        ),
    ]

    result = get_erp_presupuesto_panel(
        fecha_desde=date(2026, 9, 1),
        fecha_hasta=date(2026, 9, 30),
        estado="all",
        proyecto_id=None,
        incluir_honorarios=False,
        session=session,
    )

    project = result["rows"][0]
    assert project["gestion_real_ingresos"]["2026-09"] == 20000000.0
    assert [rubro["rubro_nombre"] for rubro in project["rubros"]] == ["Ingresos"]


def _presupuesto_import_file(
    *,
    empleados=0,
    egresos=0,
    ingresos=0,
    real_ingresos=0,
    real_egresos=0,
):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(EXPECTED_PRESUPUESTO_IMPORT_HEADERS)
    sheet.append(
        [
            "123 - Proyecto de prueba",
            "2026-09",
            "1 - Rubro",
            "5.01 - Cuenta de prueba",
            empleados,
            egresos,
            ingresos,
            real_ingresos,
            real_egresos,
        ]
    )
    content = BytesIO()
    workbook.save(content)
    content.seek(0)
    return UploadFile(filename="presupuesto.xlsx", file=content)


def _presupuesto_import_session():
    session = MagicMock()
    session.get.return_value = SimpleNamespace(
        id=1,
        nombre="Proyecto de prueba",
        centro_costo=123,
        deleted_at=None,
    )
    session.exec.return_value.all.return_value = [
        SimpleNamespace(id=10, cod_cuenta="5.01")
    ]
    return session


@pytest.mark.asyncio
async def test_erp_presupuesto_import_validation_allows_negative_real_values():
    result = await import_erp_presupuesto_panel_project(
        periodo="2026-09",
        proyecto_id=1,
        process=False,
        file=_presupuesto_import_file(real_ingresos=-1250.50, real_egresos=-375.25),
        session=_presupuesto_import_session(),
    )

    assert result["valid"] is True
    assert result["errors"] == []
    assert result["rows_budgeted"] == 1
    assert result["processed"] is False


@pytest.mark.asyncio
async def test_erp_presupuesto_import_validation_still_rejects_negative_budget_values():
    result = await import_erp_presupuesto_panel_project(
        periodo="2026-09",
        proyecto_id=1,
        process=False,
        file=_presupuesto_import_file(egresos=-1),
        session=_presupuesto_import_session(),
    )

    assert result["valid"] is False
    assert result["errors"] == [
        "Fila 2: empleados, egresos e ingresos no pueden ser negativos."
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
