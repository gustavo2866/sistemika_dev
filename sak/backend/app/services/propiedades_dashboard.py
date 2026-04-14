from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Optional

from sqlmodel import Session, select
from sqlalchemy import func

from app.models.propiedad import Propiedad, PropiedadesLogStatus, PropiedadesStatus
from app.models.crm.catalogos import CRMTipoOperacion

# ---------------------------------------------------------------------------
# Helpers de período  (misma lógica que po_dashboard / crm_dashboard)
# ---------------------------------------------------------------------------

_PERIOD_MONTHS: dict[str, int] = {
    "mes": 1,
    "trimestre": 3,
    "cuatrimestre": 4,
    "semestre": 6,
    "anio": 12,
}


def _to_date_str(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return datetime.strptime(value, "%Y-%m-%d").date()


def _shift_dates(start_date: str, end_date: str, period_type: str, steps: int) -> tuple[str, str]:
    """Desplaza el rango de fechas N períodos (replica frontend shiftDashboardFilters)."""
    start = _to_date_str(start_date)
    end = _to_date_str(end_date)

    if period_type == "personalizado":
        diff_days = (end - start).days + 1
        offset = diff_days * steps
        return (
            (start + timedelta(days=offset)).isoformat(),
            (end + timedelta(days=offset)).isoformat(),
        )

    months = _PERIOD_MONTHS.get(period_type, 1) * steps

    def _sh(d: date, m: int) -> date:
        mo = d.month - 1 + m
        yr = d.year + mo // 12
        mo = mo % 12 + 1
        last_day = calendar.monthrange(yr, mo)[1]
        return date(yr, mo, min(d.day, last_day))

    return _sh(start, months).isoformat(), _sh(end, months).isoformat()


def _format_trend_label(start_date: str, period_type: str) -> str:
    """Genera etiqueta legible para un bucket de tendencia."""
    d = _to_date_str(start_date)
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


def _parse_int_list(value: Optional[str]) -> list[int]:
    if not value:
        return []
    result = []
    for chunk in value.split(","):
        chunk = chunk.strip()
        try:
            result.append(int(chunk))
        except ValueError:
            pass
    return result


def _safe_days(pivot: date, start: Optional[date]) -> int:
    if not start:
        return 0
    delta = (pivot - start).days
    return max(delta, 0)


def _estado_sort_key(value: str) -> tuple[int, str]:
    if not value:
        return (999, "")
    prefix = value.split("-", 1)[0]
    try:
        return (int(prefix), value)
    except ValueError:
        return (999, value)


def _resolve_status_id(session: Session, name_fragment: str) -> Optional[int]:
    status = session.exec(
        select(PropiedadesStatus)
        .where(PropiedadesStatus.nombre.ilike(f"%{name_fragment}%"))
        .order_by(PropiedadesStatus.orden.asc())
    ).first()
    return status.id if status else None


def _normalize_estado(value: str) -> str:
    return (value or "").strip().lower()



def build_propiedades_dashboard(
    session: Session,
    pivot_date: date,
    tipo_operacion_id: Optional[int] = None,
) -> dict[str, Any]:
    statuses = session.exec(select(PropiedadesStatus)).all()
    query = (
        select(Propiedad, CRMTipoOperacion, PropiedadesStatus)
        .where(Propiedad.deleted_at.is_(None))
        .join(CRMTipoOperacion, Propiedad.tipo_operacion_id == CRMTipoOperacion.id, isouter=True)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
    )
    if tipo_operacion_id is not None:
        query = query.where(Propiedad.tipo_operacion_id == tipo_operacion_id)
    rows = session.exec(query).all()

    # estado -> tipo_operacion_id -> agregado
    state_map: dict[str, dict[Optional[int], dict[str, Any]]] = defaultdict(dict)
    state_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0})
    state_order: dict[str, int] = {}

    for prop, tipo_operacion, estado_ref in rows:
        estado = (estado_ref.nombre if estado_ref else None) or "Sin estado"
        if estado not in state_order:
            state_order[estado] = estado_ref.orden if estado_ref else 999
        tipo_id = tipo_operacion.id if tipo_operacion else None
        tipo_nombre = tipo_operacion.nombre if tipo_operacion else "Sin tipo de operacion"

        bucket = state_map[estado].get(tipo_id)
        if not bucket:
            bucket = {
                "tipo_operacion_id": tipo_id,
                "tipo_operacion": tipo_nombre,
                "propiedades": 0,
                "dias_vacancia_total": 0,
                "dias_vacancia_promedio": 0,
            }
            state_map[estado][tipo_id] = bucket

        bucket["propiedades"] += 1
        bucket["dias_vacancia_total"] += _safe_days(pivot_date, prop.estado_fecha)
        state_totals[estado]["count"] += 1

    # Asegurar tarjetas vacías para estados finales aunque no haya registros vinculados
    for status in statuses:
        nombre = status.nombre or ""
        if nombre not in state_map:
            state_map[nombre] = {}
        if nombre not in state_totals:
            state_totals[nombre] = {"count": 0}
        if nombre not in state_order:
            state_order[nombre] = status.orden

    cards = []
    for estado, tipos in state_map.items():
        tipo_items = list(tipos.values())
        for item in tipo_items:
            props = item.get("propiedades", 0) or 0
            total_days = item.get("dias_vacancia_total", 0) or 0
            item["dias_vacancia_promedio"] = round(total_days / props) if props else 0
        tipo_items.sort(key=lambda item: item["propiedades"], reverse=True)
        total = state_totals[estado]
        cards.append(
            {
                "estado": estado,
                "orden": state_order.get(estado, 999),
                "propiedades": total["count"],
                "tipos": tipo_items,
            }
        )

    cards.sort(key=lambda item: (item.get("orden", 999), item["estado"]))

    # Simplificar métricas de retiro sin usar vacancias
    retirada_id = _resolve_status_id(session, "retirada")
    if retirada_id is not None:
        retiro_query = (
            select(Propiedad.estado_fecha)
            .where(Propiedad.deleted_at.is_(None))
            .where(Propiedad.propiedad_status_id == retirada_id)
        )
        if tipo_operacion_id is not None:
            retiro_query = retiro_query.where(Propiedad.tipo_operacion_id == tipo_operacion_id)

        fechas_retiro = session.exec(retiro_query).all()
        recientes = 0
        antiguas = 0
        for fecha_retiro in fechas_retiro:
            if not fecha_retiro:
                continue
            days = (pivot_date - fecha_retiro).days
            if days <= 30:
                recientes += 1
            else:
                antiguas += 1

        for card in cards:
            if "retirada" in _normalize_estado(card["estado"]):
                card["retiradaBuckets"] = [
                    {"key": "lt_30", "label": "< 30 dias", "count": recientes},
                    {"key": "gt_30", "label": "Mas antiguas", "count": antiguas},
                ]
                break

    return {
        "pivotDate": pivot_date.isoformat(),
        "totalPropiedades": sum(item["propiedades"] for item in cards),
        "cards": cards,
    }


def build_realizada_vencimientos(
    session: Session,
    pivot_date: date,
    tipo_operacion_id: Optional[int] = None,
) -> dict[str, Any]:
    if tipo_operacion_id is None:
        alquiler = session.exec(
            select(CRMTipoOperacion).where(
                (CRMTipoOperacion.nombre.ilike("%alquiler%"))
                | (CRMTipoOperacion.codigo.ilike("%alquiler%"))
            )
        ).first()
        tipo_operacion_id = alquiler.id if alquiler else None
    realizada_id = _resolve_status_id(session, "realizada")
    if realizada_id is None:
        return {
            "pivotDate": pivot_date.isoformat(),
            "tipoOperacionId": tipo_operacion_id,
            "ranges": [
                {"key": "vencidos", "label": "Vencidos", "count": 0},
                {"key": "lt_30", "label": "Vencen < 30 dias", "count": 0},
            ],
            "total": 0,
        }

    query = (
        select(
            Propiedad.vencimiento_contrato,
            Propiedad.fecha_renovacion,
        )
        .where(Propiedad.deleted_at.is_(None))
        .where(Propiedad.propiedad_status_id == realizada_id)
    )
    if tipo_operacion_id is not None:
        query = query.where(Propiedad.tipo_operacion_id == tipo_operacion_id)

    rows = session.exec(query).all()

    bucket_days = getattr(Propiedad, "REALIZADA_ALERT_DAYS", 60)
    vencimiento_lt_60 = 0
    renovacion_lt_60 = 0
    for vencimiento, fecha_renovacion in rows:
        if vencimiento is not None:
            days = (vencimiento - pivot_date).days
            if 0 <= days < bucket_days:
                vencimiento_lt_60 += 1
        if fecha_renovacion is not None:
            if vencimiento is not None and fecha_renovacion > vencimiento:
                continue
            days = (fecha_renovacion - pivot_date).days
            if 0 <= days < bucket_days:
                renovacion_lt_60 += 1

    return {
        "pivotDate": pivot_date.isoformat(),
        "tipoOperacionId": tipo_operacion_id,
        "ranges": [
            {
                "key": "vencimiento_lt_60",
                "label": f"Vencimiento < {bucket_days} dias",
                "count": vencimiento_lt_60,
            },
            {
                "key": "renovacion_lt_60",
                "label": f"Renovacion < {bucket_days} dias",
                "count": renovacion_lt_60,
            },
        ],
        "total": len(rows),
    }


# ===========================================================================
# Nueva API: bundle / selectors / detalle / detalle-alerta
# ===========================================================================

ALERT_DAYS = 60  # umbral para alertas de vencimiento/renovación


def _base_propiedad_query(
    session: Session,
    tipo_operacion_id: Optional[int] = None,
    emprendimiento_id: Optional[int] = None,
):
    """Query base de propiedades con status, sin filtros de fecha."""
    q = (
        select(Propiedad, PropiedadesStatus)
        .where(Propiedad.deleted_at.is_(None))
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
    )
    if tipo_operacion_id is not None:
        q = q.where(Propiedad.tipo_operacion_id == tipo_operacion_id)
    if emprendimiento_id is not None:
        q = q.where(Propiedad.emprendimiento_id == emprendimiento_id)
    return q


def _count_resueltas_en_periodo(
    session: Session,
    start_date: date,
    end_date: date,
    tipo_operacion_id: Optional[int],
    emprendimiento_id: Optional[int],
) -> int:
    """Cuenta propiedades que pasaron a Realizada (orden=4) dentro del período."""
    realizada_status = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    if not realizada_status:
        return 0

    q = (
        select(func.count(PropiedadesLogStatus.propiedad_id.distinct()))
        .join(Propiedad, PropiedadesLogStatus.propiedad_id == Propiedad.id)
        .where(Propiedad.deleted_at.is_(None))
        .where(PropiedadesLogStatus.estado_nuevo_id == realizada_status.id)
        .where(func.date(PropiedadesLogStatus.fecha_cambio) >= start_date)
        .where(func.date(PropiedadesLogStatus.fecha_cambio) <= end_date)
    )
    if tipo_operacion_id is not None:
        q = q.where(Propiedad.tipo_operacion_id == tipo_operacion_id)
    if emprendimiento_id is not None:
        q = q.where(Propiedad.emprendimiento_id == emprendimiento_id)
    return session.exec(q).one() or 0


def _build_period(
    session: Session,
    start_date: str,
    end_date: str,
    tipo_operacion_id: Optional[int] = None,
    emprendimiento_id: Optional[int] = None,
) -> dict[str, Any]:
    """Construye el payload completo de un período."""
    start = _to_date_str(start_date)
    end = _to_date_str(end_date)

    rows = session.exec(
        _base_propiedad_query(session, tipo_operacion_id, emprendimiento_id)
    ).all()

    # KPI accumulators
    kpi_buckets: dict[str, dict[str, Any]] = {
        "vacancias_periodo": {"count": 0, "dias": [], "variacion": None},
        "vacancias_anteriores": {"count": 0, "dias": [], "variacion": None},
        "recibidas":     {"count": 0, "dias": []},
        "en_reparacion": {"count": 0, "dias": []},
        "disponible":    {"count": 0, "dias": []},
        "realizada":     {"count": 0, "dias": []},
    }

    # Selector accumulators (current state, not period-bounded for snapshot)
    selectors: dict[str, Any] = {
        "recibida":      {"count": 0},
        "en_reparacion": {"count": 0},
        "disponible":    {"count": 0},
        "realizada":     {"count": 0, "vencimiento_lt_60": 0, "renovacion_lt_60": 0},
        "retirada":      {"count": 0, "lt_30": 0, "gt_30": 0},
    }

    # Alert counters (based on end_date as pivot)
    venc_lt_60 = 0
    renov_lt_60 = 0
    sin_vacancia_fecha = 0

    for prop, status in rows:
        orden = status.orden if status else 999
        nombre = (status.nombre or "").strip().lower() if status else ""

        # --- Selectors (snapshot estado actual) ---
        if "retirada" in nombre:
            selectors["retirada"]["count"] += 1
            if prop.estado_fecha:
                days_since = (end - prop.estado_fecha).days
                if days_since <= 30:
                    selectors["retirada"]["lt_30"] += 1
                else:
                    selectors["retirada"]["gt_30"] += 1
        elif orden == 1:
            selectors["recibida"]["count"] += 1
        elif orden == 2:
            selectors["en_reparacion"]["count"] += 1
        elif orden == 3:
            selectors["disponible"]["count"] += 1
        elif orden == 4:
            selectors["realizada"]["count"] += 1
            # Alertas de vencimiento/renovación al corte del período
            if prop.vencimiento_contrato:
                d = (prop.vencimiento_contrato - end).days
                if 0 <= d < ALERT_DAYS:
                    venc_lt_60 += 1
                    selectors["realizada"]["vencimiento_lt_60"] += 1
            if prop.fecha_renovacion:
                if not prop.vencimiento_contrato or prop.fecha_renovacion <= prop.vencimiento_contrato:
                    d = (prop.fecha_renovacion - end).days
                    if 0 <= d < ALERT_DAYS:
                        renov_lt_60 += 1
                        selectors["realizada"]["renovacion_lt_60"] += 1

        # --- KPI de vacancia (solo estados vacantes 1-3) ---
        if orden not in (1, 2, 3):
            continue

        if not prop.vacancia_fecha:
            sin_vacancia_fecha += 1
            # Aún lo contamos en el estado pero sin días
            if orden == 1:
                kpi_buckets["recibidas"]["count"] += 1
            elif orden == 2:
                kpi_buckets["en_reparacion"]["count"] += 1
            elif orden == 3:
                kpi_buckets["disponible"]["count"] += 1
            continue

        dias_al_corte = max(0, (end - prop.vacancia_fecha).days)

        # Clasificar en vacancias_periodo vs vacancias_anteriores
        if start <= prop.vacancia_fecha <= end:
            kpi_buckets["vacancias_periodo"]["count"] += 1
            kpi_buckets["vacancias_periodo"]["dias"].append(dias_al_corte)
        elif prop.vacancia_fecha < start:
            kpi_buckets["vacancias_anteriores"]["count"] += 1
            kpi_buckets["vacancias_anteriores"]["dias"].append(dias_al_corte)

        # Clasificar por estado actual
        if orden == 1:
            kpi_buckets["recibidas"]["count"] += 1
            kpi_buckets["recibidas"]["dias"].append(dias_al_corte)
        elif orden == 2:
            kpi_buckets["en_reparacion"]["count"] += 1
            kpi_buckets["en_reparacion"]["dias"].append(dias_al_corte)
        elif orden == 3:
            kpi_buckets["disponible"]["count"] += 1
            kpi_buckets["disponible"]["dias"].append(dias_al_corte)

    # Agregar realizada (sin días de vacancia pues ya no están vacantes)
    kpi_buckets["realizada"]["count"] = selectors["realizada"]["count"]

    # Construir KPIs serializables
    def _kpi(key: str) -> dict[str, Any]:
        b = kpi_buckets[key]
        dias = b["dias"] if "dias" in b else []
        cnt = b["count"]
        return {
            "count": cnt,
            "dias_vacancia_total": sum(dias),
            "dias_vacancia_promedio": round(sum(dias) / len(dias), 1) if dias else 0,
        }

    kpis: dict[str, Any] = {}
    for k in kpi_buckets:
        kpis[k] = _kpi(k)

    # Period summary
    vacancias_resueltas = _count_resueltas_en_periodo(
        session, start, end, tipo_operacion_id, emprendimiento_id
    )
    total_vacantes_fin = (
        selectors["recibida"]["count"]
        + selectors["en_reparacion"]["count"]
        + selectors["disponible"]["count"]
    )
    nuevas_vacancias = kpi_buckets["vacancias_periodo"]["count"]
    activas_inicio = total_vacantes_fin + vacancias_resueltas - nuevas_vacancias

    return {
        "range": {"startDate": start_date, "endDate": end_date},
        "filters": {
            "tipoOperacionId": tipo_operacion_id,
            "emprendimientoId": emprendimiento_id,
        },
        "kpis": kpis,
        "period_summary": {
            "activas_inicio": max(0, activas_inicio),
            "activas_fin": total_vacantes_fin,
            "netas": total_vacantes_fin - max(0, activas_inicio),
            "nuevas_vacancias": nuevas_vacancias,
            "vacancias_resueltas": vacancias_resueltas,
        },
        "selectors": selectors,
        "alerts": {
            "vencimiento_lt_60": venc_lt_60,
            "renovacion_lt_60": renov_lt_60,
        },
        "stats": {"sin_vacancia_fecha": sin_vacancia_fecha},
    }


def _build_trend_point(
    session: Session,
    start_date: str,
    end_date: str,
    period_type: str,
    tipo_operacion_id: Optional[int],
    emprendimiento_id: Optional[int],
) -> dict[str, Any]:
    """Genera un punto de tendencia (versión ligera sin period_summary detallado)."""
    start = _to_date_str(start_date)
    end = _to_date_str(end_date)

    rows = session.exec(
        _base_propiedad_query(session, tipo_operacion_id, emprendimiento_id)
    ).all()

    total_vacantes = 0
    nuevas = 0
    dias_list: list[int] = []

    for prop, status in rows:
        orden = status.orden if status else 999
        if orden not in (1, 2, 3):
            continue
        total_vacantes += 1
        if prop.vacancia_fecha:
            if start <= prop.vacancia_fecha <= end:
                nuevas += 1
            dias_al_corte = max(0, (end - prop.vacancia_fecha).days)
            dias_list.append(dias_al_corte)

    resueltas = _count_resueltas_en_periodo(
        session, start, end, tipo_operacion_id, emprendimiento_id
    )

    return {
        "bucket": _format_trend_label(start_date, period_type),
        "total_vacantes": total_vacantes,
        "nuevas": nuevas,
        "resueltas": resueltas,
        "promedio_dias": round(sum(dias_list) / len(dias_list), 1) if dias_list else 0,
    }


def build_prop_dashboard_bundle(
    session: Session,
    start_date: str,
    end_date: str,
    tipo_operacion_id: Optional[int] = None,
    emprendimiento_id: Optional[int] = None,
    period_type: str = "trimestre",
    trend_steps: str = "-3,-2,-1,0",
    previous_step: str = "-1",
) -> dict[str, Any]:
    """
    Retorna {current, previous, trend}.

    Estrategia:
      - 3 queries a DB: propiedades+status, tabla de estados, todos los logs.
      - En Python se reconstruyen intervalos de vacancia (start, end_o_None)
        por propiedad usando el historial completo de logs.
      - Cada período calcula días de vacancia como solapamiento del intervalo
        con el rango [start, end], lo que da datos históricos correctos incluso
        para propiedades que hoy están en Realizada/Retirada.
    """
    steps_list = _parse_int_list(trend_steps) or [-3, -2, -1, 0]
    prev_step = int(previous_step.strip()) if previous_step.strip() else -1
    prev_start, prev_end = _shift_dates(start_date, end_date, period_type, prev_step)

    # ── DB Query 1: propiedades + status (snapshot actual) ───────────────
    all_rows = session.exec(
        _base_propiedad_query(session, tipo_operacion_id, emprendimiento_id)
    ).all()

    # ── DB Query 2: tabla completa de estados para lookup orden ──────────
    all_statuses = session.exec(select(PropiedadesStatus)).all()
    status_by_id: dict[int, int] = {st.id: st.orden for st in all_statuses}

    # ── DB Query 3: TODOS los logs de las propiedades filtradas ──────────
    # Sin filtro de fecha ni de estado: necesitamos el historial completo
    # para reconstruir correctamente los intervalos de vacancia históricos.
    log_q = (
        select(
            PropiedadesLogStatus.propiedad_id,
            PropiedadesLogStatus.fecha_cambio,
            PropiedadesLogStatus.estado_nuevo_id,
        )
        .join(Propiedad, PropiedadesLogStatus.propiedad_id == Propiedad.id)
        .where(Propiedad.deleted_at.is_(None))
        .order_by(PropiedadesLogStatus.propiedad_id, PropiedadesLogStatus.fecha_cambio)
    )
    if tipo_operacion_id is not None:
        log_q = log_q.where(Propiedad.tipo_operacion_id == tipo_operacion_id)
    if emprendimiento_id is not None:
        log_q = log_q.where(Propiedad.emprendimiento_id == emprendimiento_id)
    all_log_rows = session.exec(log_q).all()

    # Agrupar logs por propiedad (ya vienen ordenados por fecha)
    logs_by_prop: dict[int, list[tuple[date, int]]] = {}
    for pid, fchange, new_status_id in all_log_rows:
        fc: date = fchange.date() if hasattr(fchange, "date") else fchange
        new_order = status_by_id.get(new_status_id, 999)
        logs_by_prop.setdefault(pid, []).append((fc, new_order))

    # ── Reconstruir intervalos de vacancia por propiedad ─────────────────
    # Un intervalo = (fecha_inicio_vacancia, fecha_fin_vacancia_o_None)
    # La vacancia comienza al entrar a Recibida (orden=1) desde un estado
    # no vacante, y termina al pasar a Realizada (4) o Retirada (5).
    # Las transiciones internas 1→2→3 no abren ni cierran el intervalo.

    _VACANT_ORDERS  = frozenset({1, 2, 3})
    _TERMINAL_ORDERS = frozenset({4, 5})

    def _build_intervals(
        prop_id: int,
        current_order: int,
        vacancia_fecha: Optional[date],
    ) -> list[tuple[date, Optional[date], int, bool, bool]]:
        """
        Retorna sub-intervalos de vacancia con estado:
          (v_start, v_end_or_none, state_order, is_cycle_start, is_cycle_end)
        - state_order    : orden del estado activo (1=Recibida, 2=EnRep, 3=Disponible)
        - is_cycle_start : True si abre un nuevo ciclo de vacancia (venía de terminal)
        - is_cycle_end   : True si el ciclo terminó al entrar a Realizada/Retirada
        """
        logs = logs_by_prop.get(prop_id, [])
        intervals: list[tuple[date, Optional[date], int, bool, bool]] = []
        current_start: Optional[date] = None
        current_state: Optional[int] = None
        is_cycle_start: bool = False

        for fecha, new_order in logs:
            if new_order in _VACANT_ORDERS:
                if current_start is None:
                    # Entra a vacancia desde estado no vacante
                    current_start = fecha
                    current_state = new_order
                    is_cycle_start = True
                else:
                    # Transición interna (1→2, 2→3, etc.) — cierra sub-intervalo y abre otro
                    intervals.append((current_start, fecha, current_state, is_cycle_start, False))
                    current_start = fecha
                    current_state = new_order
                    is_cycle_start = False
            elif new_order in _TERMINAL_ORDERS:
                if current_start is not None:
                    intervals.append((current_start, fecha, current_state, is_cycle_start, True))
                    current_start = None
                    current_state = None
                    is_cycle_start = False

        if current_start is not None:
            intervals.append((current_start, None, current_state, is_cycle_start, False))
        elif current_order in _VACANT_ORDERS and vacancia_fecha:
            # Fallback: la propiedad está vacante pero no hay log de entrada
            intervals.append((vacancia_fecha, None, current_order, True, False))

        return intervals

    vacancy_intervals: dict[int, list[tuple[date, Optional[date], int, bool, bool]]] = {}
    for prop, status in all_rows:
        current_order = status.orden if status else 999
        vf = prop.vacancia_fecha
        if isinstance(vf, datetime):
            vf = vf.date()
        vacancy_intervals[prop.id] = _build_intervals(prop.id, current_order, vf)

    # ── Helpers de cálculo (sin DB) ───────────────────────────────────────

    def _overlap_days(
        v_start: date,
        v_end: Optional[date],
        p_start: date,
        p_end: date,
    ) -> int:
        """Días de solapamiento entre el intervalo de vacancia y el período."""
        cap = v_end if v_end is not None else p_end
        return max(0, (min(cap, p_end) - max(v_start, p_start)).days)

    def _vacancy_stats_for_period(
        start: date,
        end: date,
    ) -> tuple[dict[int, int], int, set[int], set[int]]:
        """
        Calcula días de vacancia en [start, end] desglosados por estado.
        Retorna:
          days_by_state  – {order_id: total_dias}  (1=Recibida, 2=EnRep, 3=Disponible)
          count_vacantes – cantidad de propiedades distintas con al menos 1 día de vacancia
          nuevas_ids     – props cuyo ciclo de vacancia EMPEZÓ dentro del período
          resueltas_ids  – props cuyo ciclo de vacancia TERMINÓ dentro del período
        """
        days_by_state: dict[int, int] = {1: 0, 2: 0, 3: 0}
        props_con_dias: set[int] = set()
        nuevas_ids: set[int] = set()
        resueltas_ids: set[int] = set()

        for prop, _ in all_rows:
            for v_start, v_end, v_order, is_cycle_start, is_cycle_end in vacancy_intervals[prop.id]:
                days = _overlap_days(v_start, v_end, start, end)
                if days > 0:
                    days_by_state[v_order] += days
                    props_con_dias.add(prop.id)
                if is_cycle_start and start <= v_start <= end:
                    nuevas_ids.add(prop.id)
                if is_cycle_end and v_end is not None and start <= v_end <= end:
                    resueltas_ids.add(prop.id)

        return days_by_state, len(props_con_dias), nuevas_ids, resueltas_ids

    def _snapshot_selectors(end: date) -> dict[str, Any]:
        """
        Conteos de estado actual al corte de `end`.
        No depende del período — siempre refleja el estado actual de la BD.
        """
        selectors: dict[str, Any] = {
            "recibida":      {"count": 0},
            "en_reparacion": {"count": 0},
            "disponible":    {"count": 0},
            "realizada":     {"count": 0},
            "retirada":      {"count": 0, "lt_30": 0, "gt_30": 0},
        }

        for prop, status in all_rows:
            if not status:
                continue
            orden = status.orden
            nombre = (status.nombre or "").strip().lower()

            if "retirada" in nombre:
                selectors["retirada"]["count"] += 1
                if prop.estado_fecha:
                    days_since = (end - prop.estado_fecha).days
                    if days_since <= 30:
                        selectors["retirada"]["lt_30"] += 1
                    else:
                        selectors["retirada"]["gt_30"] += 1
            elif orden == 1:
                selectors["recibida"]["count"] += 1
            elif orden == 2:
                selectors["en_reparacion"]["count"] += 1
            elif orden == 3:
                selectors["disponible"]["count"] += 1
            elif orden == 4:
                selectors["realizada"]["count"] += 1

        return selectors

    def _compute_period(s_date: str, e_date: str) -> dict[str, Any]:
        start = _to_date_str(s_date)
        end   = _to_date_str(e_date)

        days_by_state, _, nuevas_ids, resueltas_ids = _vacancy_stats_for_period(start, end)
        selectors = _snapshot_selectors(end)

        total_dias = sum(days_by_state.values())
        total_vacantes = (
            selectors["recibida"]["count"]
            + selectors["en_reparacion"]["count"]
            + selectors["disponible"]["count"]
        )
        activas_inicio = max(0, total_vacantes + len(resueltas_ids) - len(nuevas_ids))

        return {
            "range":   {"startDate": s_date, "endDate": e_date},
            "filters": {"tipoOperacionId": tipo_operacion_id, "emprendimientoId": emprendimiento_id},
            "kpis": {
                # Días de vacancia acumulados dentro del período (basado en intervalos)
                "dias_vacancia_periodo": {
                    "total": total_dias,
                    "por_estado": {
                        "recibida":      days_by_state[1],
                        "en_reparacion": days_by_state[2],
                        "disponible":    days_by_state[3],
                    },
                },
            },
            "period_summary": {
                "activas_inicio":      activas_inicio,
                "activas_fin":         total_vacantes,
                "netas":               total_vacantes - activas_inicio,
                "nuevas_vacancias":    len(nuevas_ids),
                "vacancias_resueltas": len(resueltas_ids),
            },
        }

    def _compute_trend_point(s_date: str, e_date: str) -> dict[str, Any]:
        start = _to_date_str(s_date)
        end   = _to_date_str(e_date)

        days_by_state, count_vacantes, _, _ = _vacancy_stats_for_period(start, end)
        total_dias = sum(days_by_state.values())

        return {
            "bucket":          _format_trend_label(s_date, period_type),
            "count_vacantes":  count_vacantes,
            "dias_total":      total_dias,
        }

    # ── Construir resultado ───────────────────────────────────────────────
    current = _compute_period(start_date, end_date)

    # Solo necesitamos el total de días del período anterior para la variación
    prev_days_by_state, *_ = _vacancy_stats_for_period(
        _to_date_str(prev_start), _to_date_str(prev_end)
    )
    prev_total = sum(prev_days_by_state.values())

    cur_dias = current["kpis"]["dias_vacancia_periodo"]
    cur_dias["variacion_vs_anterior"] = (
        round((cur_dias["total"] - prev_total) / prev_total * 100, 1)
        if prev_total > 0 else None
    )

    trend = []
    for s in steps_list:
        s_start, s_end = _shift_dates(start_date, end_date, period_type, s)
        trend.append(_compute_trend_point(s_start, s_end))

    return {"current": current, "trend": trend}


def build_prop_selectors(
    session: Session,
    tipo_operacion_id: Optional[int] = None,
    emprendimiento_id: Optional[int] = None,
    pivot_date: Optional[date] = None,
) -> dict[str, Any]:
    """Consulta rápida de conteos por estado — sin carga de logs."""
    pivot = pivot_date or date.today()

    rows = session.exec(
        _base_propiedad_query(session, tipo_operacion_id, emprendimiento_id)
    ).all()

    result: dict[str, Any] = {
        "recibida":      {"count": 0},
        "en_reparacion": {"count": 0},
        "disponible":    {"count": 0},
        "realizada":     {"count": 0, "vencimiento_lt_60": 0, "renovacion_lt_60": 0},
        "retirada":      {"count": 0, "lt_30": 0, "gt_30": 0},
    }

    for prop, status in rows:
        if not status:
            continue
        orden = status.orden
        nombre = (status.nombre or "").strip().lower()

        if "retirada" in nombre:
            result["retirada"]["count"] += 1
            if prop.estado_fecha:
                days_since = (pivot - prop.estado_fecha).days
                if days_since <= 30:
                    result["retirada"]["lt_30"] += 1
                else:
                    result["retirada"]["gt_30"] += 1
        elif orden == 1:
            result["recibida"]["count"] += 1
        elif orden == 2:
            result["en_reparacion"]["count"] += 1
        elif orden == 3:
            result["disponible"]["count"] += 1
        elif orden == 4:
            result["realizada"]["count"] += 1
            if prop.vencimiento_contrato:
                d = (prop.vencimiento_contrato - pivot).days
                if 0 <= d < ALERT_DAYS:
                    result["realizada"]["vencimiento_lt_60"] += 1
            if prop.fecha_renovacion:
                if not prop.vencimiento_contrato or prop.fecha_renovacion <= prop.vencimiento_contrato:
                    d = (prop.fecha_renovacion - pivot).days
                    if 0 <= d < ALERT_DAYS:
                        result["realizada"]["renovacion_lt_60"] += 1

    result["pivotDate"] = pivot.isoformat()
    return result


def build_prop_detalle(
    session: Session,
    selector_key: str,
    sub_bucket: Optional[str] = None,
    page: int = 1,
    page_size: int = 15,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tipo_operacion_id: Optional[int] = None,
    emprendimiento_id: Optional[int] = None,
) -> dict[str, Any]:
    """Lista paginada para un selector (y sub-bucket) activado."""
    pivot = _to_date_str(end_date) if end_date else date.today()

    # Mapear selector_key a orden de estado
    orden_map: dict[str, list[int]] = {
        "recibida": [1],
        "en_reparacion": [2],
        "disponible": [3],
        "realizada": [4],
        "retirada": [5],
    }
    ordenes = orden_map.get(selector_key)
    if ordenes is None:
        return {"data": [], "total": 0, "page": page, "perPage": page_size}

    q = (
        select(Propiedad, PropiedadesStatus)
        .where(Propiedad.deleted_at.is_(None))
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
    )
    if tipo_operacion_id is not None:
        q = q.where(Propiedad.tipo_operacion_id == tipo_operacion_id)
    if emprendimiento_id is not None:
        q = q.where(Propiedad.emprendimiento_id == emprendimiento_id)
    if ordenes:
        q = q.where(PropiedadesStatus.orden.in_(ordenes))

    rows = session.exec(q).all()

    # Filtrar sub-bucket en Python (evita joins complejos)
    filtered = []
    for prop, status in rows:
        if sub_bucket == "vencimiento_lt_60":
            if not prop.vencimiento_contrato:
                continue
            d = (prop.vencimiento_contrato - pivot).days
            if not (0 <= d < ALERT_DAYS):
                continue
        elif sub_bucket == "renovacion_lt_60":
            if not prop.fecha_renovacion:
                continue
            if prop.vencimiento_contrato and prop.fecha_renovacion > prop.vencimiento_contrato:
                continue
            d = (prop.fecha_renovacion - pivot).days
            if not (0 <= d < ALERT_DAYS):
                continue
        elif sub_bucket == "lt_30":
            if not prop.estado_fecha:
                continue
            days_since = (pivot - prop.estado_fecha).days
            if days_since > 30:
                continue
        elif sub_bucket == "gt_30":
            if not prop.estado_fecha:
                continue
            days_since = (pivot - prop.estado_fecha).days
            if days_since <= 30:
                continue

        filtered.append((prop, status))

    total = len(filtered)
    offset = (page - 1) * page_size
    page_rows = filtered[offset: offset + page_size]

    items = []
    for prop, status in page_rows:
        dias_vacancia = (
            max(0, (pivot - prop.vacancia_fecha).days)
            if prop.vacancia_fecha
            else 0
        )
        items.append({
            "propiedad_id": prop.id,
            "nombre": prop.nombre,
            "propietario": prop.propietario,
            "tipo_propiedad_id": prop.tipo_propiedad_id,
            "tipo_actualizacion_id": prop.tipo_actualizacion_id,
            "tipo_operacion_id": prop.tipo_operacion_id,
            "propiedad_status_id": prop.propiedad_status_id,
            "estado": status.nombre if status else None,
            "estado_fecha": prop.estado_fecha.isoformat() if prop.estado_fecha else None,
            "vacancia_fecha": prop.vacancia_fecha.isoformat() if prop.vacancia_fecha else None,
            "dias_vacancia": dias_vacancia,
            "fecha_inicio_contrato": prop.fecha_inicio_contrato.isoformat() if prop.fecha_inicio_contrato else None,
            "vencimiento_contrato": prop.vencimiento_contrato.isoformat() if prop.vencimiento_contrato else None,
            "fecha_renovacion": prop.fecha_renovacion.isoformat() if prop.fecha_renovacion else None,
            "valor_alquiler": prop.valor_alquiler,
        })

    return {
        "data": items,
        "total": total,
        "page": page,
        "perPage": page_size,
    }


def build_prop_detalle_alerta(
    session: Session,
    alert_key: str,
    page: int = 1,
    page_size: int = 15,
    tipo_operacion_id: Optional[int] = None,
    emprendimiento_id: Optional[int] = None,
    pivot_date: Optional[date] = None,
) -> dict[str, Any]:
    """Lista paginada para alertas de vencimiento/renovación."""
    pivot = pivot_date or date.today()

    q = (
        select(Propiedad, PropiedadesStatus)
        .where(Propiedad.deleted_at.is_(None))
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
        .where(PropiedadesStatus.orden == 4)  # solo Realizadas
    )
    if tipo_operacion_id is not None:
        q = q.where(Propiedad.tipo_operacion_id == tipo_operacion_id)
    if emprendimiento_id is not None:
        q = q.where(Propiedad.emprendimiento_id == emprendimiento_id)

    rows = session.exec(q).all()

    filtered = []
    for prop, status in rows:
        if alert_key == "vencimiento_lt_60":
            if not prop.vencimiento_contrato:
                continue
            d = (prop.vencimiento_contrato - pivot).days
            if not (0 <= d < ALERT_DAYS):
                continue
        elif alert_key == "renovacion_lt_60":
            if not prop.fecha_renovacion:
                continue
            if prop.vencimiento_contrato and prop.fecha_renovacion > prop.vencimiento_contrato:
                continue
            d = (prop.fecha_renovacion - pivot).days
            if not (0 <= d < ALERT_DAYS):
                continue
        else:
            continue

        filtered.append((prop, status))

    total = len(filtered)
    offset = (page - 1) * page_size
    page_rows = filtered[offset: offset + page_size]

    items = []
    for prop, status in page_rows:
        dias_para_vencimiento = (
            (prop.vencimiento_contrato - pivot).days if prop.vencimiento_contrato else None
        )
        dias_para_renovacion = (
            (prop.fecha_renovacion - pivot).days if prop.fecha_renovacion else None
        )
        items.append({
            "propiedad_id": prop.id,
            "nombre": prop.nombre,
            "propietario": prop.propietario,
            "tipo_propiedad_id": prop.tipo_propiedad_id,
            "tipo_actualizacion_id": prop.tipo_actualizacion_id,
            "tipo_operacion_id": prop.tipo_operacion_id,
            "propiedad_status_id": prop.propiedad_status_id,
            "estado": status.nombre if status else None,
            "estado_fecha": prop.estado_fecha.isoformat() if prop.estado_fecha else None,
            "vacancia_fecha": prop.vacancia_fecha.isoformat() if prop.vacancia_fecha else None,
            "dias_vacancia": 0,
            "fecha_inicio_contrato": prop.fecha_inicio_contrato.isoformat() if prop.fecha_inicio_contrato else None,
            "vencimiento_contrato": prop.vencimiento_contrato.isoformat() if prop.vencimiento_contrato else None,
            "fecha_renovacion": prop.fecha_renovacion.isoformat() if prop.fecha_renovacion else None,
            "valor_alquiler": prop.valor_alquiler,
            "dias_para_vencimiento": dias_para_vencimiento,
            "dias_para_renovacion": dias_para_renovacion,
        })

    return {
        "data": items,
        "total": total,
        "page": page,
        "perPage": page_size,
    }
