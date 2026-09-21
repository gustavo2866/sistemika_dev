#!/usr/bin/env python3
"""Script temporal para poblar tarja_nomina desde tarja_novedades.

Este script NO forma parte de Alembic y se usa solo como carga inicial/manual.
Mantiene la legacy tarja_novedades intacta y escribe en la nueva tabla tarja_nomina.

Uso:
  python tmp/populate_tarja_nomina.py --dry-run
  python tmp/populate_tarja_nomina.py --apply

Notas:
- Mapea los datos existentes de tarja_novedades a la estructura nueva de tarja_nomina.
- Los importes específicos aún no definidos en la data legacy se dejan en 0 para evitar
  asumir reglas de negocio sin evidencia.
- La carga es idempotente: si el par (tarja_id, nomina_id) ya existe, se omite.
"""

from __future__ import annotations

import argparse
import json
import os
from decimal import Decimal
from typing import Any, Iterable

from dotenv import find_dotenv, load_dotenv
from sqlalchemy import create_engine, text


def get_database_url() -> str:
    load_dotenv(find_dotenv(usecwd=True), override=False)
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL no está configurada.")
    return url


def fetch_rows(conn) -> list[dict[str, Any]]:
    sql = text(
        """
        SELECT
            n.id,
            n.tarja_id,
            n.nomina_id,
            n.nomina_categoria_id,
            n.nomina_tarea_id,
            n.horas_justificadas,
            n.presentismo,
            n.adicional,
            n.premio AS premio_importe_legacy,
            n.observaciones,
            n.documentos,
            t.fechainicio AS fecha_desde,
            t.fechafinal AS fecha_hasta
        FROM tarja_novedades n
        LEFT JOIN tarjas t ON t.id = n.tarja_id
        WHERE n.deleted_at IS NULL
        ORDER BY n.id
        """
    )
    return [dict(row) for row in conn.execute(sql).mappings().all()]


def build_insert_values(row: dict[str, Any]) -> dict[str, Any]:
    premio_legacy = row.get("premio_importe_legacy") or Decimal("0")
    adicional_legacy = row.get("adicional") or Decimal("0")
    presentismo_value = bool(row.get("presentismo"))
    documentos = row.get("documentos")

    return {
        "tarja_id": row["tarja_id"],
        "nomina_id": row["nomina_id"],
        "nomina_categoria_id": row["nomina_categoria_id"],
        "nomina_tarea_id": row["nomina_tarea_id"],
        "horas_justificadas": row["horas_justificadas"] or Decimal("0"),
        "presentismo": presentismo_value,
        "presentismo_importe": Decimal("0"),
        "adicional_importe": adicional_legacy,
        "premio": premio_legacy > 0,
        "premio_importe": premio_legacy,
        "viatico": False,
        "viatico_importe": Decimal("0"),
        "sueldo_importe": Decimal("0"),
        "mejora_importe": Decimal("0"),
        "cargas_importe": Decimal("0"),
        "fecha_desde": row["fecha_desde"],
        "fecha_hasta": row["fecha_hasta"],
        "observaciones": row["observaciones"],
        "documentos": json.dumps(documentos) if documentos is not None else None,
    }


def load_existing_keys(conn) -> set[tuple[int | None, int | None]]:
    sql = text("SELECT tarja_id, nomina_id FROM tarja_nomina")
    return {(row[0], row[1]) for row in conn.execute(sql).fetchall()}


def dry_run(rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    for row in rows:
        build_insert_values(row)
        count += 1
    return count


def apply(rows: Iterable[dict[str, Any]], conn) -> int:
    existing = load_existing_keys(conn)
    inserted = 0
    for row in rows:
        target_key = (row["tarja_id"], row["nomina_id"])
        if target_key in existing:
            continue

        values = build_insert_values(row)
        sql = text(
            """
            INSERT INTO tarja_nomina (
                created_at, updated_at, deleted_at, version,
                tarja_id, nomina_id, nomina_categoria_id, nomina_tarea_id,
                horas_justificadas, presentismo, presentismo_importe, adicional_importe,
                premio, premio_importe, viatico, viatico_importe,
                sueldo_importe, mejora_importe, cargas_importe,
                fecha_desde, fecha_hasta, observaciones, documentos
            )
            VALUES (
                NOW(), NOW(), NULL, 1,
                :tarja_id, :nomina_id, :nomina_categoria_id, :nomina_tarea_id,
                :horas_justificadas, :presentismo, :presentismo_importe, :adicional_importe,
                :premio, :premio_importe, :viatico, :viatico_importe,
                :sueldo_importe, :mejora_importe, :cargas_importe,
                :fecha_desde, :fecha_hasta, :observaciones, :documentos
            )
            """
        )
        conn.execute(sql, values)
        existing.add(target_key)
        inserted += 1

    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Carga temporal de tarja_nomina desde tarja_novedades.")
    parser.add_argument("--apply", action="store_true", help="Ejecuta la inserción real en la base de datos.")
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra cuántas filas se procesarían.")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    engine = create_engine(get_database_url(), future=True)
    with engine.begin() as conn:
        rows = fetch_rows(conn)
        if args.dry_run:
            count = dry_run(rows)
            print(f"DRY_RUN: se procesarían {count} filas desde tarja_novedades hacia tarja_nomina.")
            return

        inserted = apply(rows, conn)
        print(f"INSERTED: {inserted} filas cargadas en tarja_nomina.")


if __name__ == "__main__":
    main()
