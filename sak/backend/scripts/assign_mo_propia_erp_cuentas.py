#!/usr/bin/env python
"""Asigna conceptos a cuentas ERP por palabras clave en descripcion.

Uso:
    python backend/scripts/assign_mo_propia_erp_cuentas.py --dry-run
    python backend/scripts/assign_mo_propia_erp_cuentas.py --apply
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

RULES = [
    {
        "concepto": "mo_propia",
        "keywords": [
            "aguinaldo",
            "cargas sociales",
            "sueldos y jornales",
            "vacaciones",
        ],
    },
    {
        "concepto": "materiales",
        "keywords": [
            "materiales",
        ],
    },
    {
        "concepto": "mo_terceros",
        "keywords": [
            "mano de obra de 3",
            "mano de obra de 3°",
        ],
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Asigna conceptos en erp_cuentas usando coincidencias por descripcion.",
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


def build_where_clause(keywords: list[str]) -> str:
    return " OR ".join(
        [f"lower(COALESCE(ec.descripcion, '')) LIKE '%{kw}%'" for kw in keywords]
    )


def run(apply_changes: bool) -> int:
    total_updated = 0
    with Session(engine) as session:
        conn = session.connection()

        for rule in RULES:
            concepto = rule["concepto"]
            keywords = rule["keywords"]
            where_clause = build_where_clause(keywords)
            where_wrapped = f"({where_clause})"

            concepto_query = text(
                """
                SELECT id
                FROM proyectos_conceptos
                WHERE lower(nombre) = lower(:nombre)
                ORDER BY id
                LIMIT 1
                """
            )
            concepto_id = conn.execute(concepto_query, {"nombre": concepto}).scalar_one_or_none()
            if concepto_id is None:
                raise RuntimeError(f"No existe el concepto '{concepto}' en proyectos_conceptos.")

            count_query = text(
                f"""
                SELECT COUNT(*)
                FROM erp_cuentas ec
                WHERE {where_wrapped}
                """
            )
            count_assigned_query = text(
                f"""
                SELECT COUNT(*)
                FROM erp_cuentas ec
                WHERE {where_wrapped}
                  AND ec.proyectos_concepto_id = :concepto_id
                """
            )
            preview_query = text(
                f"""
                SELECT ec.id, ec.cod_cuenta, ec.descripcion, ec.proyectos_concepto_id
                FROM erp_cuentas ec
                WHERE {where_wrapped}
                ORDER BY ec.cod_cuenta
                LIMIT 15
                """
            )
            update_query = text(
                f"""
                UPDATE erp_cuentas ec
                SET proyectos_concepto_id = :concepto_id
                WHERE {where_wrapped}
                  AND ec.proyectos_concepto_id IS DISTINCT FROM :concepto_id
                """
            )

            total_matches = conn.execute(count_query).scalar_one()
            already_assigned = conn.execute(
                count_assigned_query,
                {"concepto_id": concepto_id},
            ).scalar_one()

            print(f"\nConcepto {concepto} id: {concepto_id}")
            print(f"Cuentas que coinciden por descripcion: {total_matches}")
            print(f"Ya asignadas a {concepto}: {already_assigned}")

            rows = conn.execute(preview_query).fetchall()
            print("Muestra (id, cod_cuenta, descripcion, proyectos_concepto_id):")
            for row in rows:
                print(row)

            if apply_changes:
                result = conn.execute(update_query, {"concepto_id": concepto_id})
                updated = result.rowcount if result.rowcount is not None else 0
                total_updated += updated
                print(f"Filas actualizadas para {concepto}: {updated}")

        if not apply_changes:
            print("\nDry run: no se aplicaron cambios.")
            return 0

        session.commit()
        print(f"\nFilas actualizadas totales: {total_updated}")
        return total_updated


def main() -> None:
    args = parse_args()

    if args.apply == args.dry_run:
        raise SystemExit("Debes elegir exactamente una opcion: --dry-run o --apply")

    run(apply_changes=args.apply)


if __name__ == "__main__":
    main()
