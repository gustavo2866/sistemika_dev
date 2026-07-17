"""
Sincroniza proyectos y tablas dependientes de TEST → PROD.

Qué copia:
- proyectos
- proyecto_avance
- proyecto_encargados
- proy_presupuestos

Estrategia:
- Usa upsert por `id` para mantener consistencia y permitir re-ejecuciones.
- Preserva los IDs de origen para que las claves foráneas entre tablas sigan funcionando.
- Si una referencia externa no existe en PROD (por ejemplo responsable_id o contacto_id),
  se omite el registro o se convierte a valor válido según la tabla.

Uso:
    cd backend
    python scripts/sync_proyectos_test_to_prod.py

Opciones:
    --dry-run      Solo muestra cuántos registros se procesarían sin escribir.
    --limit N      Limita la cantidad de registros de proyectos a copiar.
"""

from __future__ import annotations

import argparse
import os
from typing import Any, List, Sequence

import psycopg

TEST_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://neondb_owner:npg_2HqUWwPRtEy7"
    "@ep-dry-dew-ack3rlnb-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require",
)
PROD_URL = os.getenv(
    "PROD_DATABASE_URL",
    "postgresql://neondb_owner:npg_2HqUWwPRtEy7"
    "@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require",
)

TABLE_SPECS = [
    {
        "name": "proyectos",
        "columns": [
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "version",
            "nombre",
            "fecha_inicio",
            "fecha_final",
            "estado",
            "centro_costo",
            "importe_mat",
            "importe_mo",
            "terceros",
            "herramientas",
            "superficie",
            "ingresos",
            "comentario",
            "oportunidad_id",
            "responsable_id",
        ],
    },
    {
        "name": "proyecto_avance",
        "columns": [
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "version",
            "proyecto_id",
            "horas",
            "avance",
            "importe",
            "comentario",
            "fecha_registracion",
        ],
    },
    {
        "name": "proyecto_encargados",
        "columns": [
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "version",
            "proyecto_id",
            "contacto_id",
            "principal",
            "activo",
            "desde",
            "hasta",
            "notas",
        ],
    },
    {
        "name": "proy_presupuestos",
        "columns": [
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "version",
            "proyecto_id",
            "fecha",
            "mo_propia",
            "mo_terceros",
            "materiales",
            "herramientas",
            "horas",
            "metros",
            "importe",
            "descripcion",
        ],
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sincroniza proyectos de TEST a PROD")
    parser.add_argument("--dry-run", action="store_true", help="No escribe cambios en PROD")
    parser.add_argument("--limit", type=int, default=None, help="Limita la cantidad de proyectos a copiar")
    return parser.parse_args()


def connect(url: str) -> psycopg.Connection:
    return psycopg.connect(url)


def fetch_rows(conn: psycopg.Connection, table: str, columns: Sequence[str], limit: int | None = None) -> List[tuple[Any, ...]]:
    cols_sql = ", ".join(columns)
    query = f"SELECT {cols_sql} FROM {table}"
    if table == "proyectos" and limit is not None:
        query += f" ORDER BY id LIMIT {limit}"
    elif table != "proyectos":
        query += " ORDER BY id"
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()


def ensure_valid_project_refs(prod_conn: psycopg.Connection, projects: List[tuple[Any, ...]]) -> tuple[set[int], set[int], set[int]]:
    project_ids = {row[0] for row in projects}
    if not project_ids:
        return set(), set(), set()

    with prod_conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE id = ANY(%s)", (list({row[18] for row in projects if row[18] is not None}),))
        existing_users = {row[0] for row in cur.fetchall()}

        cur.execute("SELECT id FROM crm_oportunidades WHERE id = ANY(%s)", (list({row[17] for row in projects if row[17] is not None}),))
        existing_oportunidades = {row[0] for row in cur.fetchall()}

    return project_ids, existing_users, existing_oportunidades


def validate_project_row(project: tuple[Any, ...], existing_users: set[int], existing_oportunidades: set[int]) -> tuple[Any, ...]:
    # `responsable_id` y `oportunidad_id` pueden ser referenciadas desde otras bases;
    # si no existen en PROD, las dejamos nulas para evitar fallos de FK.
    if project[18] is not None and project[18] not in existing_users:
        project = list(project)
        project[18] = None
        project = tuple(project)
    if project[17] is not None and project[17] not in existing_oportunidades:
        project = list(project)
        project[17] = None
        project = tuple(project)
    return project


def build_upsert_query(table: str, columns: Sequence[str]) -> str:
    cols_sql = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))
    set_clause = ", ".join(f"{col} = EXCLUDED.{col}" for col in columns if col != "id")
    return f"""
        INSERT INTO {table} ({cols_sql})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET {set_clause}
    """


def upsert_rows(conn: psycopg.Connection, table: str, columns: Sequence[str], rows: Sequence[tuple[Any, ...]]) -> int:
    if not rows:
        return 0
    query = build_upsert_query(table, columns)
    with conn.cursor() as cur:
        cur.executemany(query, rows)
    return len(rows)


def sync_projects(test_conn: psycopg.Connection, prod_conn: psycopg.Connection, limit: int | None, dry_run: bool) -> None:
    print("Leyendo proyectos desde TEST...")
    project_rows = fetch_rows(test_conn, "proyectos", TABLE_SPECS[0]["columns"], limit=limit)
    print(f"Proyectos encontrados en TEST: {len(project_rows)}")

    if not project_rows:
        print("No hay proyectos para copiar.")
        return

    source_project_ids, existing_users, existing_oportunidades = ensure_valid_project_refs(prod_conn, project_rows)
    normalized_projects: List[tuple[Any, ...]] = []
    for row in project_rows:
        normalized = validate_project_row(row, existing_users, existing_oportunidades)
        normalized_projects.append(normalized)

    print("Copiando tabla proyectos...")
    if dry_run:
        print(f"[dry-run] Se insertarían/actualizarían {len(normalized_projects)} proyectos en PROD")
    else:
        upsert_rows(prod_conn, "proyectos", TABLE_SPECS[0]["columns"], normalized_projects)
        prod_conn.commit()
        print(f"Proyectos sincronizados: {len(normalized_projects)}")

    for spec in TABLE_SPECS[1:]:
        table = spec["name"]
        columns = spec["columns"]
        rows = fetch_rows(test_conn, table, columns)
        if not rows:
            print(f"{table}: sin registros en TEST")
            continue

        filtered_rows: List[tuple[Any, ...]] = []
        for row in rows:
            row_list = list(row)
            if table == "proyecto_avance":
                project_id = row_list[5]
                if project_id not in source_project_ids:
                    continue
            elif table == "proyecto_encargados":
                project_id = row_list[5]
                if project_id not in source_project_ids:
                    continue
                contacto_id = row_list[5 + 1]
                # La tabla depende de crm_contactos; si no existe, se omite.
                with prod_conn.cursor() as cur:
                    cur.execute("SELECT 1 FROM crm_contactos WHERE id = %s", (contacto_id,))
                    if cur.fetchone() is None:
                        continue
            elif table == "proy_presupuestos":
                project_id = row_list[5]
                if project_id not in source_project_ids:
                    continue

            filtered_rows.append(tuple(row_list))

        print(f"{table}: registros en TEST = {len(rows)}; registros válidos para PROD = {len(filtered_rows)}")
        if dry_run:
            print(f"[dry-run] Se insertarían/actualizarían {len(filtered_rows)} registros en {table}")
        else:
            upsert_rows(prod_conn, table, columns, filtered_rows)
            prod_conn.commit()
            print(f"{table}: sincronizada ({len(filtered_rows)} filas)")


def main() -> None:
    args = parse_args()
    print("Conectando a TEST y PROD...")
    with connect(TEST_URL) as test_conn, connect(PROD_URL) as prod_conn:
        sync_projects(test_conn, prod_conn, limit=args.limit, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
