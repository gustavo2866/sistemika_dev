"""
Sincroniza la tabla proyectos_conceptos de TEST a PROD.

Estrategia:
- No elimina registros en PROD.
- Por defecto corre en dry-run; solo escribe con --apply.
- Si existe el mismo id en PROD, actualiza nombre, activo y signo.
- Si no existe el id pero existe el mismo nombre, actualiza activo y signo sin cambiar el id
  de PROD para no romper posibles referencias.
- Si no existe id ni nombre, inserta el registro preservando el id de TEST.

Uso:
    cd backend
    $env:TEST_DATABASE_URL="postgresql://..."
    $env:PROD_DATABASE_URL="postgresql://..."
    python scripts/sync_proyectos_conceptos_test_to_prod.py
    python scripts/sync_proyectos_conceptos_test_to_prod.py --apply
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from typing import Any

import psycopg


TABLE = "proyectos_conceptos"
COLUMNS = ["id", "created_at", "updated_at", "deleted_at", "version", "nombre", "activo", "signo"]


@dataclass(frozen=True)
class ConceptRow:
    id: int
    created_at: Any
    updated_at: Any
    deleted_at: Any
    version: int
    nombre: str
    activo: bool
    signo: int

    @classmethod
    def from_tuple(cls, row: tuple[Any, ...]) -> "ConceptRow":
        return cls(*row)

    def values(self) -> tuple[Any, ...]:
        return (
            self.id,
            self.created_at,
            self.updated_at,
            self.deleted_at,
            self.version,
            self.nombre,
            self.activo,
            self.signo,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza proyectos_conceptos de TEST a PROD"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Escribe cambios en PROD. Si se omite, solo muestra el plan.",
    )
    return parser.parse_args()


def get_database_url(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Falta configurar {name}.")
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


def fetch_test_rows(conn: psycopg.Connection) -> list[ConceptRow]:
    query = f"SELECT {', '.join(COLUMNS)} FROM {TABLE} ORDER BY id"
    with conn.cursor() as cur:
        cur.execute(query)
        return [ConceptRow.from_tuple(row) for row in cur.fetchall()]


def fetch_prod_indexes(conn: psycopg.Connection) -> tuple[dict[int, ConceptRow], dict[str, ConceptRow]]:
    rows = fetch_test_rows(conn)
    return {row.id: row for row in rows}, {row.nombre: row for row in rows}


def insert_row(cur: psycopg.Cursor, row: ConceptRow) -> None:
    placeholders = ", ".join(["%s"] * len(COLUMNS))
    cur.execute(
        f"INSERT INTO {TABLE} ({', '.join(COLUMNS)}) VALUES ({placeholders})",
        row.values(),
    )


def update_by_id(cur: psycopg.Cursor, row: ConceptRow) -> None:
    cur.execute(
        f"""
        UPDATE {TABLE}
        SET created_at = %s,
            updated_at = %s,
            deleted_at = %s,
            version = %s,
            nombre = %s,
            activo = %s,
            signo = %s
        WHERE id = %s
        """,
        (
            row.created_at,
            row.updated_at,
            row.deleted_at,
            row.version,
            row.nombre,
            row.activo,
            row.signo,
            row.id,
        ),
    )


def update_by_name(cur: psycopg.Cursor, row: ConceptRow) -> None:
    cur.execute(
        f"""
        UPDATE {TABLE}
        SET updated_at = %s,
            deleted_at = %s,
            version = GREATEST(version, %s),
            activo = %s,
            signo = %s
        WHERE nombre = %s
        """,
        (
            row.updated_at,
            row.deleted_at,
            row.version,
            row.activo,
            row.signo,
            row.nombre,
        ),
    )


def reset_sequence(cur: psycopg.Cursor) -> None:
    cur.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('proyectos_conceptos', 'id'),
            COALESCE((SELECT MAX(id) FROM proyectos_conceptos), 1),
            true
        )
        """
    )


def main() -> None:
    args = parse_args()
    dry_run = not args.apply

    test_url = get_database_url("TEST_DATABASE_URL")
    prod_url = get_database_url("PROD_DATABASE_URL")

    print("Conectando a TEST y PROD...")
    with psycopg.connect(test_url) as test_conn, psycopg.connect(prod_url) as prod_conn:
        test_rows = fetch_test_rows(test_conn)
        prod_by_id, prod_by_name = fetch_prod_indexes(prod_conn)

        to_insert: list[ConceptRow] = []
        to_update_by_id: list[ConceptRow] = []
        to_update_by_name: list[tuple[ConceptRow, int]] = []

        for row in test_rows:
            if row.id in prod_by_id:
                to_update_by_id.append(row)
            elif row.nombre in prod_by_name:
                to_update_by_name.append((row, prod_by_name[row.nombre].id))
            else:
                to_insert.append(row)

        print(f"Conceptos en TEST: {len(test_rows)}")
        print(f"Actualizar por id en PROD: {len(to_update_by_id)}")
        print(f"Actualizar por nombre en PROD: {len(to_update_by_name)}")
        print(f"Insertar nuevos en PROD: {len(to_insert)}")

        if to_update_by_name:
            print("Coincidencias por nombre con id distinto:")
            for row, prod_id in to_update_by_name:
                print(f"  TEST id={row.id} -> PROD id={prod_id}: {row.nombre}")

        if dry_run:
            print("Dry-run: no se escribieron cambios. Ejecuta con --apply para aplicar.")
            return

        with prod_conn.cursor() as cur:
            for row in to_update_by_id:
                update_by_id(cur, row)
            for row, _prod_id in to_update_by_name:
                update_by_name(cur, row)
            for row in to_insert:
                insert_row(cur, row)
            reset_sequence(cur)
        prod_conn.commit()

    print("Sincronizacion finalizada.")


if __name__ == "__main__":
    main()
