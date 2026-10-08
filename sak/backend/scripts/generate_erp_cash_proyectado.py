#!/usr/bin/env python
"""Genera proyecciones mensuales Cash a partir de movimientos reales.

Metodologia:
- toma cuentas financieras tipo Ingreso o Egreso con movimientos reales;
- determina el tramo real continuo desde el periodo inicial hasta el ultimo mes cargado;
- para meses con historia homologa usa el promedio de esos meses;
- para meses sin historia homologa usa el promedio mensual de todo el tramo real;
- no aplica crecimiento, inflacion ni ajustes discrecionales.

Uso:
    python scripts/generate_erp_cash_proyectado.py --start 2026-01 --months 24 --dry-run
    python scripts/generate_erp_cash_proyectado.py --start 2026-01 --months 24 --apply
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from sqlalchemy import func
from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.cash_cuenta import ErpCashCuenta  # noqa: E402
from app.models.erp.cash_diario import ErpCashDiario  # noqa: E402
from app.models.erp.cash_proyectado import ErpCashProyectado  # noqa: E402


PROJECTION_TYPE = "PROYECCION"
MONEY_QUANTUM = Decimal("0.01")


@dataclass(frozen=True)
class ProjectionSeed:
    cuenta_cash_id: int
    cuenta_nombre: str
    fecha_periodo: date
    importe: Decimal
    observacion: str

    @property
    def key(self) -> tuple[int, date, str]:
        return self.cuenta_cash_id, self.fecha_periodo, PROJECTION_TYPE


@dataclass(frozen=True)
class GenerationResult:
    baseline_months: tuple[date, ...]
    target_months: tuple[date, ...]
    seeds: tuple[ProjectionSeed, ...]


def parse_period(value: str) -> date:
    try:
        parsed = date.fromisoformat(f"{value}-01")
    except ValueError as exc:
        raise argparse.ArgumentTypeError("El periodo debe tener formato YYYY-MM") from exc
    return parsed


def shift_month(value: date, offset: int) -> date:
    month_index = value.year * 12 + (value.month - 1) + offset
    return date(month_index // 12, month_index % 12 + 1, 1)


def month_range(start: date, count: int) -> tuple[date, ...]:
    return tuple(shift_month(start, index) for index in range(count))


def project_account_values(
    actual_by_month: dict[date, Decimal],
    baseline_months: tuple[date, ...],
    target_months: tuple[date, ...],
) -> dict[date, Decimal]:
    if not baseline_months:
        raise ValueError("No hay meses reales para proyectar")

    overall_average = sum(
        (actual_by_month.get(month, Decimal("0")) for month in baseline_months),
        Decimal("0"),
    ) / Decimal(len(baseline_months))

    values: dict[date, Decimal] = {}
    for target in target_months:
        homologous = [
            actual_by_month.get(month, Decimal("0"))
            for month in baseline_months
            if month.month == target.month
        ]
        value = (
            sum(homologous, Decimal("0")) / Decimal(len(homologous))
            if homologous
            else overall_average
        )
        values[target] = value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    return values


def load_actual_rows(
    session: Session,
    *,
    start: date,
    end_exclusive: date,
):
    return session.exec(
        select(
            ErpCashDiario.cuenta_cash_id,
            ErpCashCuenta.descripcion.label("cuenta_nombre"),
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
            func.sum(-(ErpCashDiario.debe + ErpCashDiario.haber)).label("importe"),
        )
        .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashDiario.cuenta_cash_id)
        .where(
            ErpCashDiario.fecha >= start,
            ErpCashDiario.fecha < end_exclusive,
            ErpCashDiario.deleted_at.is_(None),
            ErpCashCuenta.deleted_at.is_(None),
            func.upper(func.trim(ErpCashCuenta.tipo)).in_(("INGRESO", "EGRESO")),
        )
        .group_by(
            ErpCashDiario.cuenta_cash_id,
            ErpCashCuenta.descripcion,
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
        )
        .order_by(
            ErpCashDiario.cuenta_cash_id,
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
        )
    ).all()


def build_generation(
    rows,
    *,
    start: date,
    months: int,
) -> GenerationResult:
    target_months = month_range(start, months)
    if not rows:
        raise RuntimeError(f"No hay movimientos reales desde {start:%Y-%m}")

    last_actual_month = max(date(int(row.periodo_anio), int(row.periodo_mes), 1) for row in rows)
    if last_actual_month < start:
        raise RuntimeError(f"No hay movimientos reales desde {start:%Y-%m}")

    baseline_count = (last_actual_month.year - start.year) * 12 + last_actual_month.month - start.month + 1
    baseline_months = month_range(start, baseline_count)
    actual_by_account: dict[int, dict[date, Decimal]] = defaultdict(dict)
    account_names: dict[int, str] = {}
    for row in rows:
        account_id = int(row.cuenta_cash_id)
        period = date(int(row.periodo_anio), int(row.periodo_mes), 1)
        actual_by_account[account_id][period] = Decimal(str(row.importe or 0))
        account_names[account_id] = str(row.cuenta_nombre)

    observation = (
        f"AUTO: base real {baseline_months[0]:%Y-%m} a {baseline_months[-1]:%Y-%m}; "
        "mes homologo o promedio mensual; sin crecimiento."
    )
    seeds: list[ProjectionSeed] = []
    for account_id in sorted(actual_by_account):
        actual_values = actual_by_account[account_id]
        if not any(actual_values.get(month, Decimal("0")) != 0 for month in baseline_months):
            continue
        projected_values = project_account_values(actual_values, baseline_months, target_months)
        seeds.extend(
            ProjectionSeed(
                cuenta_cash_id=account_id,
                cuenta_nombre=account_names[account_id],
                fecha_periodo=month,
                importe=projected_values[month],
                observacion=observation,
            )
            for month in target_months
        )

    return GenerationResult(
        baseline_months=baseline_months,
        target_months=target_months,
        seeds=tuple(seeds),
    )


def sync_projection(
    session: Session,
    generation: GenerationResult,
    *,
    apply_changes: bool,
) -> dict[str, int]:
    start = generation.target_months[0]
    end_exclusive = shift_month(generation.target_months[-1], 1)
    existing_rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.fecha_periodo >= start,
            ErpCashProyectado.fecha_periodo < end_exclusive,
            ErpCashProyectado.tipo == PROJECTION_TYPE,
            ErpCashProyectado.deleted_at.is_(None),
        )
    ).all()
    existing_by_key = {
        (int(row.cuenta_cash_id), row.fecha_periodo, row.tipo): row
        for row in existing_rows
    }

    created = updated = unchanged = 0
    for seed in generation.seeds:
        existing = existing_by_key.get(seed.key)
        if existing is None:
            created += 1
            if apply_changes:
                session.add(
                    ErpCashProyectado(
                        cuenta_cash_id=seed.cuenta_cash_id,
                        fecha_periodo=seed.fecha_periodo,
                        tipo=PROJECTION_TYPE,
                        importe=seed.importe,
                        observacion=seed.observacion,
                    )
                )
            continue

        if existing.importe == seed.importe and existing.observacion == seed.observacion:
            unchanged += 1
            continue
        updated += 1
        if apply_changes:
            existing.importe = seed.importe
            existing.observacion = seed.observacion
            existing.version = int(existing.version or 0) + 1
            session.add(existing)

    return {
        "cuentas": len({seed.cuenta_cash_id for seed in generation.seeds}),
        "periodos": len(generation.target_months),
        "rows_to_create": created,
        "rows_to_update": updated,
        "rows_unchanged": unchanged,
    }


def print_month_totals(generation: GenerationResult) -> None:
    totals: dict[date, Decimal] = defaultdict(Decimal)
    for seed in generation.seeds:
        totals[seed.fecha_periodo] += seed.importe
    print("Totales netos proyectados por mes:")
    for month in generation.target_months:
        print(f"  {month:%Y-%m}: {totals[month]:,.2f}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera erp_cash_proyectado desde movimientos reales.")
    parser.add_argument("--start", type=parse_period, default=parse_period("2026-01"))
    parser.add_argument("--months", type=int, default=24)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.months < 1:
        parser.error("--months debe ser mayor que cero")
    return args


def main() -> None:
    args = parse_args()
    target_end_exclusive = shift_month(args.start, args.months)
    with Session(engine) as session:
        actual_rows = load_actual_rows(
            session,
            start=args.start,
            end_exclusive=target_end_exclusive,
        )
        generation = build_generation(actual_rows, start=args.start, months=args.months)
        stats = sync_projection(session, generation, apply_changes=args.apply)

        print(
            f"Base real: {generation.baseline_months[0]:%Y-%m} a "
            f"{generation.baseline_months[-1]:%Y-%m} ({len(generation.baseline_months)} meses)"
        )
        print(
            f"Horizonte: {generation.target_months[0]:%Y-%m} a "
            f"{generation.target_months[-1]:%Y-%m} ({len(generation.target_months)} meses)"
        )
        print(f"Resumen: {stats}")
        print_month_totals(generation)

        if args.apply:
            session.commit()
            print("Proyeccion aplicada.")
        else:
            session.rollback()
            print("Dry run: no se modifico la base.")


if __name__ == "__main__":
    main()
