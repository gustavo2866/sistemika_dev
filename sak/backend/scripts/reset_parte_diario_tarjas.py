#!/usr/bin/env python
"""Limpia partes diarios y toda su estructura de tarjas para repetir pruebas.

Conserva nominas, proyectos, encargados, estados y mensajes CRM.

Uso:
    python backend/scripts/reset_parte_diario_tarjas.py --dry-run
    python backend/scripts/reset_parte_diario_tarjas.py --apply

En modo ``--apply`` solicita escribir LIMPIAR antes de ejecutar. La operacion se
hace en una unica transaccion y no usa CASCADE, para no borrar datos ajenos al
alcance declarado.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import inspect, text


BACKEND_PATH = Path(__file__).resolve().parents[1]
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.db import engine  # noqa: E402


# Orden de hijos a padres para motores sin TRUNCATE multiple.
TABLE_ORDER = [
    "tarja_detalles",
    "tarja_nomina",
    "tarja_novedades",  # Tabla legacy; se incluye solo si todavia existe.
    "tarjas",
    "partes_diario_detalles",
    "partes_diario",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Limpia partes diarios, sus novedades y tarjas asociadas.",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra las tablas y cantidades sin modificar datos.",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Ejecuta la limpieza luego de una confirmacion explicita.",
    )
    return parser.parse_args()


def _existing_target_tables(connection) -> list[str]:
    existing = set(inspect(connection).get_table_names())
    return [table for table in TABLE_ORDER if table in existing]


def _quote(connection, table: str) -> str:
    return connection.dialect.identifier_preparer.quote(table)


def _counts(connection, tables: list[str]) -> dict[str, int]:
    return {
        table: int(
            connection.execute(
                text(f"SELECT COUNT(*) FROM {_quote(connection, table)}")
            ).scalar_one()
        )
        for table in tables
    }


def _print_plan(database: str, dialect: str, counts: dict[str, int]) -> None:
    print(f"Base: {database} ({dialect})")
    print("Datos que se eliminaran:")
    for table, count in counts.items():
        print(f"  {table:<28} {count:>8} filas")
    print("\nSe conservan: nominas, proyectos, encargados, estados y mensajes CRM.")


def _clear(connection, tables: list[str]) -> None:
    if connection.dialect.name == "postgresql":
        quoted_tables = ", ".join(_quote(connection, table) for table in tables)
        connection.execute(text(f"TRUNCATE TABLE {quoted_tables} RESTART IDENTITY"))
        return

    for table in tables:
        connection.execute(text(f"DELETE FROM {_quote(connection, table)}"))

    if connection.dialect.name == "sqlite":
        sequence_exists = inspect(connection).has_table("sqlite_sequence")
        if sequence_exists:
            for table in tables:
                connection.execute(
                    text("DELETE FROM sqlite_sequence WHERE name = :table"),
                    {"table": table},
                )


def run(*, apply_changes: bool) -> dict[str, int]:
    if not apply_changes:
        with engine.connect() as connection:
            tables = _existing_target_tables(connection)
            counts = _counts(connection, tables)
            _print_plan(str(engine.url.database or ""), connection.dialect.name, counts)
            print("\nDry run: no se aplicaron cambios.")
            return counts

    with engine.begin() as connection:
        tables = _existing_target_tables(connection)
        counts = _counts(connection, tables)
        _print_plan(str(engine.url.database or ""), connection.dialect.name, counts)
        if not tables:
            print("\nNo se encontraron tablas para limpiar.")
            return counts

        confirmation = input("\nEscribi LIMPIAR para confirmar: ").strip()
        if confirmation != "LIMPIAR":
            raise SystemExit("Operacion cancelada; no se modificaron datos.")

        _clear(connection, tables)

    print("\nLimpieza completada.")
    print("Reinicia el backend o llama POST /api/agente/v3/inbox/reset para limpiar el contexto en memoria.")
    return counts


def main() -> None:
    args = parse_args()
    run(apply_changes=args.apply)


if __name__ == "__main__":
    main()
