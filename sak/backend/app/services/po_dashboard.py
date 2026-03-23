from __future__ import annotations

import calendar
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Iterable, Optional, Sequence

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.compras import PoOrder, PoOrderStatus

OPEN_STATUS_KEYS = {"solicitada", "emitida", "aprobada", "aprobado", "en_proceso"}
IN_PROCESS_STATUS_KEYS = {"aprobada", "aprobado", "en_proceso"}
REJECTED_STATUS_KEYS = {"rechazada", "rechazado"}
FACTURADA_STATUS_KEYS = {"facturada"}


@dataclass
class CalculatedPoOrder:
    order: PoOrder
    fecha_creacion: date
    fecha_estado: date
    estado: str
    monto_total: Decimal
    bucket_creacion: str
    dias_abierta: int
    is_period_item: bool
    is_pending_carryover: bool
    is_solicitada: bool
    is_emitida: bool
    is_en_proceso: bool
    is_facturada_period: bool
    is_rechazada_period: bool
    is_solicitada_alarm: bool
    is_emitida_alarm: bool


def _to_date(value: str | date | datetime | None) -> date:
    if value is None:
        raise ValueError("Fecha requerida")
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_date(value: date | datetime | None) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return value.date()


def _normalize_status(value: str | None) -> str:
    if not value:
        return ""
    return str(value).strip().lower()


def _month_bucket(value: date) -> str:
    return f"{value.year}-{value.month:02d}"


def _shift_month(base: date, months: int) -> date:
    month = base.month - 1 + months
    year = base.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def _decimal(value: Decimal | float | int | None) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _sum_amount(values: Iterable[Decimal]) -> Decimal:
    total = Decimal("0")
    for value in values:
        total += _decimal(value)
    return total


def _build_month_buckets(start: date, end: date) -> list[str]:
    cursor = date(start.year, start.month, 1)
    end_month = date(end.year, end.month, 1)
    buckets: list[str] = []
    while cursor <= end_month:
        buckets.append(_month_bucket(cursor))
        cursor = _shift_month(cursor, 1)
    return buckets


def _build_kpi_summary(items: Sequence[CalculatedPoOrder]) -> dict[str, float | int]:
    return {
        "count": len(items),
        "amount": float(_sum_amount(item.monto_total for item in items)),
    }


def fetch_po_orders_for_dashboard(
    session: Session,
    start_date: str,
    end_date: str,
    solicitante_ids: Optional[Sequence[int]] = None,
    proveedor_ids: Optional[Sequence[int]] = None,
    tipo_solicitud_ids: Optional[Sequence[int]] = None,
) -> list[CalculatedPoOrder]:
    start = _to_date(start_date)
    end = _to_date(end_date)

    query = (
        select(PoOrder)
        .where(PoOrder.deleted_at.is_(None))
        .options(
            selectinload(PoOrder.proveedor),
            selectinload(PoOrder.solicitante),
            selectinload(PoOrder.tipo_solicitud),
            selectinload(PoOrder.order_status),
        )
    )

    if solicitante_ids:
        query = query.where(PoOrder.solicitante_id.in_(solicitante_ids))
    if proveedor_ids:
        query = query.where(PoOrder.proveedor_id.in_(proveedor_ids))
    if tipo_solicitud_ids:
        query = query.where(PoOrder.tipo_solicitud_id.in_(tipo_solicitud_ids))

    orders = session.exec(query).all()

    items: list[CalculatedPoOrder] = []
    for order in orders:
        fecha_creacion = _parse_date(order.created_at)
        if not fecha_creacion or fecha_creacion > end:
            continue

        fecha_estado = _parse_date(order.updated_at) or fecha_creacion
        estado = _normalize_status(order.order_status.nombre if order.order_status else None)
        dias_abierta = max(0, (end - fecha_creacion).days)
        is_period_item = start <= fecha_creacion <= end
        is_solicitada = estado == "solicitada"
        is_emitida = estado == "emitida"
        is_en_proceso = estado in IN_PROCESS_STATUS_KEYS
        is_facturada_period = estado in FACTURADA_STATUS_KEYS and start <= fecha_estado <= end
        is_rechazada_period = estado in REJECTED_STATUS_KEYS and start <= fecha_estado <= end

        items.append(
            CalculatedPoOrder(
                order=order,
                fecha_creacion=fecha_creacion,
                fecha_estado=fecha_estado,
                estado=estado,
                monto_total=_decimal(order.total),
                bucket_creacion=_month_bucket(fecha_creacion),
                dias_abierta=dias_abierta,
                is_period_item=is_period_item,
                is_pending_carryover=fecha_creacion < start and estado in OPEN_STATUS_KEYS,
                is_solicitada=is_solicitada,
                is_emitida=is_emitida,
                is_en_proceso=is_en_proceso,
                is_facturada_period=is_facturada_period,
                is_rechazada_period=is_rechazada_period,
                is_solicitada_alarm=is_solicitada and dias_abierta > 10,
                is_emitida_alarm=is_emitida and dias_abierta > 10,
            )
        )

    return items


def build_po_dashboard_payload(
    items: Sequence[CalculatedPoOrder],
    start_date: str,
    end_date: str,
    limit_top: int = 8,
    filters: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    start = _to_date(start_date)
    end = _to_date(end_date)
    period_items = [item for item in items if item.is_period_item]
    compras_periodo = [item for item in period_items if item.is_emitida]

    pendientes = [item for item in items if item.is_pending_carryover]
    solicitadas = [item for item in items if item.is_solicitada]
    emitidas = [item for item in items if item.is_emitida]
    en_proceso = [item for item in items if item.is_en_proceso]
    facturadas = [item for item in items if item.is_facturada_period]

    tipo_solicitud_data: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"tipo_solicitud": "Sin tipo", "count": 0, "amount": Decimal("0")}
    )
    for item in compras_periodo:
        label = item.order.tipo_solicitud.nombre if item.order.tipo_solicitud else "Sin tipo"
        entry = tipo_solicitud_data[label]
        entry["tipo_solicitud"] = label
        entry["count"] += 1
        entry["amount"] += item.monto_total

    evolucion_map = {
        bucket: {
            "bucket": bucket,
            "total": 0,
            "solicitadas": 0,
            "emitidas": 0,
            "en_proceso": 0,
            "facturadas": 0,
            "rechazadas": 0,
        }
        for bucket in _build_month_buckets(start, end)
    }
    for item in compras_periodo:
        row = evolucion_map.get(item.bucket_creacion)
        if row is None:
            continue
        row["total"] += 1
        row["solicitadas"] += int(item.is_solicitada)
        row["emitidas"] += int(item.is_emitida)
        row["en_proceso"] += int(item.is_en_proceso)
        row["facturadas"] += int(item.estado in FACTURADA_STATUS_KEYS)
        row["rechazadas"] += int(item.estado in REJECTED_STATUS_KEYS)

    ranking_map: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"proveedor": "Sin proveedor", "count": 0, "amount": Decimal("0")}
    )
    for item in compras_periodo:
        label = item.order.proveedor.nombre if item.order.proveedor else "Sin proveedor"
        entry = ranking_map[label]
        entry["proveedor"] = label
        entry["count"] += 1
        entry["amount"] += item.monto_total

    ranking_proveedores = sorted(
        (
            {
                "proveedor": entry["proveedor"],
                "count": entry["count"],
                "amount": float(entry["amount"]),
            }
            for entry in ranking_map.values()
        ),
        key=lambda entry: (entry["amount"], entry["count"], entry["proveedor"]),
        reverse=True,
    )[:limit_top]

    return {
        "range": {"startDate": start.isoformat(), "endDate": end.isoformat()},
        "filters": filters or {},
        "compras_periodo": _build_kpi_summary(compras_periodo),
        "kpis": {
            "pendientes": _build_kpi_summary(pendientes),
            "solicitadas": _build_kpi_summary(solicitadas),
            "emitidas": _build_kpi_summary(emitidas),
            "en_proceso": _build_kpi_summary(en_proceso),
            "facturadas": _build_kpi_summary(facturadas),
        },
        "alerts": {
            "rechazadas": sum(1 for item in items if item.is_rechazada_period),
            "solicitudes_vencidas": sum(1 for item in items if item.is_solicitada_alarm),
            "emitidas_vencidas": sum(1 for item in items if item.is_emitida_alarm),
        },
        "tipo_solicitud": sorted(
            (
                {
                    "tipo_solicitud": entry["tipo_solicitud"],
                    "count": entry["count"],
                    "amount": float(entry["amount"]),
                }
                for entry in tipo_solicitud_data.values()
            ),
            key=lambda entry: (entry["amount"], entry["count"], entry["tipo_solicitud"]),
            reverse=True,
        ),
        "evolucion": list(evolucion_map.values()),
        "ranking_proveedores": ranking_proveedores,
        "stats": {
            "periodo": len(period_items),
            "arrastre": len(pendientes),
            "total_filtrado": len(items),
        },
    }


def filter_po_dashboard_items_by_kpi(
    items: Sequence[CalculatedPoOrder],
    kpi_key: str,
) -> list[CalculatedPoOrder]:
    if kpi_key == "pendientes":
        return [item for item in items if item.is_pending_carryover]
    if kpi_key == "solicitadas":
        return [item for item in items if item.is_solicitada]
    if kpi_key == "emitidas":
        return [item for item in items if item.is_emitida]
    if kpi_key == "en_proceso":
        return [item for item in items if item.is_en_proceso]
    if kpi_key == "facturadas":
        return [item for item in items if item.is_facturada_period]
    return list(items)


def filter_po_dashboard_items_by_alert(
    items: Sequence[CalculatedPoOrder],
    alert_key: str,
) -> list[CalculatedPoOrder]:
    if alert_key == "rechazadas":
        return [item for item in items if item.is_rechazada_period]
    if alert_key == "solicitudes_vencidas":
        return [item for item in items if item.is_solicitada_alarm]
    if alert_key == "emitidas_vencidas":
        return [item for item in items if item.is_emitida_alarm]
    return list(items)


def check_po_alert(
    order_id: int,
    alert_key: str,
    start_date: str,
    end_date: str,
    session: Session,
) -> bool:
    """Devuelve True si la orden sigue teniendo la alerta indicada."""
    order = session.get(PoOrder, order_id)
    if order is None or order.deleted_at is not None:
        return False

    start = _to_date(start_date)
    end = _to_date(end_date)
    fecha_creacion = _parse_date(order.created_at)
    if not fecha_creacion or fecha_creacion > end:
        return False

    fecha_estado = _parse_date(order.updated_at) or fecha_creacion
    estado = _normalize_status(order.order_status.nombre if order.order_status else None)
    dias_abierta = max(0, (end - fecha_creacion).days)

    if alert_key == "rechazadas":
        return estado in REJECTED_STATUS_KEYS and start <= fecha_estado <= end
    if alert_key == "solicitudes_vencidas":
        return estado == "solicitada" and dias_abierta > 10
    if alert_key == "emitidas_vencidas":
        return estado == "emitida" and dias_abierta > 10
    return False


# ---------------------------------------------------------------------------
# Bundle: single SQL query, multiple period calculations in Python
# ---------------------------------------------------------------------------

def _query_raw_po_orders_for_dashboard(
    session: Session,
    solicitante_ids: Optional[Sequence[int]] = None,
    proveedor_ids: Optional[Sequence[int]] = None,
    tipo_solicitud_ids: Optional[Sequence[int]] = None,
) -> list[PoOrder]:
    """SQL-only query without date filtering — date range applied per period in Python."""
    query = (
        select(PoOrder)
        .where(PoOrder.deleted_at.is_(None))
        .options(
            selectinload(PoOrder.proveedor),
            selectinload(PoOrder.solicitante),
            selectinload(PoOrder.tipo_solicitud),
            selectinload(PoOrder.order_status),
        )
    )
    if solicitante_ids:
        query = query.where(PoOrder.solicitante_id.in_(solicitante_ids))
    if proveedor_ids:
        query = query.where(PoOrder.proveedor_id.in_(proveedor_ids))
    if tipo_solicitud_ids:
        query = query.where(PoOrder.tipo_solicitud_id.in_(tipo_solicitud_ids))
    return list(session.exec(query).all())


def _calculate_po_for_period(
    raw: list[PoOrder],
    start: date,
    end: date,
) -> list[CalculatedPoOrder]:
    """Pure Python calculation for a period — no DB access."""
    items: list[CalculatedPoOrder] = []
    for order in raw:
        fecha_creacion = _parse_date(order.created_at)
        if not fecha_creacion or fecha_creacion > end:
            continue
        fecha_estado = _parse_date(order.updated_at) or fecha_creacion
        estado = _normalize_status(order.order_status.nombre if order.order_status else None)
        dias_abierta = max(0, (end - fecha_creacion).days)
        is_period_item = start <= fecha_creacion <= end
        is_solicitada = estado == "solicitada"
        is_emitida = estado == "emitida"
        is_en_proceso = estado in IN_PROCESS_STATUS_KEYS
        is_facturada_period = estado in FACTURADA_STATUS_KEYS and start <= fecha_estado <= end
        is_rechazada_period = estado in REJECTED_STATUS_KEYS and start <= fecha_estado <= end
        items.append(
            CalculatedPoOrder(
                order=order,
                fecha_creacion=fecha_creacion,
                fecha_estado=fecha_estado,
                estado=estado,
                monto_total=_decimal(order.total),
                bucket_creacion=_month_bucket(fecha_creacion),
                dias_abierta=dias_abierta,
                is_period_item=is_period_item,
                is_pending_carryover=fecha_creacion < start and estado in OPEN_STATUS_KEYS,
                is_solicitada=is_solicitada,
                is_emitida=is_emitida,
                is_en_proceso=is_en_proceso,
                is_facturada_period=is_facturada_period,
                is_rechazada_period=is_rechazada_period,
                is_solicitada_alarm=is_solicitada and dias_abierta > 10,
                is_emitida_alarm=is_emitida and dias_abierta > 10,
            )
        )
    return items


def _shift_dates(start_date: str, end_date: str, period_type: str, steps: int) -> tuple[str, str]:
    """Shift date range by N periods (mirrors frontend shiftDashboardFilters)."""
    period_months: dict[str, int] = {
        "mes": 1, "trimestre": 3, "cuatrimestre": 4, "semestre": 6, "anio": 12,
    }
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()

    if period_type == "personalizado":
        diff_days = (end - start).days + 1
        offset = diff_days * steps
        return (
            (start + timedelta(days=offset)).isoformat(),
            (end + timedelta(days=offset)).isoformat(),
        )

    months = period_months.get(period_type, 1) * steps

    def _sh(d: date, m: int) -> date:
        mo = d.month - 1 + m
        yr = d.year + mo // 12
        mo = mo % 12 + 1
        last_day = calendar.monthrange(yr, mo)[1]
        return date(yr, mo, min(d.day, last_day))

    return _sh(start, months).isoformat(), _sh(end, months).isoformat()


def _format_trend_label(start_date: str, period_type: str) -> str:
    """Mirrors frontend formatTrendLabel."""
    d = datetime.strptime(start_date, "%Y-%m-%d").date()
    year_short = str(d.year)[-2:]
    month = d.month
    if period_type == "mes":
        return f"{month:02d}/{year_short}"
    if period_type == "trimestre":
        return f"T{(month - 1) // 3 + 1} {year_short}"
    if period_type == "cuatrimestre":
        return f"C{(month - 1) // 4 + 1} {year_short}"
    if period_type == "semestre":
        return f"S{(month - 1) // 6 + 1} {year_short}"
    if period_type == "anio":
        return str(d.year)
    return start_date


def fetch_po_selector_summary_fast(
    session: Session,
    start_date: str,
    end_date: str,
    solicitante_ids: Optional[Sequence[int]] = None,
    proveedor_ids: Optional[Sequence[int]] = None,
    tipo_solicitud_ids: Optional[Sequence[int]] = None,
) -> dict[str, dict[str, float | int]]:
    """Aggregate selector counts via SQL — no Python loops."""
    from sqlalchemy import and_, case, func

    start = _to_date(start_date)
    end = _to_date(end_date)

    status_name = func.lower(PoOrderStatus.nombre)
    pending_cond = and_(
        func.date(PoOrder.created_at) < start,
        status_name.in_(list(OPEN_STATUS_KEYS)),
    )
    facturada_cond = and_(
        status_name.in_(list(FACTURADA_STATUS_KEYS)),
        PoOrder.updated_at.is_not(None),
        func.date(PoOrder.updated_at) >= start,
        func.date(PoOrder.updated_at) <= end,
    )

    monto = PoOrder.total
    query = (
        select(
            func.sum(case((pending_cond, 1), else_=0)),
            func.sum(case((pending_cond, monto), else_=0)),
            func.sum(case((status_name == "solicitada", 1), else_=0)),
            func.sum(case((status_name == "solicitada", monto), else_=0)),
            func.sum(case((status_name == "emitida", 1), else_=0)),
            func.sum(case((status_name == "emitida", monto), else_=0)),
            func.sum(case((status_name.in_(list(IN_PROCESS_STATUS_KEYS)), 1), else_=0)),
            func.sum(case((status_name.in_(list(IN_PROCESS_STATUS_KEYS)), monto), else_=0)),
            func.sum(case((facturada_cond, 1), else_=0)),
            func.sum(case((facturada_cond, monto), else_=0)),
        )
        .select_from(PoOrder)
        .join(PoOrderStatus, PoOrderStatus.id == PoOrder.order_status_id, isouter=True)
        .where(PoOrder.deleted_at.is_(None))
    )
    if solicitante_ids:
        query = query.where(PoOrder.solicitante_id.in_(solicitante_ids))
    if proveedor_ids:
        query = query.where(PoOrder.proveedor_id.in_(proveedor_ids))
    if tipo_solicitud_ids:
        query = query.where(PoOrder.tipo_solicitud_id.in_(tipo_solicitud_ids))

    row = session.exec(query).one()
    return {
        "pendientes": {"count": int(row[0] or 0), "amount": float(row[1] or 0)},
        "solicitadas": {"count": int(row[2] or 0), "amount": float(row[3] or 0)},
        "emitidas": {"count": int(row[4] or 0), "amount": float(row[5] or 0)},
        "en_proceso": {"count": int(row[6] or 0), "amount": float(row[7] or 0)},
        "facturadas": {"count": int(row[8] or 0), "amount": float(row[9] or 0)},
    }


def build_po_dashboard_bundle(
    session: Session,
    start_date: str,
    end_date: str,
    period_type: str,
    trend_steps: list[int],
    previous_step: int = -1,
    solicitante_ids: Optional[Sequence[int]] = None,
    proveedor_ids: Optional[Sequence[int]] = None,
    tipo_solicitud_ids: Optional[Sequence[int]] = None,
    limit_top: int = 8,
    filters_ctx: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Returns {current, previous, trend} using a single SQL query."""
    raw = _query_raw_po_orders_for_dashboard(
        session=session,
        solicitante_ids=solicitante_ids,
        proveedor_ids=proveedor_ids,
        tipo_solicitud_ids=tipo_solicitud_ids,
    )

    def _build_period(s: str, e: str) -> dict:
        items = _calculate_po_for_period(raw, _to_date(s), _to_date(e))
        return build_po_dashboard_payload(
            items,
            start_date=s,
            end_date=e,
            limit_top=limit_top,
            filters=filters_ctx,
        )

    current_data = _build_period(start_date, end_date)

    prev_start, prev_end = _shift_dates(start_date, end_date, period_type, previous_step)
    previous_data = _build_period(prev_start, prev_end)

    trend: list[dict[str, Any]] = []
    for step in trend_steps:
        t_start, t_end = _shift_dates(start_date, end_date, period_type, step)
        t_items = _calculate_po_for_period(raw, _to_date(t_start), _to_date(t_end))
        t_period_items = [item for item in t_items if item.is_period_item]
        t_compras = [item for item in t_period_items if item.is_emitida]
        kpi = _build_kpi_summary(t_compras)
        trend.append({
            "label": _format_trend_label(t_start, period_type),
            "amount": kpi["amount"],
            "count": kpi["count"],
        })

    return {"current": current_data, "previous": previous_data, "trend": trend}
