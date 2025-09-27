#!/usr/bin/env python3
"""Migration 007: align facturas table with comprobante FK and migrate extraction history."""

import os
import sqlite3

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

FACTURAS_TABLE_SQL = """
CREATE TABLE facturas_new (
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

COPY_SQL = """
INSERT INTO facturas_new (
    id,
    created_at,
    updated_at,
    deleted_at,
    version,
    numero,
    punto_venta,
    tipo_comprobante,
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
    usuario_responsable_id
)
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    version,
    numero,
    punto_venta,
    tipo_comprobante,
    COALESCE(fecha_emision, ''),
    fecha_vencimiento,
    COALESCE(fecha_recepcion, CURRENT_TIMESTAMP),
    subtotal,
    total_impuestos,
    total,
    estado,
    observaciones,
    nombre_archivo_pdf,
    ruta_archivo_pdf,
    NULL AS comprobante_id,
    proveedor_id,
    tipo_operacion_id,
    usuario_responsable_id
FROM facturas;
"""

MIGRATE_EXTRACTIONS_SQL = """
INSERT OR IGNORE INTO comprobantes (
    id,
    created_at,
    updated_at,
    deleted_at,
    version,
    archivo_nombre,
    archivo_guardado,
    archivo_ruta,
    file_type,
    is_pdf,
    extraido_por_ocr,
    extraido_por_llm,
    confianza_extraccion,
    metodo_extraccion,
    extractor_version,
    estado,
    proveedor_id,
    tipo_operacion_id,
    warnings,
    error,
    raw_json
)
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    version,
    archivo_nombre,
    COALESCE(NULLIF(archivo_guardado, ''), archivo_nombre, 'archivo_' || id),
    archivo_ruta,
    file_type,
    is_pdf,
    0,
    0,
    NULL,
    metodo_extraccion,
    extractor_version,
    estado,
    proveedor_id,
    tipo_operacion_id,
    warnings,
    error,
    payload_json
FROM facturas_extracciones;
"""

UPDATE_FACTURAS_FROM_EXTRACTIONS = """
UPDATE facturas
SET comprobante_id = (
    SELECT fe.id
    FROM facturas_extracciones fe
    WHERE fe.factura_id = facturas.id
    ORDER BY fe.id DESC
    LIMIT 1
)
WHERE (comprobante_id IS NULL OR comprobante_id = '')
  AND EXISTS (
      SELECT 1 FROM facturas_extracciones fe
      WHERE fe.factura_id = facturas.id
  );
"""

DB_LOCATIONS = (
    "invoice_system.db",
    os.path.join("data", "invoice_system.db"),
    os.path.join("app", "invoice_system.db"),
)

REQUIRED_COMPROBANTE_COLUMNS = (
    "archivo_guardado",
    "archivo_ruta",
    "raw_json",
    "extraido_por_ocr",
    "extraido_por_llm",
    "confianza_extraccion",
)


def find_db_path() -> str | None:
    for candidate in DB_LOCATIONS:
        if os.path.exists(candidate):
            return candidate
    return None


def table_exists(cursor: sqlite3.Cursor, name: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cursor.fetchone() is not None


def column_exists(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def ensure_comprobantes_table(cursor: sqlite3.Cursor) -> None:
    if not table_exists(cursor, "comprobantes"):
        print("[+] Creando tabla comprobantes")
        cursor.executescript(COMPROBANTES_SQL)
        return

    missing = [col for col in REQUIRED_COMPROBANTE_COLUMNS if not column_exists(cursor, "comprobantes", col)]
    for col in missing:
        print(f"[+] Agregando columna {col} a comprobantes")
        if col in {"extraido_por_ocr", "extraido_por_llm"}:
            cursor.execute(f"ALTER TABLE comprobantes ADD COLUMN {col} BOOLEAN NOT NULL DEFAULT 0")
        elif col == "confianza_extraccion":
            cursor.execute("ALTER TABLE comprobantes ADD COLUMN confianza_extraccion REAL NULL")
        elif col == "raw_json":
            cursor.execute("ALTER TABLE comprobantes ADD COLUMN raw_json TEXT NULL")
        elif col == "archivo_guardado":
            cursor.execute("ALTER TABLE comprobantes ADD COLUMN archivo_guardado VARCHAR(500) NULL")
        elif col == "archivo_ruta":
            cursor.execute("ALTER TABLE comprobantes ADD COLUMN archivo_ruta VARCHAR(1000) NULL")
    if missing:
        print(f"[i] Tabla comprobantes actualizada con columnas: {missing}")

    cursor.execute(
        "UPDATE comprobantes SET archivo_guardado = COALESCE(NULLIF(archivo_guardado, ''), archivo_nombre, 'archivo_' || id) "
        "WHERE archivo_guardado IS NULL OR archivo_guardado = ''"
    )


def migrate_facturas(cursor: sqlite3.Cursor) -> None:
    needs_new_structure = column_exists(cursor, "facturas", "extraido_por_ocr") or not column_exists(cursor, "facturas", "comprobante_id")
    if not needs_new_structure:
        print("[=] Tabla facturas ya tiene la estructura esperada")
        return

    print("[>] Reestructurando tabla facturas")
    cursor.execute("DROP TABLE IF EXISTS facturas_new")
    cursor.executescript(FACTURAS_TABLE_SQL)
    cursor.executescript(COPY_SQL)
    cursor.execute("ALTER TABLE facturas RENAME TO facturas_old")
    cursor.execute("ALTER TABLE facturas_new RENAME TO facturas")
    cursor.execute("DROP TABLE facturas_old")
    print("[+] Tabla facturas actualizada")


def migrate_extractions(cursor: sqlite3.Cursor) -> None:
    if not table_exists(cursor, "facturas_extracciones"):
        print("[=] Tabla facturas_extracciones no existe, nada para migrar")
        return

    cursor.execute("SELECT COUNT(*) FROM facturas_extracciones")
    total = cursor.fetchone()[0]
    if total == 0:
        cursor.execute("DROP TABLE facturas_extracciones")
        print("[i] Tabla facturas_extracciones estaba vacia, se elimino")
        return

    print(f"[>] Migrando {total} registros desde facturas_extracciones")
    cursor.executescript(MIGRATE_EXTRACTIONS_SQL)
    cursor.executescript(UPDATE_FACTURAS_FROM_EXTRACTIONS)
    cursor.execute("DROP TABLE facturas_extracciones")
    print("[+] Migracion de facturas_extracciones completada")


def migrate() -> bool:
    db_path = find_db_path()
    if not db_path:
        print("[x] No se encontro la base de datos para ejecutar la migracion")
        return False

    print(f"[>] Usando base de datos: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        ensure_comprobantes_table(cursor)
        migrate_facturas(cursor)
        migrate_extractions(cursor)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()
        print("[ok] Migracion completada")
        return True
    except Exception as exc:
        conn.rollback()
        print(f"[x] Error durante la migracion: {exc}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    print("[>] Ejecutando migracion 007: actualizar facturas con comprobante opcional")
    success = migrate()
    if success:
        print("[ok] Migracion aplicada correctamente")
    else:
        print("[x] La migracion no pudo completarse")

