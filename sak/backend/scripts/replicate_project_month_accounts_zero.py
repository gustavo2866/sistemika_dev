#!/usr/bin/env python
"""Replica cuentas de un periodo origen a un periodo destino para un proyecto.

Inserta solo cuentas faltantes en el periodo destino, con valores en cero.

Uso:
    python backend/scripts/replicate_project_month_accounts_zero.py --project-name axion --source-period 2026-07 --target-period 2026-08 --dry-run
    python backend/scripts/replicate_project_month_accounts_zero.py --project-name axion --source-period 2026-07 --target-period 2026-08 --apply
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session

# Agregar backend al path para importar app.db
BACKEND_PATH = Path(__file__).resolve().parents[1]
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.db import engine  # noqa: E402


def parse_period(period: str) -> date:
    parts = period.split("-")
    if len(parts) != 2:
        raise ValueError("El periodo debe tener formato YYYY-MM")
    year = int(parts[0])
    month = int(parts[1])
    if month < 1 or month > 12:
        raise ValueError("El mes debe estar entre 01 y 12")
    return date(year, month, 1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replica cuentas de un mes a otro para un proyecto, con valores en cero.",
    )
    parser.add_argument("--project-id", type=int, default=None, help="ID del proyecto (opcional).")
    parser.add_argument(
        "--project-name",
        default="axion",
        help="Texto para buscar proyecto por nombre si no se pasa --project-id.",
    )
    parser.add_argument("--source-period", required=True, help="Periodo origen YYYY-MM.")
    parser.add_argument("--target-period", required=True, help="Periodo destino YYYY-MM.")
    parser.add_argument("--dry-run", action="store_true", help="Solo vista previa.")
    parser.add_argument("--apply", action="store_true", help="Aplica cambios.")
    return parser.parse_args()


def resolve_project(session: Session, project_id: int | None, project_name: str) -> tuple[int, str]:
    conn = session.connection()

    if project_id is not None:
        row = conn.execute(
            text("SELECT id, nombre FROM proyectos WHERE id = :id AND deleted_at IS NULL"),
            {"id": project_id},
        ).first()
        if row is None:
            raise RuntimeError(f"No existe proyecto activo con id={project_id}")
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
        {"name": f"%{project_name.lower()}%"},
    ).fetchall()

    if not rows:
        raise RuntimeError(
            f"No se encontro proyecto con nombre que contenga '{project_name}'."
        )

    if len(rows) > 1:
        options = ", ".join([f"{r.id}:{r.nombre}" for r in rows])
        raise RuntimeError(
            "Se encontraron multiples proyectos. Usa --project-id. "
            f"Opciones: {options}"
        )

    row = rows[0]
    return int(row.id), str(row.nombre)


def run(
    apply_changes: bool,
    project_id: int | None,
    project_name: str,
    source_period: str,
    target_period: str,
) -> int:
    source_date = parse_period(source_period)
    target_date = parse_period(target_period)

    with Session(engine) as session:
        conn = session.connection()
        resolved_project_id, resolved_project_name = resolve_project(session, project_id, project_name)

        source_count_query = text(
            """
            SELECT COUNT(DISTINCT ep.erp_cuenta_id)
            FROM erp_presupuestos ep
            WHERE ep.proyecto_id = :project_id
              AND ep.fecha = :source_date
              AND ep.deleted_at IS NULL
            """
        )
        target_count_query = text(
            """
            SELECT COUNT(DISTINCT ep.erp_cuenta_id)
            FROM erp_presupuestos ep
            WHERE ep.proyecto_id = :project_id
              AND ep.fecha = :target_date
              AND ep.deleted_at IS NULL
            """
        )
        missing_count_query = text(
            """
            WITH source_accounts AS (
                SELECT DISTINCT ep.erp_cuenta_id
                FROM erp_presupuestos ep
                WHERE ep.proyecto_id = :project_id
                  AND ep.fecha = :source_date
                  AND ep.deleted_at IS NULL
            )
            SELECT COUNT(*)
            FROM source_accounts sa
            WHERE NOT EXISTS (
                SELECT 1
                FROM erp_presupuestos ep2
                WHERE ep2.proyecto_id = :project_id
                  AND ep2.fecha = :target_date
                  AND ep2.erp_cuenta_id = sa.erp_cuenta_id
                  AND ep2.deleted_at IS NULL
            )
            """
        )
        missing_sample_query = text(
            """
            WITH source_accounts AS (
                SELECT DISTINCT ep.erp_cuenta_id
                FROM erp_presupuestos ep
                WHERE ep.proyecto_id = :project_id
                  AND ep.fecha = :source_date
                  AND ep.deleted_at IS NULL
            )
            SELECT c.id, c.cod_cuenta, c.descripcion
            FROM source_accounts sa
            JOIN erp_cuentas c ON c.id = sa.erp_cuenta_id
            WHERE NOT EXISTS (
                SELECT 1
                FROM erp_presupuestos ep2
                WHERE ep2.proyecto_id = :project_id
                  AND ep2.fecha = :target_date
                  AND ep2.erp_cuenta_id = sa.erp_cuenta_id
                  AND ep2.deleted_at IS NULL
            )
            ORDER BY c.cod_cuenta
            LIMIT 30
            """
        )
        insert_query = text(
            """
            WITH source_accounts AS (
                SELECT DISTINCT ep.erp_cuenta_id
                FROM erp_presupuestos ep
                WHERE ep.proyecto_id = :project_id
                  AND ep.fecha = :source_date
                  AND ep.deleted_at IS NULL
            ),
            missing_accounts AS (
                SELECT sa.erp_cuenta_id
                FROM source_accounts sa
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM erp_presupuestos ep2
                    WHERE ep2.proyecto_id = :project_id
                      AND ep2.fecha = :target_date
                      AND ep2.erp_cuenta_id = sa.erp_cuenta_id
                      AND ep2.deleted_at IS NULL
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
                :target_date,
                :project_id,
                ma.erp_cuenta_id,
                0,
                0,
                0,
                0,
                0,
                0
            FROM missing_accounts ma
            """
        )

        params = {
            "project_id": resolved_project_id,
            "source_date": source_date,
            "target_date": target_date,
        }

        source_count = conn.execute(source_count_query, params).scalar_one()
        target_count = conn.execute(target_count_query, params).scalar_one()
        missing_count = conn.execute(missing_count_query, params).scalar_one()

        print(f"Proyecto: {resolved_project_id} - {resolved_project_name}")
        print(f"Periodo origen: {source_date.isoformat()} (cuentas: {source_count})")
        print(f"Periodo destino: {target_date.isoformat()} (cuentas actuales: {target_count})")
        print(f"Cuentas faltantes a insertar: {missing_count}")
        print("Muestra cuentas faltantes (id, cod_cuenta, descripcion):")

        for row in conn.execute(missing_sample_query, params).fetchall():
            print(row)

        if not apply_changes:
            print("\nDry run: no se aplicaron cambios.")
            return 0

        result = conn.execute(insert_query, params)
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
        project_id=args.project_id,
        project_name=args.project_name,
        source_period=args.source_period,
        target_period=args.target_period,
    )


if __name__ == "__main__":
    main()
