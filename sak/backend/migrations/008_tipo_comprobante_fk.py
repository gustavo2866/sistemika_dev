#!/usr/bin/env python3
"""Migration 008: introduce tipos_comprobante catalog and link facturas via FK."""

from __future__ import annotations

import os
import sqlite3
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Iterable

TIPOS_COMPROBANTE = (
    "Factura A",
    "Factura B",
    "Factura C",
    "Factura M",
    "NC A",
    "NC B",
    "NC C",
)

TIPOS_COMPROBANTE_SQL = """
CREATE TABLE IF NOT EXISTS tipos_comprobante (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    version INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL UNIQUE
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
    id_tipofactura INTEGER NOT NULL,
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
    FOREIGN KEY (id_tipofactura) REFERENCES tipos_comprobante (id),
    FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    FOREIGN KEY (tipo_operacion_id) REFERENCES tipos_operacion (id),
    FOREIGN KEY (usuario_responsable_id) REFERENCES users (id)
);
"""

DB_LOCATIONS: Iterable[Path] = (
    Path("invoice_system.db"),
    Path("data") / "invoice_system.db",
    Path("app") / "invoice_system.db",
)

_ALIAS_MAP = {
    "FACTURA A": "Factura A",
    "FACTURAA": "Factura A",
    "FACTURA B": "Factura B",
    "FACTURAB": "Factura B",
    "FACTURA C": "Factura C",
    "FACTURAC": "Factura C",
    "FACTURA M": "Factura M",
    "FACTURAM": "Factura M",
    "A": "Factura A",
    "B": "Factura B",
    "C": "Factura C",
    "M": "Factura M",
    "NC": "NC A",
    "NC A": "NC A",
    "NCA": "NC A",
    "NOTA DE CREDITO A": "NC A",
    "NC B": "NC B",
    "NCB": "NC B",
    "NOTA DE CREDITO B": "NC B",
    "NC C": "NC C",
    "NCC": "NC C",
    "NOTA DE CREDITO C": "NC C",
}


def find_db_path() -> Path | None:
    for candidate in DB_LOCATIONS:
        if candidate.exists():
            return candidate
    return None


def normalize(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = unicodedata.normalize("NFKD", str(value).strip())
    cleaned = "".join(ch for ch in cleaned if not unicodedata.combining(ch))
    if not cleaned:
        return None
    upper = cleaned.upper()
    if upper in _ALIAS_MAP:
        return _ALIAS_MAP[upper]
    if upper.startswith("FACTURA "):
        suffix = upper.split("FACTURA ", 1)[1].strip()
        candidate = _ALIAS_MAP.get(f"FACTURA {suffix}") or _ALIAS_MAP.get(suffix)
        if candidate:
            return candidate
    if upper.startswith("NOTA DE CREDITO "):
        suffix = upper.split("NOTA DE CREDITO ", 1)[1].strip()
        candidate = _ALIAS_MAP.get(f"NC {suffix}")
        if candidate:
            return candidate
    return upper.title()


def ensure_tipos_comprobante(cursor: sqlite3.Cursor) -> None:
    cursor.executescript(TIPOS_COMPROBANTE_SQL)
    for name in TIPOS_COMPROBANTE:
        cursor.execute(
            "INSERT OR IGNORE INTO tipos_comprobante (name) VALUES (?)",
            (name,),
        )


def get_tipo_id(cursor: sqlite3.Cursor, name: str) -> int:
    cursor.execute(
        "SELECT id FROM tipos_comprobante WHERE name = ?",
        (name,),
    )
    row = cursor.fetchone()
    if row:
        return int(row[0])
    cursor.execute(
        "INSERT INTO tipos_comprobante (name) VALUES (?)",
        (name,),
    )
    return cursor.lastrowid


def rebuild_facturas(cursor: sqlite3.Cursor) -> None:
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='facturas'"
    )
    if not cursor.fetchone():
        print("[=] Tabla facturas no encontrada, se omite reconstrucción")
        return

    cursor.execute("DROP TABLE IF EXISTS facturas_new")
    cursor.executescript(FACTURAS_TABLE_SQL)

    cursor.execute("SELECT * FROM facturas")
    rows = cursor.fetchall()

    columns = [col[1] for col in cursor.execute("PRAGMA table_info(facturas)")]

    for row in rows:
        row = dict(zip(columns, row))
        canonical = normalize(row.get("tipo_comprobante")) or "Factura A"
        tipo_id = get_tipo_id(cursor, canonical)
        fecha_recepcion = row.get("fecha_recepcion")
        if not fecha_recepcion:
            fecha_recepcion = datetime.utcnow().isoformat()
        cursor.execute(
            """
            INSERT INTO facturas_new (
                id,
                created_at,
                updated_at,
                deleted_at,
                version,
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
                usuario_responsable_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row.get("id"),
                row.get("created_at"),
                row.get("updated_at"),
                row.get("deleted_at"),
                row.get("version", 1),
                row.get("numero"),
                row.get("punto_venta"),
                tipo_id,
                row.get("fecha_emision") or "",
                row.get("fecha_vencimiento"),
                fecha_recepcion,
                row.get("subtotal", 0),
                row.get("total_impuestos", 0),
                row.get("total", 0),
                row.get("estado", "pendiente"),
                row.get("observaciones"),
                row.get("nombre_archivo_pdf"),
                row.get("ruta_archivo_pdf"),
                row.get("comprobante_id"),
                row.get("proveedor_id"),
                row.get("tipo_operacion_id"),
                row.get("usuario_responsable_id"),
            ),
        )

    cursor.execute("ALTER TABLE facturas RENAME TO facturas_old")
    cursor.execute("ALTER TABLE facturas_new RENAME TO facturas")
    cursor.execute("DROP TABLE facturas_old")


def migrate() -> bool:
    db_path = find_db_path()
    if not db_path:
        print("[x] No se encontró la base de datos para la migración 008")
        return False

    print(f"[>] Usando base de datos: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        ensure_tipos_comprobante(cursor)
        rebuild_facturas(cursor)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()
        print("[ok] Migración 008 completada")
        return True
    except Exception as exc:  # pragma: no cover - logging de errores
        conn.rollback()
        print(f"[x] Error en migración 008: {exc}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
