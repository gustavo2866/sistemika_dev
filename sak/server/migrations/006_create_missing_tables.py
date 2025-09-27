#!/usr/bin/env python3
"""Migration 006: create missing catalog and invoice tables."""

import os
import sqlite3

TIPOS_OPERACION_SQL = """
CREATE TABLE tipos_operacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    descripcion VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT 1
);
"""

TIPOS_OPERACION_SEED = (
    ("Gastos Generales", 1),
    ("Servicios", 1),
    ("Compras", 1),
)

PROVEEDORES_SQL = """
CREATE TABLE proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    nombre VARCHAR(255) NOT NULL,
    razon_social VARCHAR(255) NOT NULL,
    cuit VARCHAR(15) NOT NULL UNIQUE,
    telefono VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    direccion VARCHAR(500) NULL,
    cbu VARCHAR(22) NULL,
    alias_bancario VARCHAR(100) NULL,
    activo BOOLEAN NOT NULL DEFAULT 1
);
"""

PROVEEDOR_SEED = (
    "Proveedor Test",
    "Proveedor Test S.A.",
    "20-12345678-9",
    "test@proveedor.com",
    1,
)

COMPROBANTES_SQL = """
CREATE TABLE comprobantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    archivo_nombre VARCHAR(500) NULL,
    archivo_guardado VARCHAR(500) NOT NULL,
    archivo_ruta VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50) NULL,
    is_pdf BOOLEAN NOT NULL DEFAULT 1,
    extraido_por_ocr BOOLEAN NOT NULL DEFAULT 0,
    extraido_por_llm BOOLEAN NOT NULL DEFAULT 0,
    confianza_extraccion REAL NULL,
    metodo_extraccion VARCHAR(50) NULL,
    extractor_version VARCHAR(50) NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    proveedor_id INTEGER NULL,
    tipo_operacion_id INTEGER NULL,
    warnings TEXT NULL,
    error TEXT NULL,
    raw_json TEXT NULL,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    FOREIGN KEY (tipo_operacion_id) REFERENCES tipos_operacion (id)
);
"""

FACTURAS_SQL = """
CREATE TABLE facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    numero VARCHAR(50) NOT NULL,
    punto_venta VARCHAR(10) NOT NULL,
    tipo_comprobante VARCHAR(20) NOT NULL,
    fecha_emision VARCHAR(10) NOT NULL,
    fecha_vencimiento VARCHAR(10) NULL,
    fecha_recepcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(15,2) NOT NULL,
    total_impuestos DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    observaciones TEXT NULL,
    nombre_archivo_pdf VARCHAR(500) NULL,
    ruta_archivo_pdf VARCHAR(1000) NULL,
    comprobante_id INTEGER NULL,
    proveedor_id INTEGER NOT NULL,
    tipo_operacion_id INTEGER NOT NULL,
    usuario_responsable_id INTEGER NOT NULL,
    FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    FOREIGN KEY (tipo_operacion_id) REFERENCES tipos_operacion (id),
    FOREIGN KEY (usuario_responsable_id) REFERENCES users (id)
);
"""

DB_LOCATIONS = (
    "invoice_system.db",
    os.path.join("data", "invoice_system.db"),
    os.path.join("app", "invoice_system.db"),
)


def find_db_path() -> str | None:
    for candidate in DB_LOCATIONS:
        if os.path.exists(candidate):
            return candidate
    return None


def table_exists(cursor: sqlite3.Cursor, name: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cursor.fetchone() is not None


def ensure_tipos_operacion(cursor: sqlite3.Cursor) -> None:
    if table_exists(cursor, "tipos_operacion"):
        print("[=] Tabla tipos_operacion ya existe")
        return
    print("[+] Creando tabla tipos_operacion")
    cursor.executescript(TIPOS_OPERACION_SQL)
    cursor.executemany(
        "INSERT INTO tipos_operacion (descripcion, activo) VALUES (?, ?)",
        TIPOS_OPERACION_SEED,
    )
    print("[+] Tabla tipos_operacion creada con datos iniciales")


def ensure_proveedores(cursor: sqlite3.Cursor) -> None:
    if table_exists(cursor, "proveedores"):
        print("[=] Tabla proveedores ya existe")
        return
    print("[+] Creando tabla proveedores")
    cursor.executescript(PROVEEDORES_SQL)
    cursor.execute(
        """
        INSERT INTO proveedores (
            nombre, razon_social, cuit, email, activo
        ) VALUES (?, ?, ?, ?, ?)
        """,
        PROVEEDOR_SEED,
    )
    print("[+] Tabla proveedores creada con datos iniciales")


def ensure_comprobantes(cursor: sqlite3.Cursor) -> None:
    if table_exists(cursor, "comprobantes"):
        print("[=] Tabla comprobantes ya existe")
        return
    print("[+] Creando tabla comprobantes")
    cursor.executescript(COMPROBANTES_SQL)


def ensure_facturas(cursor: sqlite3.Cursor) -> None:
    if table_exists(cursor, "facturas"):
        print("[=] Tabla facturas ya existe")
        return
    print("[+] Creando tabla facturas")
    cursor.executescript(FACTURAS_SQL)


def create_missing_tables() -> bool:
    db_path = find_db_path()
    if not db_path:
        print("[x] No se encontro la base de datos para la migracion 006")
        return False

    print(f"[>] Usando base de datos: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    try:
        ensure_tipos_operacion(cursor)
        ensure_proveedores(cursor)
        ensure_comprobantes(cursor)
        ensure_facturas(cursor)
        conn.commit()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = sorted(row[0] for row in cursor.fetchall())
        print(f"[>] Tablas disponibles: {tables}")
        return True
    except Exception as exc:
        conn.rollback()
        print(f"[x] Error en migracion 006: {exc}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    success = create_missing_tables()
    if success:
        print("[ok] Migracion 006 completada")
    else:
        print("[x] Migracion 006 incompleta")

