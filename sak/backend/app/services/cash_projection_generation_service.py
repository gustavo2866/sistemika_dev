from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.base import current_utc_time
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.metodo_proyeccion import MetodoProyeccion
from app.services.cash_projection_configuration import lock_projection_configuration
from app.services.cash_projection_service import CashProjectionEngine, _iter_months


def recalculate_cash_projections(session: Session, start: date, end: date, *, include_closed=False):
    """Generación compartida; el llamador confirma o revierte la transacción."""
    lock_projection_configuration(session)
    engine = CashProjectionEngine(session)
    accounts = session.exec(select(ErpCashCuenta).where(
        ErpCashCuenta.deleted_at.is_(None),
        func.upper(func.trim(ErpCashCuenta.tipo)).in_(["INGRESO", "EGRESO"]),
    ).order_by(ErpCashCuenta.id)).all()
    closed = set(session.exec(select(ErpCashPeriodo.fecha_periodo).where(
        ErpCashPeriodo.deleted_at.is_(None), ErpCashPeriodo.estado == "CERRADO",
    )).all()) if not include_closed else set()
    stored = {(r.cuenta_cash_id, r.fecha_periodo): r for r in session.exec(select(ErpCashProyectado).where(
        ErpCashProyectado.deleted_at.is_(None), ErpCashProyectado.fecha_periodo >= start,
        ErpCashProyectado.fecha_periodo <= end)).all()}
    calculated = manual_preserved = methods_updated = 0
    now = current_utc_time()
    for month in _iter_months(start, end):
        if month in closed:
            continue
        for account in accounts:
            row = stored.get((account.id, month))
            method = session.get(MetodoProyeccion, account.id_metodo_proyeccion) if account.id_metodo_proyeccion else None
            if row is None and method is None:
                continue
            kind = method.tipo_calculo if method else "HISTORICO"
            changed = row is None
            if row is None:
                row = ErpCashProyectado(cuenta_cash_id=account.id, fecha_periodo=month, origen_proyectado="CALCULADO")
                stored[(account.id, month)] = row
            if row.id_metodo_proyeccion != account.id_metodo_proyeccion or row.tipo_calculo != kind:
                row.id_metodo_proyeccion = account.id_metodo_proyeccion
                row.tipo_calculo = kind
                methods_updated += 1
                changed = True
            if row.origen_proyectado == "MANUAL":
                manual_preserved += 1
            elif method is not None and kind != "PENDIENTE":
                amount = engine.calculate(account.id, month).projected_value.quantize(Decimal("0.01"))
                if row.importe_proyectado != amount:
                    row.importe_proyectado = amount
                    changed = True
                calculated += 1
            if changed:
                row.updated_at = now
                row.version = int(row.version or 0) + 1
                session.add(row)
        session.flush()
    return {"proyecciones_calculadas": calculated, "proyecciones_manuales_conservadas": manual_preserved,
        "metodos_actualizados": methods_updated}
