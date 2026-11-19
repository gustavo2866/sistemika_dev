from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.models.erp.cash_diario_sync import sync_cash_diario_periodo
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.libro_diario_sync import parse_periodo
from app.models.erp.libro_mayor import ErpLibroMayor
from app.services.cash_projection_generation_service import recalculate_cash_projections
from app.services.cash_projection_configuration import lock_projection_configuration, validate_cash_dependencies
from app.services.cash_projection_horizon import get_projection_horizon
from app.services.erp_cash_pendientes_assignment_service import assign_cash_accounts_to_pendientes
from app.services.erp_cash_pendientes_projection_service import rebuild_pending_cash_projection


def _months(start: date, end: date):
    month = start
    while month <= end:
        yield month
        month = date(month.year + (month.month == 12), month.month % 12 + 1, 1)


def rebuild_cash(
    session: Session, period_from: str, period_to: str | None = None, *, include_closed: bool = False,
    actuals_to: str | None = None,
    close_period: bool = False,
) -> dict[str, object]:
    """Reconstruye exclusivamente desde datos locales, en una transacción."""
    start = date(*parse_periodo(period_from), 1)
    end = date(*parse_periodo(period_to), 1) if period_to else get_projection_horizon(session).end
    if start < date(2025, 12, 1):
        raise ValueError("El mes inicial no puede ser anterior a diciembre de 2025")
    # Diciembre es el saldo base fijo, nunca un período a reemplazar.
    start = max(start, date(2026, 1, 1))
    if start > end:
        raise ValueError("Seleccionar un rango ordenado desde enero de 2026")
    actuals_end = date(*parse_periodo(actuals_to), 1) if actuals_to is not None else end
    if not start <= actuals_end <= end:
        raise ValueError("El límite de reales debe estar dentro del rango a reconstruir")
    if close_period and include_closed:
        raise ValueError("No se puede cerrar un período incluyendo períodos cerrados")
    months = tuple(_months(start, end))

    try:
        lock_projection_configuration(session)
        validate_cash_dependencies(session)
        periods = {row.fecha_periodo: row for row in session.exec(select(ErpCashPeriodo).where(
            ErpCashPeriodo.deleted_at.is_(None), ErpCashPeriodo.fecha_periodo >= start,
            ErpCashPeriodo.fecha_periodo <= end,
        ).order_by(ErpCashPeriodo.fecha_periodo).with_for_update()).all()}
        closed_periods = {month for month, row in periods.items() if row.estado == "CERRADO"}
        # incluir_cerrados permite recalcular proyecciones, nunca reemplazar reales.
        closed = closed_periods
        if len(closed) == len(months) and not include_closed:
            if close_period:
                raise ValueError("El período ya está cerrado. Actualizá la pantalla.")
            session.commit()
            return {
                "periodo_desde": start.strftime("%Y-%m"), "periodo_hasta": end.strftime("%Y-%m"),
                "periodos_cerrados_omitidos": len(closed),
                "periodos_cerrados_reconstruidos": 0,
                **{key: 0 for key in ("periodos_reales_reconstruidos", "movimientos", "saldos",
                    "pendientes_reasignados", "pendientes_sin_mapeo", "pendientes_actualizados",
                    "proyecciones_calculadas", "proyecciones_manuales_conservadas", "metodos_actualizados")},
            }
        # Usar los libros disponibles, aunque el mes siga recibiendo movimientos.
        # Sin libros locales ni una importación vacía confirmada, conservar Cash.
        actual_months: set[date] = set()
        for model in (ErpLibroDiario, ErpLibroMayor):
            values = session.exec(select(model.periodo_anio, model.periodo_mes).where(
                model.deleted_at.is_(None),
                (model.periodo_anio * 12 + model.periodo_mes >= start.year * 12 + start.month),
                (model.periodo_anio * 12 + model.periodo_mes <= end.year * 12 + end.month),
            ).distinct()).all()
            actual_months.update(date(int(year), int(month), 1) for year, month in values)
        movements = balances = real_periods = closed_rebuilt = 0
        for month in months:
            period = periods.get(month)
            has_import = period is not None and (period.diario_cash_importado or period.mayor_cash_importado)
            if month > actuals_end or month in closed or (month not in actual_months and not has_import):
                continue
            result = sync_cash_diario_periodo(
                session, month.strftime("%Y-%m"), auto_commit=False, include_closed=include_closed,
                require_complete_sources=False,
            )
            movements += int(result["rows_inserted"])
            balances += int(result["saldos_inserted"])
            real_periods += 1
            closed_rebuilt += month in closed_periods

        assignment = assign_cash_accounts_to_pendientes(session, overwrite=True, auto_commit=False)
        pending = rebuild_pending_cash_projection(session, period_from=start, period_to=end, auto_commit=False)
        projections = recalculate_cash_projections(session, start, end, include_closed=include_closed)
        closure = {}
        if close_period:
            from app.services.erp_cash_sync_period_service import close_cash_sync_period
            closure = close_cash_sync_period(session, start)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "periodo_desde": start.strftime("%Y-%m"),
        "periodo_hasta": closure["horizonte"]["proyeccion_hasta"][:7] if closure else end.strftime("%Y-%m"),
        "periodos_cerrados_omitidos": len(closed), "periodos_reales_reconstruidos": real_periods,
        "periodos_cerrados_reconstruidos": closed_rebuilt,
        "movimientos": movements, "saldos": balances,
        "pendientes_reasignados": assignment["rows_assigned"], "pendientes_sin_mapeo": assignment["rows_unmapped"],
        "pendientes_actualizados": pending["rows_updated"],
        **projections,
        **closure,
    }
