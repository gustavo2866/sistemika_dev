#!/usr/bin/env python3
"""Migration 010: add metodos_pago table and new relations for facturas (SQLite)."""

import os
import sqlite3

METODOS_PAGO = (
    (1, "Caja"),
    (2, "Cheque"),
    (3, "Pago Facil"),
)

METODOS_PAGO_SQL = """
CREATE TABLE metodos_pago (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    nombre VARCHAR(100) NOT NULL UNIQUE
);
"""

FACTURAS_NEW_SQL = """
CREATE TABLE facturas_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    numero VARCHAR(50) NOT NULL,
    punto_venta VARCHAR(10) NOT NULL,
    id_tipocomprobante INTEGER NOT NULL,
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
    metodo_pago_id INTEGER NOT NULL DEFAULT 1,
    registrado_por_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (id_tipocomprobante) REFERENCES tipos_comprobante (id),
    FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    FOREIGN KEY (tipo_operacion_id) REFERENCES tipos_operacion (id),
    FOREIGN KEY (usuario_responsable_id) REFERENCES users (id),
    FOREIGN KEY (metodo_pago_id) REFERENCES metodos_pago (id),
    FOREIGN KEY (registrado_por_id) REFERENCES users (id)
);
"""

COPY_FACTURAS_SQL = """
INSERT INTO facturas_new (
    id,
    created_at,
    updated_at,
    deleted_at,
    version,
    numero,
    punto_venta,
    id_tipocomprobante,
    fecha_emision,
    fecha_vencimiento,
    fecha_recepcion,
    subtotal,
    total_impuestos,
    total,
    estado,
    observaciones,
    nombre_archivo_pdf,
    ruta_archivo_pdf,
    comprobante_id,
    proveedor_id,
    tipo_operacion_id,
    usuario_responsable_id,
    metodo_pago_id,
    registrado_por_id
)
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    COALESCE(version, 1),
    numero,
    punto_venta,
    id_tipofactura,
    fecha_emision,
    fecha_vencimiento,
    fecha_recepcion,
    subtotal,
    total_impuestos,
    total,
    estado,
    observaciones,
    nombre_archivo_pdf,
    ruta_archivo_pdf,
    comprobante_id,
    proveedor_id,
    tipo_operacion_id,
    usuario_responsable_id,
    1 AS metodo_pago_id,
    1 AS registrado_por_id
FROM facturas;
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


def ensure_metodos_pago(cursor: sqlite3.Cursor) -> None:
    if not table_exists(cursor, "metodos_pago"):
        cursor.executescript(METODOS_PAGO_SQL)
    for metodo_id, nombre in METODOS_PAGO:
        cursor.execute(
            "INSERT OR IGNORE INTO metodos_pago (id, nombre) VALUES (?, ?)",
            (metodo_id, nombre),
        )
    cursor.execute(
        "UPDATE metodos_pago SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), "
        "updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP), version = COALESCE(version, 1)"
    )


def rebuild_facturas(cursor: sqlite3.Cursor) -> None:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='facturas'")
    if not cursor.fetchone():
        return

    cursor.execute("DROP TABLE IF EXISTS facturas_new")
    cursor.executescript(FACTURAS_NEW_SQL)
    cursor.executescript(COPY_FACTURAS_SQL)
    cursor.execute("DROP TABLE facturas")
    cursor.execute("ALTER TABLE facturas_new RENAME TO facturas")


def migrate() -> bool:
    db_path = find_db_path()
    if not db_path:
        print("[x] No se encontró la base de datos para migración 010")
        return False

    print(f"[>] Usando base de datos: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    try:
        ensure_metodos_pago(cursor)
        rebuild_facturas(cursor)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()
        print("[ok] Migración 010 aplicada")
        return True
    except Exception as exc:
        conn.rollback()
        print(f"[x] Error en migración 010: {exc}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
