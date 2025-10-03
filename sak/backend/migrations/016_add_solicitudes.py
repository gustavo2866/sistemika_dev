#!/usr/bin/env python3
"""Migration 016: create solicitudes master/detail tables (SQLite)."""

import os
import sqlite3

DB_LOCATIONS = (
    "invoice_system.db",
    os.path.join("data", "invoice_system.db"),
    os.path.join("app", "invoice_system.db"),
)

SOLICITUDES_TABLE_SQL = """
CREATE TABLE solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('normal','directa')),
    fecha_necesidad DATE NOT NULL,
    comentario TEXT NULL,
    solicitante_id INTEGER NOT NULL,
    FOREIGN KEY (solicitante_id) REFERENCES users (id)
);
"""

SOLICITUDES_INDEX_SQL = "CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante_id ON solicitudes (solicitante_id);"

SOLICITUD_DETALLES_TABLE_SQL = """
CREATE TABLE solicitud_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    solicitud_id INTEGER NOT NULL,
    articulo_id INTEGER NULL,
    descripcion TEXT NOT NULL,
    unidad_medida VARCHAR(50) NULL,
    cantidad DECIMAL(12,3) NOT NULL,
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes (id) ON DELETE CASCADE,
    FOREIGN KEY (articulo_id) REFERENCES articulos (id)
);
"""

SOLICITUD_DETALLES_INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_solicitud_detalles_solicitud_id ON solicitud_detalles (solicitud_id);",
    "CREATE INDEX IF NOT EXISTS idx_solicitud_detalles_articulo_id ON solicitud_detalles (articulo_id);",
)


def find_db_path() -> str | None:
    for candidate in DB_LOCATIONS:
        if os.path.exists(candidate):
            return candidate
    return None


def table_exists(cursor: sqlite3.Cursor, name: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cursor.fetchone() is not None


def ensure_table(cursor: sqlite3.Cursor, name: str, create_sql: str) -> None:
    if table_exists(cursor, name):
        print(f"[=] Tabla {name} ya existe")
        return
    print(f"[+] Creando tabla {name}")
    cursor.executescript(create_sql)


def ensure_indexes(cursor: sqlite3.Cursor, statements: tuple[str, ...]) -> None:
    for stmt in statements:
        print(f"[>] Ejecutando: {stmt}")
        cursor.execute(stmt)


def migrate() -> bool:
    db_path = find_db_path()
    if not db_path:
        print("[x] No se encontro la base de datos para migracion 016")
        return False

    print(f"[>] Usando base de datos: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    try:
        ensure_table(cursor, "solicitudes", SOLICITUDES_TABLE_SQL)
        cursor.execute(SOLICITUDES_INDEX_SQL)
        ensure_table(cursor, "solicitud_detalles", SOLICITUD_DETALLES_TABLE_SQL)
        ensure_indexes(cursor, SOLICITUD_DETALLES_INDEXES)
        conn.commit()
        print("[ok] Migracion 016 aplicada")
        return True
    except Exception as exc:
        conn.rollback()
        print(f"[x] Error en migracion 016: {exc}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
