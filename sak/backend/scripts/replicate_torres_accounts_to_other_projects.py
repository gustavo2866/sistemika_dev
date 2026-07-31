#!/usr/bin/env python
"""Replica cuentas presupuestadas en Torres al resto de proyectos con presupuesto.

Para cada proyecto que tenga registros en erp_presupuestos (excepto Torres),
crea filas faltantes para todos sus periodos usando las cuentas que existen en Torres,
con todos los valores numericos en cero.

Uso:
    python backend/scripts/replicate_torres_accounts_to_other_projects.py --dry-run
    python backend/scripts/replicate_torres_accounts_to_other_projects.py --apply
    python backend/scripts/replicate_torres_accounts_to_other_projects.py --apply --torres-id 18
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Replica cuentas de Torres a otros proyectos con presupuesto, "
            "para todos los periodos del proyecto destino, con valores en cero."
        ),
    )
    parser.add_argument(
        "--torres-id",
        type=int,
        default=None,
        help="ID del proyecto Torres (opcional). Si no se pasa, se busca por nombre.",
    )
    parser.add_argument(
        "--torres-name",
        default="torres",
        help="Texto para buscar el proyecto Torres por nombre (default: torres).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra cuantas filas se insertarian sin aplicar cambios.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica la insercion de faltantes.",
    )
    return parser.parse_args()


def resolve_torres_project_id(session: Session, torres_id: int | None, torres_name: str) -> tuple[int, str]:
    conn = session.connection()

    if torres_id is not None:
        row = conn.execute(
            text("SELECT id, nombre FROM proyectos WHERE id = :id AND deleted_at IS NULL"),
            {"id": torres_id},
        ).first()
        if row is None:
            raise RuntimeError(f"No existe un proyecto activo con id={torres_id}.")
        return int(row.id), str(row.nombre)

    rows = conn.execute(
        text(
            """
            SELECT id, nombre
            FROM proyectos
            WHERE deleted_at IS NULL
              AND lower(nombre) LIKE :name
            ORDER BY id
            """
        ),
        {"name": f"%{torres_name.lower()}%"},
    ).fetchall()

    if not rows:
        raise RuntimeError(
            f"No se encontro proyecto Torres con nombre que contenga '{torres_name}'. "
            "Pasa --torres-id explicitamente."
        )

    if len(rows) > 1:
        options = ", ".join([f"{row.id}:{row.nombre}" for row in rows])
        raise RuntimeError(
            "Se encontraron multiples proyectos que coinciden con Torres: "
            f"{options}. Pasa --torres-id para elegir uno."
        )

    row = rows[0]
    return int(row.id), str(row.nombre)


def run(apply_changes: bool, torres_id_arg: int | None, torres_name: str) -> int:
    count_torres_accounts_query = text(
        """
        SELECT COUNT(DISTINCT ep.erp_cuenta_id)
        FROM erp_presupuestos ep
        WHERE ep.proyecto_id = :torres_id
          AND ep.deleted_at IS NULL
        """
    )

    count_target_projects_query = text(
        """
        SELECT COUNT(DISTINCT ep.proyecto_id)
        FROM erp_presupuestos ep
        WHERE ep.deleted_at IS NULL
          AND ep.proyecto_id <> :torres_id
        """
    )

    count_target_periods_query = text(
        """
        SELECT COUNT(*)
        FROM (
            SELECT DISTINCT ep.proyecto_id, ep.fecha
            FROM erp_presupuestos ep
            WHERE ep.deleted_at IS NULL
              AND ep.proyecto_id <> :torres_id
        ) t
        """
    )

    missing_count_query = text(
        """
        WITH torres_accounts AS (
            SELECT DISTINCT ep.erp_cuenta_id
            FROM erp_presupuestos ep
            WHERE ep.proyecto_id = :torres_id
              AND ep.deleted_at IS NULL
        ),
        target_periods AS (
            SELECT DISTINCT ep.proyecto_id, ep.fecha
            FROM erp_presupuestos ep
            WHERE ep.deleted_at IS NULL
              AND ep.proyecto_id <> :torres_id
        ),
        expected AS (
            SELECT tp.proyecto_id, tp.fecha, ta.erp_cuenta_id
            FROM target_periods tp
            CROSS JOIN torres_accounts ta
        )
        SELECT COUNT(*)
        FROM expected e
        WHERE NOT EXISTS (
            SELECT 1
            FROM erp_presupuestos ep
            WHERE ep.deleted_at IS NULL
              AND ep.proyecto_id = e.proyecto_id
              AND ep.fecha = e.fecha
              AND ep.erp_cuenta_id = e.erp_cuenta_id
        )
        """
    )

    missing_sample_query = text(
        """
        WITH torres_accounts AS (
            SELECT DISTINCT ep.erp_cuenta_id
            FROM erp_presupuestos ep
            WHERE ep.proyecto_id = :torres_id
              AND ep.deleted_at IS NULL
        ),
        target_periods AS (
            SELECT DISTINCT ep.proyecto_id, ep.fecha
            FROM erp_presupuestos ep
            WHERE ep.deleted_at IS NULL
              AND ep.proyecto_id <> :torres_id
        ),
        expected AS (
            SELECT tp.proyecto_id, tp.fecha, ta.erp_cuenta_id
            FROM target_periods tp
            CROSS JOIN torres_accounts ta
        )
        SELECT e.proyecto_id, p.nombre AS proyecto_nombre, e.fecha, e.erp_cuenta_id, c.cod_cuenta, c.descripcion
        FROM expected e
        JOIN proyectos p ON p.id = e.proyecto_id
        JOIN erp_cuentas c ON c.id = e.erp_cuenta_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM erp_presupuestos ep
            WHERE ep.deleted_at IS NULL
              AND ep.proyecto_id = e.proyecto_id
              AND ep.fecha = e.fecha
              AND ep.erp_cuenta_id = e.erp_cuenta_id
        )
        ORDER BY e.proyecto_id, e.fecha, c.cod_cuenta
        LIMIT 25
        """
    )

    insert_missing_query = text(
        """
        WITH torres_accounts AS (
            SELECT DISTINCT ep.erp_cuenta_id
            FROM erp_presupuestos ep
            WHERE ep.proyecto_id = :torres_id
              AND ep.deleted_at IS NULL
        ),
        target_periods AS (
            SELECT DISTINCT ep.proyecto_id, ep.fecha
            FROM erp_presupuestos ep
            WHERE ep.deleted_at IS NULL
              AND ep.proyecto_id <> :torres_id
        ),
        expected AS (
            SELECT tp.proyecto_id, tp.fecha, ta.erp_cuenta_id
            FROM target_periods tp
            CROSS JOIN torres_accounts ta
        ),
        missing AS (
            SELECT e.proyecto_id, e.fecha, e.erp_cuenta_id
            FROM expected e
            WHERE NOT EXISTS (
                SELECT 1
                FROM erp_presupuestos ep
                WHERE ep.deleted_at IS NULL
                  AND ep.proyecto_id = e.proyecto_id
                  AND ep.fecha = e.fecha
                  AND ep.erp_cuenta_id = e.erp_cuenta_id
            )
        )
        INSERT INTO erp_presupuestos (
            created_at,
            updated_at,
            deleted_at,
            version,
            fecha,
            proyecto_id,
            erp_cuenta_id,
            egreso,
            ingres,
            real_egreso,
            real_ingreso,
            obreros_cantidad,
            obreros_costo
        )
        SELECT
            NOW(),
            NOW(),
            NULL,
            1,
            m.fecha,
            m.proyecto_id,
            m.erp_cuenta_id,
            0,
            0,
            0,
            0,
            0,
            0
        FROM missing m
        """
    )

    with Session(engine) as session:
        conn = session.connection()

        torres_id, torres_name_resolved = resolve_torres_project_id(session, torres_id_arg, torres_name)

        torres_accounts = conn.execute(
            count_torres_accounts_query,
            {"torres_id": torres_id},
        ).scalar_one()
        target_projects = conn.execute(
            count_target_projects_query,
            {"torres_id": torres_id},
        ).scalar_one()
        target_periods = conn.execute(
            count_target_periods_query,
            {"torres_id": torres_id},
        ).scalar_one()
        missing_count = conn.execute(
            missing_count_query,
            {"torres_id": torres_id},
        ).scalar_one()

        print(f"Proyecto Torres: {torres_id} - {torres_name_resolved}")
        print(f"Cuentas base en Torres: {torres_accounts}")
        print(f"Proyectos destino con presupuesto: {target_projects}")
        print(f"Periodos destino (proyecto, fecha): {target_periods}")
        print(f"Filas faltantes a insertar: {missing_count}")

        print("Muestra faltantes (proyecto_id, proyecto_nombre, fecha, erp_cuenta_id, cod_cuenta, descripcion):")
        for row in conn.execute(missing_sample_query, {"torres_id": torres_id}).fetchall():
            print(row)

        if not apply_changes:
            print("\nDry run: no se aplicaron cambios.")
            return 0

        result = conn.execute(insert_missing_query, {"torres_id": torres_id})
        inserted = result.rowcount if result.rowcount is not None else 0
        session.commit()

        print(f"\nFilas insertadas: {inserted}")
        return inserted


def main() -> None:
    args = parse_args()

    if args.apply == args.dry_run:
        raise SystemExit("Debes elegir exactamente una opcion: --dry-run o --apply")

    run(
        apply_changes=args.apply,
        torres_id_arg=args.torres_id,
        torres_name=args.torres_name,
    )


if __name__ == "__main__":
    main()
