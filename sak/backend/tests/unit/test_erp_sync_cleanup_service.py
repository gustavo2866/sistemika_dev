from datetime import date, datetime, timezone
from decimal import Decimal

from sqlmodel import select

from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.erp.rubro import ErpRubro
from app.services.erp_sync_cleanup_service import cleanup_future_erp_actuals


def _diario(source_id: int, year: int, month: int) -> ErpLibroDiario:
    return ErpLibroDiario(
        source_id=source_id,
        empresa_id=1,
        fecha=date(year, month, 1),
        periodo_anio=year,
        periodo_mes=month,
        cuenta_codigo=5001,
    )


def _mayor(source_id: int, year: int, month: int) -> ErpLibroMayor:
    return ErpLibroMayor(
        source_id=source_id,
        empresa_id=1,
        periodo_anio=year,
        periodo_mes=month,
        nivel="cuenta",
        cuenta_codigo=5001,
        recalculado_en=datetime(year, month, 1, tzinfo=timezone.utc),
    )


def test_cleanup_removes_only_months_after_first_open_and_preserves_budget(db_session):
    income_category = ErpRubro(nombre="Ingresos")
    cost_category = ErpRubro(nombre="Costos")
    db_session.add_all([income_category, cost_category])
    db_session.flush()
    income_account = ErpCuenta(
        rubro_id=income_category.id,
        nro_cuenta=4001,
        cod_cuenta="4.001",
        descripcion="Ingresos de obra",
    )
    cost_account = ErpCuenta(
        rubro_id=cost_category.id,
        nro_cuenta=5001,
        cod_cuenta="5.001",
        descripcion="Costo de obra",
    )
    db_session.add_all([income_account, cost_account])
    db_session.flush()
    db_session.add_all(
        [
            ErpCashPeriodo(fecha_periodo=date(2026, 8, 1), estado="CERRADO"),
            ErpCashPeriodo(fecha_periodo=date(2026, 9, 1), estado="ABIERTO"),
            _diario(1, 2026, 9),
            _diario(2, 2026, 10),
            _mayor(1, 2026, 9),
            _mayor(2, 2026, 10),
            ErpPresupuesto(
                fecha=date(2026, 10, 1),
                proyecto_id=1,
                erp_cuenta_id=income_account.id,
                ingres=Decimal("250"),
                real_ingreso=Decimal("100"),
                real_egreso=Decimal("20"),
            ),
            ErpPresupuesto(
                fecha=date(2026, 10, 1),
                proyecto_id=1,
                erp_cuenta_id=cost_account.id,
                real_ingreso=Decimal("75"),
                real_egreso=Decimal("30"),
            ),
        ]
    )
    db_session.commit()

    result = cleanup_future_erp_actuals(db_session, apply_changes=True)

    diarios = db_session.exec(select(ErpLibroDiario).order_by(ErpLibroDiario.source_id)).all()
    mayores = db_session.exec(select(ErpLibroMayor).order_by(ErpLibroMayor.source_id)).all()
    budgets = db_session.exec(select(ErpPresupuesto).order_by(ErpPresupuesto.erp_cuenta_id)).all()

    assert result["periodo_corte"] == "2026-09"
    assert [row.source_id for row in diarios] == [1]
    assert [row.source_id for row in mayores] == [1]
    assert len(budgets) == 2
    income_budget = next(row for row in budgets if row.erp_cuenta_id == income_account.id)
    cost_budget = next(row for row in budgets if row.erp_cuenta_id == cost_account.id)
    assert income_budget.ingres == Decimal("250.00")
    assert income_budget.real_ingreso == Decimal("0.00")
    assert income_budget.real_egreso == Decimal("0.00")
    assert cost_budget.real_ingreso == Decimal("75.00")
    assert cost_budget.real_egreso == Decimal("0.00")


def test_cleanup_dry_run_does_not_change_rows(db_session):
    db_session.add(ErpCashPeriodo(fecha_periodo=date(2026, 9, 1), estado="ABIERTO"))
    db_session.add(_diario(1, 2026, 10))
    db_session.commit()

    result = cleanup_future_erp_actuals(db_session, apply_changes=False)

    assert result["libro_diario_deleted"] == 1
    assert db_session.exec(select(ErpLibroDiario)).one().source_id == 1
