#!/usr/bin/env python3

from __future__ import annotations

import math
from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlmodel import Session, select

from app.db import engine
from app.models.proyecto import Proyecto
from app.models.proyecto_avance import ProyectoAvance
from app.models.views.kpis_proyectos import VwKpisProyectosPoOrders


PERIOD_START = date(2025, 3, 1)
PERIOD_END = date(2026, 3, 31)
UPLIFT_FACTORS = (
    Decimal("1.08"),
    Decimal("1.10"),
    Decimal("1.12"),
    Decimal("1.14"),
    Decimal("1.16"),
)
ZERO_COST_BASE_SHARE = Decimal("0.03")
MIN_ZERO_COST_IMPORTE = Decimal("250000.00")
MIN_HOURS = 120
MAX_HOURS = 420


def month_end(year: int, month: int) -> date:
    return date(year, month, monthrange(year, month)[1])


def iter_month_ends(start: date, end: date) -> list[date]:
    months: list[date] = []
    current = date(start.year, start.month, 1)
    while current <= end:
        months.append(month_end(current.year, current.month))
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)
    return months


def month_code(value: date) -> str:
    return value.strftime("%Y-%m")


def decimal_to_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def decimal_to_progress(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass
class ExistingMonthPoint:
    month_index: int
    avance: Decimal


def resolve_prev_next_points(
    current_index: int,
    ordered_points: list[ExistingMonthPoint],
) -> tuple[ExistingMonthPoint | None, ExistingMonthPoint | None]:
    prev_point: ExistingMonthPoint | None = None
    next_point: ExistingMonthPoint | None = None
    for point in ordered_points:
        if point.month_index < current_index:
            prev_point = point
            continue
        if point.month_index > current_index:
            next_point = point
            break
    return prev_point, next_point


def interpolate_progress(
    current_index: int,
    ordered_points: list[ExistingMonthPoint],
) -> Decimal:
    prev_point, next_point = resolve_prev_next_points(current_index, ordered_points)

    if prev_point and next_point:
        span = next_point.month_index - prev_point.month_index
        if span > 0:
            position = current_index - prev_point.month_index
            delta = next_point.avance - prev_point.avance
            return decimal_to_progress(prev_point.avance + (delta * Decimal(position) / Decimal(span)))

    if prev_point:
        return decimal_to_progress(prev_point.avance)

    if next_point:
        return decimal_to_progress(next_point.avance)

    return Decimal("0.00")


def build_comment(period_label: str, importe: Decimal, cost_base: Decimal) -> str:
    return (
        f"Avance mensual generado automaticamente para {period_label}. "
        f"Importe ajustado sobre costo mensual base {decimal_to_money(cost_base):,.2f}."
    )


def main() -> None:
    month_dates = iter_month_ends(PERIOD_START, PERIOD_END)
    month_index_by_code = {month_code(value): index for index, value in enumerate(month_dates)}

    with Session(engine) as session:
        proyectos = session.exec(
            select(Proyecto).where(
                Proyecto.estado == "02-ejecucion",
                Proyecto.deleted_at.is_(None),
            )
        ).all()

        proyectos_ids = [proyecto.id for proyecto in proyectos]
        if not proyectos_ids:
            print("No hay proyectos en estado 02-ejecucion.")
            return

        avances_existentes = session.exec(
            select(ProyectoAvance).where(
                ProyectoAvance.proyecto_id.in_(proyectos_ids),
                ProyectoAvance.fecha_registracion >= PERIOD_START,
                ProyectoAvance.fecha_registracion <= PERIOD_END,
            )
        ).all()

        costos_rows = session.exec(
            select(VwKpisProyectosPoOrders).where(
                VwKpisProyectosPoOrders.proyecto_id.in_(proyectos_ids),
                VwKpisProyectosPoOrders.fecha_emision >= PERIOD_START,
                VwKpisProyectosPoOrders.fecha_emision <= PERIOD_END,
            )
        ).all()

        existing_periods: dict[int, set[str]] = {proyecto_id: set() for proyecto_id in proyectos_ids}
        existing_month_points: dict[int, dict[str, Decimal]] = {proyecto_id: {} for proyecto_id in proyectos_ids}
        existing_hour_values: dict[int, list[int]] = {proyecto_id: [] for proyecto_id in proyectos_ids}
        existing_importe_values: dict[int, list[Decimal]] = {proyecto_id: [] for proyecto_id in proyectos_ids}

        for avance in avances_existentes:
            period = month_code(avance.fecha_registracion)
            existing_periods.setdefault(avance.proyecto_id, set()).add(period)
            month_avance = Decimal(avance.avance or 0)
            current_max = existing_month_points.setdefault(avance.proyecto_id, {}).get(period)
            if current_max is None or month_avance > current_max:
                existing_month_points[avance.proyecto_id][period] = month_avance
            existing_hour_values.setdefault(avance.proyecto_id, []).append(int(avance.horas or 0))
            existing_importe_values.setdefault(avance.proyecto_id, []).append(Decimal(avance.importe or 0))

        costos_por_mes: dict[int, dict[str, Decimal]] = {proyecto_id: {} for proyecto_id in proyectos_ids}
        for row in costos_rows:
            period = month_code(row.fecha_emision)
            project_costs = costos_por_mes.setdefault(row.proyecto_id, {})
            project_costs[period] = project_costs.get(period, Decimal("0")) + Decimal(row.importe or 0)

        nuevos_avances: list[ProyectoAvance] = []

        for proyecto in sorted(proyectos, key=lambda item: item.id):
            project_id = proyecto.id
            ordered_points = sorted(
                (
                    ExistingMonthPoint(month_index=month_index_by_code[period], avance=avance)
                    for period, avance in existing_month_points.get(project_id, {}).items()
                    if period in month_index_by_code
                ),
                key=lambda point: point.month_index,
            )

            positive_month_costs = [
                amount
                for amount in costos_por_mes.get(project_id, {}).values()
                if amount > 0
            ]
            avg_positive_cost = (
                sum(positive_month_costs, Decimal("0")) / Decimal(len(positive_month_costs))
                if positive_month_costs
                else Decimal("1000000")
            )

            hour_values = [value for value in existing_hour_values.get(project_id, []) if value > 0]
            avg_hours = (
                sum(hour_values) / len(hour_values)
                if hour_values
                else 240
            )
            importe_values = [value for value in existing_importe_values.get(project_id, []) if value > 0]
            avg_importe = (
                sum(importe_values, Decimal("0")) / Decimal(len(importe_values))
                if importe_values
                else avg_positive_cost
            )

            for month_index, month_date in enumerate(month_dates):
                period = month_code(month_date)
                if period in existing_periods.get(project_id, set()):
                    continue

                base_cost = costos_por_mes.get(project_id, {}).get(period, Decimal("0"))
                factor = UPLIFT_FACTORS[(project_id + month_index) % len(UPLIFT_FACTORS)]

                if base_cost > 0:
                    importe = decimal_to_money(base_cost * factor)
                    cost_reference = base_cost
                else:
                    cost_reference = decimal_to_money(avg_positive_cost * ZERO_COST_BASE_SHARE)
                    if cost_reference < MIN_ZERO_COST_IMPORTE:
                        cost_reference = MIN_ZERO_COST_IMPORTE
                    importe = decimal_to_money(cost_reference * factor)

                avance = interpolate_progress(month_index, ordered_points)
                hour_ratio = math.sqrt(float(importe / (avg_importe if avg_importe > 0 else Decimal("1"))))
                horas = int(round(avg_hours * hour_ratio))
                horas = max(MIN_HOURS, min(MAX_HOURS, horas))

                nuevos_avances.append(
                    ProyectoAvance(
                        proyecto_id=project_id,
                        horas=horas,
                        avance=avance,
                        importe=importe,
                        comentario=build_comment(period, importe, cost_reference),
                        fecha_registracion=month_date,
                    )
                )

                print(
                    f"Proyecto {project_id} | {period} | avance={avance:.2f}% | "
                    f"importe={importe:,.2f} | horas={horas}"
                )

        if not nuevos_avances:
            print("No hay meses faltantes para completar.")
            return

        session.add_all(nuevos_avances)
        session.commit()

        print(f"\nSe generaron {len(nuevos_avances)} avances nuevos.")


if __name__ == "__main__":
    main()
