from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.models.erp.cuenta import ErpCuenta
from app.models.erp.presupuesto import ErpPresupuesto
from app.models.erp.rubro import ErpRubro
from app.models.proyecto import Proyecto


ZERO = Decimal("0")


@dataclass(frozen=True)
class DashboardRange:
    start: date
    end: date


def _to_decimal(value: Decimal | int | float | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _to_float(value: Decimal | int | float | None) -> float:
    return float(_to_decimal(value))


def _month_key(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _month_end(value: date) -> date:
    next_month = _add_months(_month_start(value), 1)
    return next_month.fromordinal(next_month.toordinal() - 1)


def _period_close_date(period_end: date) -> date:
    next_month = _add_months(_month_start(period_end), 1)
    return date(next_month.year, next_month.month, 15)


def _build_period_status(period_end: date) -> dict[str, Any]:
    close_date = _period_close_date(period_end)
    today = date.today()
    is_closed = today >= close_date
    return {
        "estado": "cerrado" if is_closed else "abierto",
        "cerrado": is_closed,
        "fecha_cierre": close_date.isoformat(),
        "fecha_referencia": today.isoformat(),
    }


def _is_income_rubro(rubro_nombre: str | None) -> bool:
    return str(rubro_nombre or "").strip().lower() == "ingresos"


def _split_real_income(row: Any) -> tuple[Decimal, Decimal]:
    real_ingreso = _to_decimal(row.real_ingreso)
    if _is_income_rubro(row.rubro_nombre):
        return real_ingreso, ZERO
    return ZERO, real_ingreso


def _budget_income(row: Any) -> Decimal:
    return _to_decimal(row.ingres)


def _add_months(value: date, months: int) -> date:
    year = value.year + ((value.month - 1 + months) // 12)
    month = ((value.month - 1 + months) % 12) + 1
    return date(year, month, 1)


def _iter_months(start: date, end: date) -> list[str]:
    cursor = _month_start(start)
    stop = _month_start(end)
    months: list[str] = []
    while cursor <= stop:
        months.append(_month_key(cursor))
        cursor = _add_months(cursor, 1)
    return months


def _previous_period_range(period: DashboardRange, selector_periodo: str) -> DashboardRange:
    months_by_selector = {
        "mensual": 1,
        "trimestral": 3,
        "semestral": 6,
        "anual": 12,
    }
    months = months_by_selector.get(selector_periodo, 1)
    previous_start = _add_months(_month_start(period.start), -months)
    previous_end = period.start.fromordinal(period.start.toordinal() - 1)
    return DashboardRange(start=previous_start, end=previous_end)


def _pct_change(current: Decimal, previous: Decimal) -> float:
    if previous == 0:
        if current == 0:
            return 0.0
        return 100.0 if current > 0 else -100.0
    return float(((current - previous) / previous) * Decimal("100"))


def _margin(ingresos: Decimal, resultado: Decimal) -> float:
    if ingresos == 0:
        return 0.0
    return float((resultado / ingresos) * Decimal("100"))


def _parse_int_list(value: str | None) -> list[int] | None:
    if not value:
        return None
    parsed: list[int] = []
    for chunk in value.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            parsed.append(int(chunk))
        except ValueError:
            continue
    return parsed or None


def _parse_str_list(value: str | None) -> list[str] | None:
    if not value:
        return None
    parsed = [chunk.strip() for chunk in value.split(",") if chunk.strip()]
    return parsed or None


def _sum_totals(rows: list[Any]) -> dict[str, Decimal]:
    ingresos = sum((_split_real_income(row)[0] for row in rows), ZERO)
    ingresos_manuales = sum((_split_real_income(row)[1] for row in rows), ZERO)
    egresos = sum((_to_decimal(row.real_egreso) for row in rows), ZERO)
    resultado = ingresos - egresos
    return {
        "ingresos": ingresos,
        "ingresos_manuales": ingresos_manuales,
        "egresos": egresos,
        "resultado": resultado,
        "margen": Decimal(str(_margin(ingresos, resultado))),
    }


def _fetch_rows(
    session: Session,
    period: DashboardRange,
    *,
    proyecto_ids: list[int] | None,
    estados: list[str | None] | None,
) -> list[Any]:
    stmt = (
        select(
            ErpPresupuesto.fecha,
            ErpPresupuesto.proyecto_id,
            ErpPresupuesto.erp_cuenta_id,
            ErpPresupuesto.ingres,
            ErpPresupuesto.egreso,
            ErpPresupuesto.real_ingreso,
            ErpPresupuesto.real_egreso,
            Proyecto.nombre.label("proyecto_nombre"),
            Proyecto.estado.label("proyecto_estado"),
            ErpCuenta.descripcion.label("cuenta_descripcion"),
            ErpRubro.nombre.label("rubro_nombre"),
        )
        .join(Proyecto, Proyecto.id == ErpPresupuesto.proyecto_id)
        .join(ErpCuenta, ErpCuenta.id == ErpPresupuesto.erp_cuenta_id)
        .outerjoin(ErpRubro, ErpRubro.id == ErpCuenta.rubro_id)
        .where(ErpPresupuesto.deleted_at.is_(None))
        .where(Proyecto.deleted_at.is_(None))
        .where(ErpPresupuesto.fecha >= period.start)
        .where(ErpPresupuesto.fecha <= period.end)
    )
    if proyecto_ids:
        stmt = stmt.where(ErpPresupuesto.proyecto_id.in_(proyecto_ids))
    if estados:
        non_null_estados = [estado for estado in estados if estado is not None]
        if None in estados and non_null_estados:
            stmt = stmt.where(or_(Proyecto.estado.in_(non_null_estados), Proyecto.estado.is_(None)))
        elif None in estados:
            stmt = stmt.where(Proyecto.estado.is_(None))
        else:
            stmt = stmt.where(Proyecto.estado.in_(non_null_estados))
    return list(session.exec(stmt).all())


def _fetch_project_options(session: Session) -> list[dict[str, Any]]:
    stmt = (
        select(Proyecto.id, Proyecto.nombre)
        .where(Proyecto.deleted_at.is_(None))
        .order_by(Proyecto.nombre)
    )
    return [
        {"id": row.id, "nombre": row.nombre or f"Proyecto {row.id}"}
        for row in session.exec(stmt).all()
    ]


def _fetch_estado_options(session: Session) -> list[dict[str, Any]]:
    stmt = (
        select(Proyecto.estado, func.count(Proyecto.id).label("total"))
        .where(Proyecto.deleted_at.is_(None))
        .group_by(Proyecto.estado)
        .order_by(Proyecto.estado)
    )
    return [
        {"value": row.estado or "Sin estado", "label": row.estado or "Sin estado", "total": row.total}
        for row in session.exec(stmt).all()
    ]


def build_erp_financial_dashboard_payload(
    session: Session,
    *,
    start_date: str,
    end_date: str,
    selector_periodo: str = "mensual",
    proyecto: str | None = None,
    estado: str | None = None,
) -> dict[str, Any]:
    period = DashboardRange(start=date.fromisoformat(start_date), end=date.fromisoformat(end_date))
    if period.end < period.start:
        raise ValueError("endDate debe ser mayor o igual a startDate")

    proyecto_ids = _parse_int_list(proyecto)
    estados: list[str | None] | None = _parse_str_list(estado)
    if estados and "Sin estado" in estados:
        estados = [value for value in estados if value != "Sin estado"] + [None]  # type: ignore[list-item]

    previous_period = _previous_period_range(period, selector_periodo)

    rows = _fetch_rows(
        session,
        period,
        proyecto_ids=proyecto_ids,
        estados=estados,  # type: ignore[arg-type]
    )
    previous_rows = _fetch_rows(
        session,
        previous_period,
        proyecto_ids=proyecto_ids,
        estados=estados,  # type: ignore[arg-type]
    )

    totals = _sum_totals(rows)
    previous_totals = _sum_totals(previous_rows)
    previous_margin = _margin(previous_totals["ingresos"], previous_totals["resultado"])
    current_margin = _margin(totals["ingresos"], totals["resultado"])

    by_project: dict[int, dict[str, Any]] = {}
    previous_by_project: dict[int, dict[str, Decimal]] = defaultdict(
        lambda: {"ingresos": ZERO, "egresos": ZERO, "resultado": ZERO}
    )
    by_rubro: dict[str, dict[str, Any]] = {}
    previous_by_rubro: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"ingresos": ZERO, "egresos": ZERO, "resultado": ZERO}
    )
    open_window_by_project: dict[int, dict[str, Decimal]] = defaultdict(
        lambda: {
            "real": ZERO,
            "presupuestado": ZERO,
            "ingresos_real": ZERO,
            "ingresos_presupuestado": ZERO,
        }
    )
    deviations: dict[tuple[str, int], dict[str, Any]] = {}
    costs_by_rubro: dict[str, dict[str, Any]] = {}

    for row in rows:
        project_id = int(row.proyecto_id)
        project_entry = by_project.setdefault(
            project_id,
            {
                "proyecto_id": project_id,
                "proyecto": row.proyecto_nombre or f"Proyecto {project_id}",
                "estado": row.proyecto_estado or "Sin estado",
                "ingresos": ZERO,
                "ingresos_manuales": ZERO,
                "egresos": ZERO,
                "resultado": ZERO,
                "presupuesto_ingresos": ZERO,
                "presupuesto_egresos": ZERO,
            },
        )
        real_ingreso_contable, real_ingreso_manual = _split_real_income(row)
        real_egreso = _to_decimal(row.real_egreso)
        presupuesto_ingreso = _to_decimal(row.ingres)
        presupuesto_egreso = _to_decimal(row.egreso)
        result = real_ingreso_contable - real_egreso

        project_entry["ingresos"] += real_ingreso_contable
        project_entry["ingresos_manuales"] += real_ingreso_manual
        project_entry["egresos"] += real_egreso
        project_entry["resultado"] += result
        project_entry["presupuesto_ingresos"] += presupuesto_ingreso
        project_entry["presupuesto_egresos"] += presupuesto_egreso

        deviation_key = (row.rubro_nombre or row.cuenta_descripcion or "Sin rubro", project_id)
        deviation_entry = deviations.setdefault(
            deviation_key,
            {
                "rubro": deviation_key[0],
                "proyecto": project_entry["proyecto"],
                "presupuesto_egreso": ZERO,
                "real_egreso": ZERO,
            },
        )
        deviation_entry["presupuesto_egreso"] += presupuesto_egreso
        deviation_entry["real_egreso"] += real_egreso

        rubro_name = row.rubro_nombre or row.cuenta_descripcion or "Sin rubro"
        if not _is_income_rubro(rubro_name):
            rubro_deviation_entry = by_rubro.setdefault(
                rubro_name,
                {
                    "rubro": rubro_name,
                    "ingresos": ZERO,
                    "egresos": ZERO,
                    "resultado": ZERO,
                    "presupuesto_ingresos": ZERO,
                    "presupuesto_egresos": ZERO,
                },
            )
            rubro_deviation_entry["ingresos"] += real_ingreso_manual
            rubro_deviation_entry["egresos"] += real_egreso
            rubro_deviation_entry["resultado"] += real_ingreso_manual - real_egreso
            rubro_deviation_entry["presupuesto_ingresos"] += presupuesto_ingreso
            rubro_deviation_entry["presupuesto_egresos"] += presupuesto_egreso

        rubro_entry = costs_by_rubro.setdefault(
            rubro_name,
            {
                "rubro": rubro_name,
                "egreso_real": ZERO,
                "ingreso_presupuestado": ZERO,
                "egreso_presupuestado": ZERO,
                "ingreso_manual": ZERO,
                "proyecto_ids": set(),
            },
        )
        rubro_entry["egreso_real"] += real_egreso
        rubro_entry["ingreso_presupuestado"] += presupuesto_ingreso
        rubro_entry["egreso_presupuestado"] += presupuesto_egreso
        rubro_entry["ingreso_manual"] += real_ingreso_manual
        if real_egreso or presupuesto_ingreso or presupuesto_egreso or real_ingreso_manual:
            rubro_entry["proyecto_ids"].add(project_id)

    project_ids = list(by_project)
    evolution_start = _add_months(_month_start(period.end), -3)
    evolution_end = _month_end(_add_months(_month_start(period.end), 3))
    evolution_rows = _fetch_rows(
        session,
        DashboardRange(start=evolution_start, end=evolution_end),
        proyecto_ids=proyecto_ids,
        estados=estados,  # type: ignore[arg-type]
    )
    for row in previous_rows:
        real_ingreso_contable, real_ingreso_manual = _split_real_income(row)
        real_egreso = _to_decimal(row.real_egreso)
        project_previous = previous_by_project[int(row.proyecto_id)]
        project_previous["ingresos"] += real_ingreso_contable
        project_previous["egresos"] += real_egreso
        project_previous["resultado"] += real_ingreso_contable - real_egreso
        rubro_name = row.rubro_nombre or row.cuenta_descripcion or "Sin rubro"
        if not _is_income_rubro(rubro_name):
            rubro_previous = previous_by_rubro[rubro_name]
            rubro_previous["ingresos"] += real_ingreso_manual
            rubro_previous["egresos"] += real_egreso
            rubro_previous["resultado"] += real_ingreso_manual - real_egreso

    resultado_por_proyecto = sorted(
        [
            {
                "proyecto_id": item["proyecto_id"],
                "proyecto": item["proyecto"],
                "resultado": _to_float(item["resultado"]),
            }
            for item in by_project.values()
        ],
        key=lambda item: item["resultado"],
    )

    desvios_por_proyecto = sorted(
        [
            {
                "proyecto_id": item["proyecto_id"],
                "proyecto": item["proyecto"],
                "ingresos": {
                    "anterior": _to_float(previous_by_project[item["proyecto_id"]]["ingresos"]),
                    "real": _to_float(item["ingresos"]),
                    "presupuestado": _to_float(item["presupuesto_ingresos"]),
                    "dif": _to_float(item["ingresos"] - item["presupuesto_ingresos"]),
                    "var": _pct_change(item["ingresos"], item["presupuesto_ingresos"]),
                },
                "egresos": {
                    "anterior": _to_float(previous_by_project[item["proyecto_id"]]["egresos"]),
                    "real": _to_float(item["egresos"]),
                    "presupuestado": _to_float(item["presupuesto_egresos"]),
                    "dif": _to_float(item["egresos"] - item["presupuesto_egresos"]),
                    "var": _pct_change(item["egresos"], item["presupuesto_egresos"]),
                },
                "resultado": {
                    "anterior": _to_float(previous_by_project[item["proyecto_id"]]["resultado"]),
                    "real": _to_float(item["resultado"]),
                    "presupuestado": _to_float(
                        item["presupuesto_ingresos"] - item["presupuesto_egresos"]
                    ),
                    "dif": _to_float(
                        item["resultado"]
                        - (item["presupuesto_ingresos"] - item["presupuesto_egresos"])
                    ),
                    "var": _pct_change(
                        item["resultado"],
                        item["presupuesto_ingresos"] - item["presupuesto_egresos"],
                    ),
                },
            }
            for item in by_project.values()
        ],
        key=lambda item: item["proyecto"],
    )

    desvios_por_rubro = sorted(
        [
            {
                "rubro": item["rubro"],
                "ingresos": {
                    "anterior": _to_float(previous_by_rubro[item["rubro"]]["ingresos"]),
                    "real": _to_float(item["ingresos"]),
                    "presupuestado": _to_float(item["presupuesto_ingresos"]),
                    "dif": _to_float(item["ingresos"] - item["presupuesto_ingresos"]),
                    "var": _pct_change(item["ingresos"], item["presupuesto_ingresos"]),
                },
                "egresos": {
                    "anterior": _to_float(previous_by_rubro[item["rubro"]]["egresos"]),
                    "real": _to_float(item["egresos"]),
                    "presupuestado": _to_float(item["presupuesto_egresos"]),
                    "dif": _to_float(item["egresos"] - item["presupuesto_egresos"]),
                    "var": _pct_change(item["egresos"], item["presupuesto_egresos"]),
                },
                "resultado": {
                    "anterior": _to_float(previous_by_rubro[item["rubro"]]["resultado"]),
                    "real": _to_float(item["resultado"]),
                    "presupuestado": _to_float(
                        item["presupuesto_ingresos"] - item["presupuesto_egresos"]
                    ),
                    "dif": _to_float(
                        item["resultado"]
                        - (item["presupuesto_ingresos"] - item["presupuesto_egresos"])
                    ),
                    "var": _pct_change(
                        item["resultado"],
                        item["presupuesto_ingresos"] - item["presupuesto_egresos"],
                    ),
                },
            }
            for item in by_rubro.values()
        ],
        key=lambda item: item["rubro"],
    )

    top_desvios = []
    for entry in deviations.values():
        presupuesto = entry["presupuesto_egreso"]
        real = entry["real_egreso"]
        if presupuesto <= 0 or real <= presupuesto:
            continue
        desvio = presupuesto - real
        top_desvios.append(
            {
                "rubro": entry["rubro"],
                "proyecto": entry["proyecto"],
                "desvio": _to_float(desvio),
                "desvio_pct": _to_float((desvio / presupuesto) * Decimal("100")),
            }
        )
    top_desvios = sorted(top_desvios, key=lambda item: item["desvio_pct"])[:5]

    resultado_por_rubro = []
    for entry in costs_by_rubro.values():
        presupuesto = entry["egreso_presupuestado"]
        presupuesto_ingreso = entry["ingreso_presupuestado"]
        real = entry["egreso_real"]
        ingreso_manual = entry["ingreso_manual"]
        if real == 0 and presupuesto_ingreso == 0 and presupuesto == 0 and ingreso_manual == 0:
            continue
        desvio = real - presupuesto
        desvio_pct = ZERO if presupuesto == 0 else (desvio / presupuesto) * Decimal("100")
        resultado = ingreso_manual - real
        resultado_presupuestado = presupuesto_ingreso - presupuesto
        resultado_por_rubro.append(
            {
                "rubro": entry["rubro"],
                "egreso_real": _to_float(real),
                "ingreso_presupuestado": _to_float(presupuesto_ingreso),
                "egreso_presupuestado": _to_float(presupuesto),
                "ingreso_manual": _to_float(ingreso_manual),
                "resultado": _to_float(resultado),
                "resultado_presupuestado": _to_float(resultado_presupuestado),
                "desvio": _to_float(desvio),
                "desvio_pct": _to_float(desvio_pct),
                "proyectos_count": len(entry["proyecto_ids"]),
            }
        )
    resultado_por_rubro = sorted(
        resultado_por_rubro,
        key=lambda item: abs(item["resultado"]),
        reverse=True,
    )

    evolution_by_month: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {
            "real_ingresos": ZERO,
            "real_egresos": ZERO,
            "real_resultado": ZERO,
            "presupuesto_ingresos": ZERO,
            "presupuesto_egresos": ZERO,
            "presupuesto_resultado": ZERO,
        }
    )
    open_evolution_months: set[str] = set()
    for month in _iter_months(evolution_start, evolution_end):
        year, month_number = month.split("-", maxsplit=1)
        month_date = date(int(year), int(month_number), 1)
        if not _build_period_status(_month_end(month_date))["cerrado"]:
            open_evolution_months.add(month)

    for row in evolution_rows:
        month = _month_key(row.fecha)
        real_ingreso_contable, _real_ingreso_manual = _split_real_income(row)
        real_egreso = _to_decimal(row.real_egreso)
        presupuesto_ingreso = _budget_income(row)
        presupuesto_egreso = _to_decimal(row.egreso)

        evolution_by_month[month]["real_ingresos"] += real_ingreso_contable
        evolution_by_month[month]["real_egresos"] += real_egreso
        evolution_by_month[month]["real_resultado"] += real_ingreso_contable - real_egreso
        evolution_by_month[month]["presupuesto_ingresos"] += presupuesto_ingreso
        evolution_by_month[month]["presupuesto_egresos"] += presupuesto_egreso
        evolution_by_month[month]["presupuesto_resultado"] += presupuesto_ingreso - presupuesto_egreso
        if month in open_evolution_months:
            project_window = open_window_by_project[int(row.proyecto_id)]
            project_window["real"] += real_ingreso_contable - real_egreso
            project_window["presupuestado"] += presupuesto_ingreso - presupuesto_egreso
            project_window["ingresos_real"] += real_ingreso_contable
            project_window["ingresos_presupuestado"] += presupuesto_ingreso

    evolucion = []
    for month in _iter_months(evolution_start, evolution_end):
        year, month_number = month.split("-", maxsplit=1)
        month_date = date(int(year), int(month_number), 1)
        month_status = _build_period_status(_month_end(month_date))
        month_values = evolution_by_month[month]
        is_closed = bool(month_status["cerrado"])
        evolucion.append(
            {
                "periodo": month,
                "estado": month_status["estado"],
                "cerrado": is_closed,
                "ingresos": _to_float(
                    month_values["real_ingresos"] if is_closed else month_values["presupuesto_ingresos"]
                ),
                "egresos": _to_float(
                    month_values["real_egresos"] if is_closed else month_values["presupuesto_egresos"]
                ),
                "resultado": _to_float(
                    month_values["real_resultado"] if is_closed else month_values["presupuesto_resultado"]
                ),
                "ingresos_real": _to_float(month_values["real_ingresos"]) if is_closed else None,
                "egresos_real": _to_float(month_values["real_egresos"]) if is_closed else None,
                "resultado_real": _to_float(month_values["real_resultado"]) if is_closed else None,
                "ingresos_presupuestado": (
                    None if is_closed else _to_float(month_values["presupuesto_ingresos"])
                ),
                "egresos_presupuestado": (
                    None if is_closed else _to_float(month_values["presupuesto_egresos"])
                ),
                "resultado_presupuestado": (
                    None if is_closed else _to_float(month_values["presupuesto_resultado"])
                ),
            }
        )

    resumen = sorted(
        [
            {
                "proyecto_id": item["proyecto_id"],
                "proyecto": item["proyecto"],
                "acumulado_ingresos": _to_float(item["ingresos"]),
                "acumulado_ingresos_manuales": _to_float(item["ingresos_manuales"]),
                "acumulado_egresos": _to_float(item["egresos"]),
                "acumulado_resultado": _to_float(item["resultado"]),
                "variacion_ingresos_pct": _pct_change(
                    item["ingresos"],
                    previous_by_project[item["proyecto_id"]]["ingresos"],
                ),
                "variacion_egresos_pct": _pct_change(
                    item["egresos"],
                    previous_by_project[item["proyecto_id"]]["egresos"],
                ),
                "variacion_resultado_pct": _pct_change(
                    item["resultado"],
                    previous_by_project[item["proyecto_id"]]["resultado"],
                ),
                "ventana_abierta_real": _to_float(open_window_by_project[item["proyecto_id"]]["real"]),
                "ventana_abierta_presupuestado": _to_float(
                    open_window_by_project[item["proyecto_id"]]["presupuestado"]
                ),
                "ventana_abierta_total": _to_float(
                    open_window_by_project[item["proyecto_id"]]["real"]
                    + open_window_by_project[item["proyecto_id"]]["presupuestado"]
                ),
                "ventana_abierta_ingresos_total": _to_float(
                    open_window_by_project[item["proyecto_id"]]["ingresos_real"]
                    + open_window_by_project[item["proyecto_id"]]["ingresos_presupuestado"]
                ),
                "margen_total_esperado": _margin(
                    open_window_by_project[item["proyecto_id"]]["ingresos_real"]
                    + open_window_by_project[item["proyecto_id"]]["ingresos_presupuestado"],
                    open_window_by_project[item["proyecto_id"]]["real"]
                    + open_window_by_project[item["proyecto_id"]]["presupuestado"],
                ),
                "estado": item["estado"],
            }
            for item in by_project.values()
        ],
        key=lambda item: item["proyecto"],
    )
    presupuesto_ingresos_total = sum((item["presupuesto_ingresos"] for item in by_project.values()), ZERO)
    presupuesto_egresos_total = sum((item["presupuesto_egresos"] for item in by_project.values()), ZERO)
    presupuesto_resultado_total = presupuesto_ingresos_total - presupuesto_egresos_total

    return {
        "periodo": {
            "start": start_date,
            "end": end_date,
            "estado": _build_period_status(period.end),
        },
        "filtros": {"proyecto": proyecto_ids, "estado": estados},
        "kpis": {
            "ingresos_acumulados": _to_float(totals["ingresos"]),
            "ingresos_manuales": _to_float(totals["ingresos_manuales"]),
            "egresos_acumulados": _to_float(totals["egresos"]),
            "resultado_acumulado": _to_float(totals["resultado"]),
            "margen_promedio": current_margin,
            "presupuestos": {
                "ingresos": _to_float(presupuesto_ingresos_total),
                "egresos": _to_float(presupuesto_egresos_total),
                "resultado": _to_float(presupuesto_resultado_total),
            },
            "desvios": {
                "ingresos": _to_float(totals["ingresos"] - presupuesto_ingresos_total),
                "egresos": _to_float(totals["egresos"] - presupuesto_egresos_total),
                "resultado": _to_float(totals["resultado"] - presupuesto_resultado_total),
            },
            "comparativos": {
                "ingresos_pct": _pct_change(totals["ingresos"], previous_totals["ingresos"]),
                "egresos_pct": _pct_change(totals["egresos"], previous_totals["egresos"]),
                "resultado_pct": _pct_change(totals["resultado"], previous_totals["resultado"]),
                "margen_pp": current_margin - previous_margin,
            },
        },
        "resultado_por_proyecto": resultado_por_proyecto,
        "desvios_por_proyecto": desvios_por_proyecto,
        "desvios_por_rubro": desvios_por_rubro,
        "top_desvios_negativos": top_desvios,
        "resultado_por_rubro": resultado_por_rubro,
        "costo_por_rubro": resultado_por_rubro,
        "evolucion_mensual": evolucion,
        "resumen_por_proyecto": resumen,
        "selectors": {
            "proyectos": _fetch_project_options(session),
            "estados": _fetch_estado_options(session),
        },
    }
