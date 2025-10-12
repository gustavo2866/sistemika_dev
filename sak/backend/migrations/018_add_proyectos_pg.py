#!/usr/bin/env python3
"""Migration 018: create proyectos table with seed data (PostgreSQL)."""

from __future__ import annotations

import os
from datetime import date

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text


PROYECTOS_SEED = [
    {
        "nombre": "Construccion Nave Industrial",
        "fecha_inicio": date(2025, 1, 15),
        "fecha_final": date(2025, 9, 30),
        "estado": "planificado",
        "importe_mat": 125000000.00,
        "importe_mo": 87500000.00,
        "comentario": "Proyecto clave para ampliar capacidad de almacenamiento.",
    },
    {
        "nombre": "Remodelacion Centro de Servicios",
        "fecha_inicio": date(2024, 11, 1),
        "fecha_final": None,
        "estado": "en_ejecucion",
        "importe_mat": 38500000.00,
        "importe_mo": 22500000.00,
        "comentario": "Incluye actualizacion de instalaciones electricas y climatizacion.",
    },
]


CREATE_TABLE_SQL = """
CREATE TABLE proyectos (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    version INTEGER NOT NULL DEFAULT 1,
    nombre VARCHAR(150) NOT NULL,
    fecha_inicio DATE NULL,
    fecha_final DATE NULL,
    estado VARCHAR(50) NULL,
    importe_mat NUMERIC(14,2) NOT NULL DEFAULT 0,
    importe_mo NUMERIC(14,2) NOT NULL DEFAULT 0,
    comentario TEXT NULL
)
"""


def ensure_table(engine) -> None:
    inspector = inspect(engine)
    if "proyectos" in inspector.get_table_names():
        print("[=] Tabla proyectos ya existe")
        return

    print("[+] Creando tabla proyectos")
    with engine.begin() as conn:
        conn.execute(text(CREATE_TABLE_SQL))


def seed_data(engine) -> None:
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM proyectos"))
        existing = count.scalar_one()
        if existing:
            print(f"[=] Tabla proyectos ya contiene {existing} registros")
            return

        print("[+] Insertando registros seed en proyectos")
        insert_sql = text(
            """
            INSERT INTO proyectos
            (nombre, fecha_inicio, fecha_final, estado, importe_mat, importe_mo, comentario)
            VALUES (:nombre, :fecha_inicio, :fecha_final, :estado, :importe_mat, :importe_mo, :comentario)
            """
        )
        for record in PROYECTOS_SEED:
            conn.execute(insert_sql, record)


def run() -> bool:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("[x] DATABASE_URL no definido. Abortando migracion 018.")
        return False

    engine = create_engine(database_url)
    try:
        ensure_table(engine)
        seed_data(engine)
        print("[ok] Migracion 018 aplicada en la base PostgreSQL")
        return True
    finally:
        engine.dispose()


if __name__ == "__main__":
    run()
