from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import case, delete, extract, func, or_, update
from sqlmodel import Session, select

from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.libro_mayor import ErpLibroMayor
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.erp.rubro import ErpRubro


ZERO = Decimal("0")


def get_first_open_period(session: Session) -> date:
    period = session.exec(
        select(ErpCashPeriodo.fecha_periodo)
        .where(
            ErpCashPeriodo.estado == "ABIERTO",
            ErpCashPeriodo.deleted_at.is_(None),
        )
        .order_by(ErpCashPeriodo.fecha_periodo)
        .limit(1)
    ).first()
    if period is None:
        raise ValueError("No existe un período abierto en erp_cash_periodos")
    return date(period.year, period.month, 1)


def _closed_month_filter(year, month):
    return select(ErpCashPeriodo.id).where(
        ErpCashPeriodo.deleted_at.is_(None), ErpCashPeriodo.estado == "CERRADO",
        extract("year", ErpCashPeriodo.fecha_periodo) == year,
        extract("month", ErpCashPeriodo.fecha_periodo) == month,
    ).exists()


def _future_book_filter(model: type[ErpLibroDiario] | type[ErpLibroMayor], cutoff: date):
    return or_(
        model.periodo_anio > cutoff.year,
        (model.periodo_anio == cutoff.year) & (model.periodo_mes > cutoff.month),
    ) & ~_closed_month_filter(model.periodo_anio, model.periodo_mes)


def _next_month(period: date) -> date:
    if period.month == 12:
        return date(period.year + 1, 1, 1)
    return date(period.year, period.month + 1, 1)


def cleanup_future_erp_actuals(
    session: Session,
    *,
    cutoff: date | None = None,
    apply_changes: bool = False,
) -> dict[str, object]:
    """Remove synchronized actuals after the first open period.

    Budget amounts and manual income are preserved. This intentionally mirrors
    ``sync_real_presupuestos``: accounting income is identified by the
    ``Ingresos`` ERP category, while every accounting expense is reset.
    """

    selected_cutoff = cutoff or get_first_open_period(session)
    selected_cutoff = date(selected_cutoff.year, selected_cutoff.month, 1)
    future_start = _next_month(selected_cutoff)

    income_account_ids = (
        select(ErpCuenta.id)
        .join(ErpRubro, ErpRubro.id == ErpCuenta.rubro_id)
        .where(func.lower(func.trim(ErpRubro.nombre)) == "ingresos")
    )
    future_budgets = (
        ErpPresupuesto.deleted_at.is_(None),
        ErpPresupuesto.fecha >= future_start,
        ~_closed_month_filter(extract("year", ErpPresupuesto.fecha), extract("month", ErpPresupuesto.fecha)),
    )
    affected_actuals = or_(
        func.coalesce(ErpPresupuesto.real_egreso, ZERO) != ZERO,
        (
            ErpPresupuesto.erp_cuenta_id.in_(income_account_ids)
            & (func.coalesce(ErpPresupuesto.real_ingreso, ZERO) != ZERO)
        ),
    )
    empty_after_cleanup = (
        func.coalesce(ErpPresupuesto.egreso, ZERO) == ZERO,
        func.coalesce(ErpPresupuesto.ingres, ZERO) == ZERO,
        func.coalesce(ErpPresupuesto.obreros_cantidad, ZERO) == ZERO,
        func.coalesce(ErpPresupuesto.obreros_costo, ZERO) == ZERO,
        or_(
            func.coalesce(ErpPresupuesto.real_ingreso, ZERO) == ZERO,
            ErpPresupuesto.erp_cuenta_id.in_(income_account_ids),
        ),
    )

    diario_count = int(
        session.exec(
            select(func.count()).select_from(ErpLibroDiario).where(
                _future_book_filter(ErpLibroDiario, selected_cutoff)
            )
        ).one()
    )
    mayor_count = int(
        session.exec(
            select(func.count()).select_from(ErpLibroMayor).where(
                _future_book_filter(ErpLibroMayor, selected_cutoff)
            )
        ).one()
    )
    actuals_count = int(
        session.exec(
            select(func.count()).select_from(ErpPresupuesto).where(
                *future_budgets,
                affected_actuals,
            )
        ).one()
    )
    empty_count = int(
        session.exec(
            select(func.count()).select_from(ErpPresupuesto).where(
                *future_budgets,
                *empty_after_cleanup,
            )
        ).one()
    )

    result: dict[str, object] = {
        "periodo_corte": selected_cutoff.strftime("%Y-%m"),
        "periodo_limpieza_desde": future_start.strftime("%Y-%m"),
        "apply": apply_changes,
        "libro_diario_deleted": diario_count,
        "libro_mayor_deleted": mayor_count,
        "presupuestos_actualizados": actuals_count,
        "presupuestos_vacios_deleted": empty_count,
    }
    if not apply_changes:
        return result

    now = datetime.now(UTC)
    try:
        session.exec(
            delete(ErpLibroDiario).where(
                _future_book_filter(ErpLibroDiario, selected_cutoff)
            )
        )
        session.exec(
            delete(ErpLibroMayor).where(
                _future_book_filter(ErpLibroMayor, selected_cutoff)
            )
        )
        session.exec(update(ErpCashPeriodo).where(
            ErpCashPeriodo.fecha_periodo >= future_start,
            ErpCashPeriodo.estado != "CERRADO",
            ErpCashPeriodo.deleted_at.is_(None),
        ).values(diario_cash_importado=False, mayor_cash_importado=False))
        session.exec(
            update(ErpPresupuesto)
            .where(*future_budgets, affected_actuals)
            .values(
                real_ingreso=case(
                    (ErpPresupuesto.erp_cuenta_id.in_(income_account_ids), ZERO),
                    else_=ErpPresupuesto.real_ingreso,
                ),
                real_egreso=ZERO,
                updated_at=now,
                version=ErpPresupuesto.version + 1,
            )
        )
        deleted_empty_result = session.exec(
            delete(ErpPresupuesto).where(
                *future_budgets,
                func.coalesce(ErpPresupuesto.egreso, ZERO) == ZERO,
                func.coalesce(ErpPresupuesto.ingres, ZERO) == ZERO,
                func.coalesce(ErpPresupuesto.real_egreso, ZERO) == ZERO,
                func.coalesce(ErpPresupuesto.real_ingreso, ZERO) == ZERO,
                func.coalesce(ErpPresupuesto.obreros_cantidad, ZERO) == ZERO,
                func.coalesce(ErpPresupuesto.obreros_costo, ZERO) == ZERO,
            )
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    result["presupuestos_vacios_deleted"] = int(deleted_empty_result.rowcount or 0)
    return result
