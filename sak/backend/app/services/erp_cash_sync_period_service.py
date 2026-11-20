"""Transiciones del período operativo durante la sincronización ERP."""
from datetime import date
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from app.models.base import current_utc_time
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.services.cash_projection_configuration import lock_projection_configuration
from app.services.cash_projection_horizon import (
    HISTORY_START, PROJECTION_MONTHS, ensure_projection_horizon, month_range, shift_month,
)
from app.models.erp.libro_diario_sync import parse_periodo


def _target_period(session: Session, month: date) -> ErpCashPeriodo:
    rows = session.exec(select(ErpCashPeriodo).where(
        ErpCashPeriodo.deleted_at.is_(None), ErpCashPeriodo.fecha_periodo >= HISTORY_START,
    ).order_by(ErpCashPeriodo.fecha_periodo).with_for_update()).all()
    first = next((row for row in rows if row.estado != "CERRADO"), None)
    if first is None or first.fecha_periodo != month:
        raise ValueError("Solo se puede sincronizar o cerrar el primer período no cerrado. Actualizá la pantalla.")
    if any(row.estado == "EN_CIERRE" and row.fecha_periodo != month for row in rows):
        raise ValueError("Ya existe otro período en cierre; revisar los estados antes de sincronizar.")
    return first


def begin_cash_sync(session: Session, period: str) -> dict:
    month = date(*parse_periodo(period), 1)
    try:
        lock_projection_configuration(session)
        target = _target_period(session, month)
        current_month = current_utc_time().astimezone(ZoneInfo("America/Argentina/Buenos_Aires")).date().replace(day=1)
        if target.estado == "ABIERTO" and month < current_month:
            target.estado = "EN_CIERRE"
            target.updated_at = current_utc_time()
            target.version += 1
            session.add(target)
        session.commit()
        return {"periodo": month.strftime("%Y-%m"), "estado": target.estado}
    except Exception:
        session.rollback()
        raise


def close_cash_sync_period(session: Session, month: date) -> dict:
    """El llamador confirma el cierre junto con Cash y el nuevo horizonte."""
    lock_projection_configuration(session)
    target = _target_period(session, month)
    if target.estado != "EN_CIERRE":
        raise ValueError("El período debe estar en cierre para finalizar su sincronización.")
    if not target.diario_cash_importado or not target.mayor_cash_importado:
        raise ValueError("Para cerrar el período deben haberse importado ambos libros desde ERP.")
    target.estado = "CERRADO"
    target.cerrado_en = current_utc_time()
    target.updated_at = target.cerrado_en
    target.version += 1
    session.add(target)
    start = shift_month(month, 1)
    end = shift_month(start, PROJECTION_MONTHS - 1)
    existing = set(session.exec(select(ErpCashPeriodo.fecha_periodo).where(
        ErpCashPeriodo.deleted_at.is_(None), ErpCashPeriodo.fecha_periodo >= start,
        ErpCashPeriodo.fecha_periodo <= end,
    )).all())
    session.add_all(ErpCashPeriodo(fecha_periodo=period, estado="ABIERTO")
        for period in month_range(start, end) if period not in existing)
    session.flush()
    horizon = ensure_projection_horizon(session)
    return {"periodo_cerrado": month.strftime("%Y-%m"), "horizonte": horizon}
