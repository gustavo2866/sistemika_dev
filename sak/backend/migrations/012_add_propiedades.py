#!/usr/bin/env python3
"""Migration 012: add propiedades catalog and property support for facturas (SQLite)."""

import os
import sqlite3

PROPIEDADES = (
    (1, 'Casa Central', 'Departamento', 'Inversiones SA', 'activa'),
    (2, 'Depósito Norte', 'Galpón', 'Logística SRL', 'activa'),
    (3, 'Oficina Microcentro', 'Oficina', 'Inmobiliaria SA', 'mantenimiento'),
    (4, 'Local Comercial 45', 'Local', 'Retail Partners', 'alquilada'),
    (5, 'Terreno Ruta 9', 'Terreno', 'Desarrollos SRL', 'disponible'),
)

PROPIEDADES_SQL = """
CREATE TABLE propiedades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    tipo VARCHAR(100) NOT NULL,
    propietario VARCHAR(255) NOT NULL,
    estado VARCHAR(100) NOT NULL
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
    propiedad_id INTEGER NULL,
    FOREIGN KEY (id_tipocomprobante) REFERENCES tipos_comprobante (id),
    FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    FOREIGN KEY (tipo_operacion_id) REFERENCES tipos_operacion (id),
    FOREIGN KEY (usuario_responsable_id) REFERENCES users (id),
    FOREIGN KEY (metodo_pago_id) REFERENCES metodos_pago (id),
    FOREIGN KEY (registrado_por_id) REFERENCES users (id),
    FOREIGN KEY (propiedad_id) REFERENCES propiedades (id)
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
    registrado_por_id,
    propiedad_id
)
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    COALESCE(version, 1),
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
    registrado_por_id,
    NULL AS propiedad_id
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


def ensure_propiedades(cursor: sqlite3.Cursor) -> None:
    if not table_exists(cursor, "propiedades"):
        cursor.executescript(PROPIEDADES_SQL)
    for prop_id, nombre, tipo, propietario, estado in PROPIEDADES:
        cursor.execute(
            "INSERT OR IGNORE INTO propiedades (id, nombre, tipo, propietario, estado) VALUES (?, ?, ?, ?, ?)",
            (prop_id, nombre, tipo, propietario, estado),
        )
    cursor.execute(
        "UPDATE propiedades SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), "
        "updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP), version = COALESCE(version, 1)"
    )


def ensure_tipos_operacion(cursor: sqlite3.Cursor) -> None:
    if not table_exists(cursor, "tipos_operacion"):
        return
    try:
        cursor.execute("ALTER TABLE tipos_operacion ADD COLUMN requiere_propiedad BOOLEAN NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    cursor.execute("UPDATE tipos_operacion SET requiere_propiedad = 1 WHERE id = 1")
    cursor.execute("UPDATE tipos_operacion SET requiere_propiedad = 0 WHERE id = 2")
    cursor.execute(
        "INSERT OR IGNORE INTO tipos_operacion (id, descripcion, activo, requiere_propiedad) VALUES (?, ?, ?, ?)",
        (999, 'Operacion asociada a propiedad', 1, 1),
    )


def rebuild_facturas(cursor: sqlite3.Cursor) -> None:
    if not table_exists(cursor, "facturas"):
        return
    cursor.execute("DROP TABLE IF EXISTS facturas_new")
    cursor.executescript(FACTURAS_NEW_SQL)
    cursor.executescript(COPY_FACTURAS_SQL)
    cursor.execute("DROP TABLE facturas")
    cursor.execute("ALTER TABLE facturas_new RENAME TO facturas")


def migrate() -> bool:
    db_path = find_db_path()
    if not db_path:
        print("[x] No se encontró la base de datos para migración 012")
        return False

    print(f"[>] Usando base de datos: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    try:
        ensure_propiedades(cursor)
        ensure_tipos_operacion(cursor)
        rebuild_facturas(cursor)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()
        print("[ok] Migración 012 aplicada")
        return True
    except Exception as exc:
        conn.rollback()
        print(f"[x] Error en migración 012: {exc}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
