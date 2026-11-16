#!/usr/bin/env python
"""Limpia datos reales posteriores al primer período abierto.

Por seguridad requiere elegir explícitamente ``--dry-run`` o ``--apply``.

Uso:
    python scripts/cleanup_erp_future_actuals.py --dry-run
    python scripts/cleanup_erp_future_actuals.py --apply
    python scripts/cleanup_erp_future_actuals.py --dry-run --periodo-corte 2026-09
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from sqlmodel import Session


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.libro_diario_sync import parse_periodo  # noqa: E402
from app.services.erp_sync_cleanup_service import cleanup_future_erp_actuals  # noqa: E402


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Elimina Libro Diario y Mayor posteriores al período de corte, "
            "y limpia sus valores reales en Presupuesto sin alterar el presupuesto."
        ),
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Solo informa las filas afectadas")
    mode.add_argument("--apply", action="store_true", help="Aplica la limpieza en una transacción")
    parser.add_argument(
        "--periodo-corte",
        help="Período que se conserva, en formato YYYY-MM. Por defecto usa el primer ABIERTO.",
    )
    return parser.parse_args(argv)


def parse_cutoff(value: str | None) -> date | None:
    if value is None:
        return None
    year, month = parse_periodo(value)
    return date(year, month, 1)


def main() -> None:
    args = parse_args()
    try:
        cutoff = parse_cutoff(args.periodo_corte)
        with Session(engine) as session:
            result = cleanup_future_erp_actuals(
                session,
                cutoff=cutoff,
                apply_changes=args.apply,
            )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not args.apply:
        print("Dry run: no se aplicaron cambios.")


if __name__ == "__main__":
    main()
