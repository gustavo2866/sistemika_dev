"""Horizonte móvil de Cash, independiente del año visible en el panel."""
from dataclasses import dataclass
from datetime import date

from sqlmodel import Session, select

from app.models.erp.cash_periodo import ErpCashPeriodo

HISTORY_START = date(2026, 1, 1)
PROJECTION_MONTHS = 24


def shift_month(month: date, offset: int) -> date:
    absolute = month.year * 12 + month.month - 1 + offset
    return date(absolute // 12, absolute % 12 + 1, 1)


def month_range(start: date, end: date) -> tuple[date, ...]:
    count = (end.year - start.year) * 12 + end.month - start.month + 1
    return tuple(shift_month(start, offset) for offset in range(count))


@dataclass(frozen=True)
class CashProjectionHorizon:
    start: date
    end: date
    last_closed: date | None

    @property
    def editor_months(self) -> tuple[date, ...]:
        return month_range(HISTORY_START, self.end)

    def as_dict(self) -> dict:
        return {
            "historico_desde": HISTORY_START.isoformat(),
            "proyeccion_desde": self.start.isoformat(),
            "proyeccion_hasta": self.end.isoformat(),
            "meses_proyeccion": PROJECTION_MONTHS,
            "ultimo_periodo_cerrado": self.last_closed.isoformat() if self.last_closed else None,
        }


def get_projection_horizon(session: Session) -> CashProjectionHorizon:
    rows = session.exec(select(ErpCashPeriodo.fecha_periodo, ErpCashPeriodo.estado).where(
        ErpCashPeriodo.deleted_at.is_(None),
    )).all()
    last_closed = max((month for month, state in rows if state == "CERRADO"), default=None)
    start = next((min(months) for state in ("EN_CIERRE", "ABIERTO")
        if (months := [month for month, status in rows if status == state and month >= HISTORY_START])), None)
    if start is None:
        start = max(HISTORY_START, shift_month(last_closed, 1)) if last_closed else HISTORY_START
    return CashProjectionHorizon(start, shift_month(start, PROJECTION_MONTHS - 1), last_closed)


def ensure_projection_horizon(session: Session) -> dict:
    """Extiende y recalcula el horizonte conservando importes manuales y cerrados."""
    from app.services.cash_projection_generation_service import recalculate_cash_projections
    from app.services.erp_cash_pendientes_projection_service import rebuild_pending_cash_projection

    horizon = get_projection_horizon(session)
    rebuild_pending_cash_projection(session, period_from=horizon.start, period_to=horizon.end, auto_commit=False)
    stats = recalculate_cash_projections(session, horizon.start, horizon.end)
    return {**horizon.as_dict(), **stats}
