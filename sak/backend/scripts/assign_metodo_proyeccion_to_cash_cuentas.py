#!/usr/bin/env python
"""Asigna un método de proyección a todas las cuentas Cash activas.

El método se resuelve por nombre, sin fijar su ID en el código. Por defecto se
usa ``mes anterior`` y se excluyen registros con borrado lógico.

Uso:
    python backend/scripts/assign_metodo_proyeccion_to_cash_cuentas.py --dry-run
    python backend/scripts/assign_metodo_proyeccion_to_cash_cuentas.py --apply
    python backend/scripts/assign_metodo_proyeccion_to_cash_cuentas.py --nombre "otro método" --dry-run
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, update
from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.cash_cuenta import ErpCashCuenta  # noqa: E402
from app.models.metodo_proyeccion import MetodoProyeccion  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Asigna un método de proyección a las cuentas Cash.",
    )
    parser.add_argument(
        "--nombre",
        default="mes anterior",
        help='Nombre del método de proyección (default: "mes anterior").',
    )
    parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Incluye cuentas Cash con borrado lógico.",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra el alcance sin modificar la base.",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Aplica la asignación.",
    )
    return parser.parse_args()


def get_metodo(session: Session, nombre: str) -> MetodoProyeccion:
    normalized_name = nombre.strip().lower()
    metodos = session.exec(
        select(MetodoProyeccion).where(
            MetodoProyeccion.deleted_at.is_(None),
            func.lower(func.trim(MetodoProyeccion.nombre)) == normalized_name,
        )
    ).all()
    if not metodos:
        raise RuntimeError(f'No existe un método de proyección activo llamado "{nombre}".')
    if len(metodos) > 1:
        ids = ", ".join(str(metodo.id) for metodo in metodos)
        raise RuntimeError(f'Hay más de un método llamado "{nombre}" (IDs: {ids}).')
    return metodos[0]


def run(args: argparse.Namespace) -> int:
    with Session(engine) as session:
        metodo = get_metodo(session, args.nombre)
        filters = [ErpCashCuenta.id_metodo_proyeccion.is_distinct_from(metodo.id)]
        if not args.include_deleted:
            filters.append(ErpCashCuenta.deleted_at.is_(None))

        total_cash = session.exec(
            select(func.count(ErpCashCuenta.id)).where(
                *([] if args.include_deleted else [ErpCashCuenta.deleted_at.is_(None)])
            )
        ).one()
        rows_to_update = session.exec(
            select(func.count(ErpCashCuenta.id)).where(*filters)
        ).one()

        print(f"Método seleccionado: {metodo.nombre} (id={metodo.id})")
        print(f"Cuentas Cash consideradas: {int(total_cash or 0)}")
        print(f"Cuentas Cash a actualizar: {int(rows_to_update or 0)}")

        sample_rows = session.exec(
            select(
                ErpCashCuenta.id,
                ErpCashCuenta.descripcion,
                ErpCashCuenta.id_metodo_proyeccion,
            )
            .where(*filters)
            .order_by(ErpCashCuenta.id)
            .limit(20)
        ).all()
        if sample_rows:
            print("Muestra (id, descripción, método actual):")
            for row in sample_rows:
                print(row)

        if args.dry_run:
            session.rollback()
            print("Dry run: no se modificó la base.")
            return int(rows_to_update or 0)

        if not rows_to_update:
            print("Todas las cuentas ya tienen asignado el método solicitado.")
            return 0

        result = session.exec(
            update(ErpCashCuenta)
            .where(*filters)
            .values(
                id_metodo_proyeccion=metodo.id,
                updated_at=datetime.now(UTC),
                version=ErpCashCuenta.version + 1,
            )
        )
        session.commit()
        updated = result.rowcount if result.rowcount is not None else rows_to_update
        print(f"Cuentas Cash actualizadas: {updated}")
        return int(updated)


def main() -> None:
    run(parse_args())


if __name__ == "__main__":
    main()
