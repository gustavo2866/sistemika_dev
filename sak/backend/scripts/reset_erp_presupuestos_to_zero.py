#!/usr/bin/env python
"""Deja en cero los valores de erp_presupuestos.

Uso:
    python backend/scripts/reset_erp_presupuestos_to_zero.py --dry-run
    python backend/scripts/reset_erp_presupuestos_to_zero.py --apply
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session

# Agregar backend al path para importar app.db
BACKEND_PATH = Path(__file__).resolve().parents[1]
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.db import engine  # noqa: E402

ZERO_COLUMNS = [
    "egreso",
    "ingres",
    "real_egreso",
    "real_ingreso",
    "obreros_cantidad",
    "obreros_costo",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deja en cero los importes y empleados de erp_presupuestos.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra cuantas filas se actualizarian sin aplicar cambios.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica la actualizacion.",
    )
    return parser.parse_args()


def run(apply_changes: bool) -> int:
    zero_set_clause = ", ".join([f"{column} = 0" for column in ZERO_COLUMNS])

    count_query = text("SELECT COUNT(*) FROM erp_presupuestos")
    sample_query = text(
        """
        SELECT id, fecha, proyecto_id, erp_cuenta_id, egreso, ingres, real_egreso, real_ingreso, obreros_cantidad, obreros_costo
        FROM erp_presupuestos
        ORDER BY id
        LIMIT 20
        """
    )
    update_query = text(f"UPDATE erp_presupuestos SET {zero_set_clause}")

    with Session(engine) as session:
        conn = session.connection()

        total_rows = conn.execute(count_query).scalar_one()
        print(f"Filas en erp_presupuestos: {total_rows}")
        print("Muestra actual (id, fecha, proyecto_id, erp_cuenta_id, egreso, ingres, real_egreso, real_ingreso, obreros_cantidad, obreros_costo):")
        for row in conn.execute(sample_query).fetchall():
            print(row)

        if not apply_changes:
            print("\nDry run: no se aplicaron cambios.")
            return 0

        result = conn.execute(update_query)
        updated = result.rowcount if result.rowcount is not None else total_rows
        session.commit()
        print(f"\nFilas actualizadas: {updated}")
        return updated


def main() -> None:
    args = parse_args()

    if args.apply == args.dry_run:
        raise SystemExit("Debes elegir exactamente una opcion: --dry-run o --apply")

    run(apply_changes=args.apply)


if __name__ == "__main__":
    main()
