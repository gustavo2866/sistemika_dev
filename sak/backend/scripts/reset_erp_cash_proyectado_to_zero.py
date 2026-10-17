#!/usr/bin/env python
"""Deja en cero los importes proyectados de Cash.

Por defecto procesa solamente registros activos de tipo ``PROYECCION``. El
modo ``--dry-run`` informa el alcance sin modificar la base.

Uso:
    python backend/scripts/reset_erp_cash_proyectado_to_zero.py --dry-run
    python backend/scripts/reset_erp_cash_proyectado_to_zero.py --apply
    python backend/scripts/reset_erp_cash_proyectado_to_zero.py --desde 2026-01 --hasta 2026-12 --dry-run
    python backend/scripts/reset_erp_cash_proyectado_to_zero.py --cuenta-cash-id 10 --apply
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, update
from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.cash_cuenta import ErpCashCuenta  # noqa: E402
from app.models.erp.cash_proyectado import ErpCashProyectado  # noqa: E402


def parse_period(value: str) -> date:
    try:
        return date.fromisoformat(f"{value}-01")
    except ValueError as exc:
        raise argparse.ArgumentTypeError("El periodo debe tener formato YYYY-MM") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deja en cero los importes activos de erp_cash_proyectado.",
    )
    parser.add_argument(
        "--tipo",
        choices=("PROYECCION", "PRESUPUESTO", "COMPROMETIDO", "AJUSTE"),
        default="PROYECCION",
        help="Tipo a procesar (default: PROYECCION).",
    )
    parser.add_argument(
        "--desde",
        type=parse_period,
        help="Periodo inicial inclusive, formato YYYY-MM.",
    )
    parser.add_argument(
        "--hasta",
        type=parse_period,
        help="Periodo final inclusive, formato YYYY-MM.",
    )
    parser.add_argument(
        "--cuenta-cash-id",
        type=int,
        action="append",
        dest="cuenta_cash_ids",
        help="Limita a una cuenta Cash; puede repetirse.",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra el alcance sin aplicar cambios.",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Aplica la actualización.",
    )
    args = parser.parse_args()
    if args.desde and args.hasta and args.desde > args.hasta:
        parser.error("--desde no puede ser posterior a --hasta")
    if args.cuenta_cash_ids and any(value <= 0 for value in args.cuenta_cash_ids):
        parser.error("--cuenta-cash-id debe ser mayor que cero")
    return args


def build_filters(args: argparse.Namespace):
    filters = [
        ErpCashProyectado.deleted_at.is_(None),
        ErpCashProyectado.tipo == args.tipo,
        ErpCashProyectado.importe != Decimal("0"),
    ]
    if args.desde:
        filters.append(ErpCashProyectado.fecha_periodo >= args.desde)
    if args.hasta:
        filters.append(ErpCashProyectado.fecha_periodo <= args.hasta)
    if args.cuenta_cash_ids:
        filters.append(ErpCashProyectado.cuenta_cash_id.in_(args.cuenta_cash_ids))
    return filters


def run(args: argparse.Namespace) -> int:
    filters = build_filters(args)
    with Session(engine) as session:
        summary = session.exec(
            select(
                func.count(ErpCashProyectado.id),
                func.coalesce(func.sum(ErpCashProyectado.importe), 0),
            ).where(*filters)
        ).one()
        total_rows = int(summary[0] or 0)
        current_total = Decimal(str(summary[1] or 0))

        print(f"Tipo: {args.tipo}")
        print(f"Periodo desde: {args.desde:%Y-%m}" if args.desde else "Periodo desde: sin limite")
        print(f"Periodo hasta: {args.hasta:%Y-%m}" if args.hasta else "Periodo hasta: sin limite")
        print(
            f"Cuentas Cash: {', '.join(map(str, args.cuenta_cash_ids))}"
            if args.cuenta_cash_ids
            else "Cuentas Cash: todas"
        )
        print(f"Filas no cero a actualizar: {total_rows}")
        print(f"Importe total actual: {current_total:,.2f}")

        sample_rows = session.exec(
            select(
                ErpCashProyectado.id,
                ErpCashProyectado.fecha_periodo,
                ErpCashProyectado.cuenta_cash_id,
                ErpCashCuenta.descripcion,
                ErpCashProyectado.importe,
            )
            .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashProyectado.cuenta_cash_id)
            .where(*filters)
            .order_by(ErpCashProyectado.fecha_periodo, ErpCashProyectado.cuenta_cash_id)
            .limit(20)
        ).all()
        if sample_rows:
            print("Muestra (id, periodo, cuenta_cash_id, cuenta, importe):")
            for row in sample_rows:
                print(row)

        if args.dry_run:
            session.rollback()
            print("Dry run: no se modifico la base.")
            return total_rows

        if total_rows == 0:
            print("No hay filas para actualizar.")
            return 0

        result = session.exec(
            update(ErpCashProyectado)
            .where(*filters)
            .values(
                importe=Decimal("0"),
                updated_at=datetime.now(UTC),
                version=ErpCashProyectado.version + 1,
            )
        )
        session.commit()
        updated = result.rowcount if result.rowcount is not None else total_rows
        print(f"Filas actualizadas: {updated}")
        return int(updated)


def main() -> None:
    run(parse_args())


if __name__ == "__main__":
    main()
