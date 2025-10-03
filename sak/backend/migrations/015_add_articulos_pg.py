#!/usr/bin/env python3
"""Migration 015: add articulos catalog (PostgreSQL)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import MetaData, create_engine, inspect, text

ARTICULOS = (
    ('Cemento Portland 50kg', 'Material', 'bolsa', 'Holcim', 'CEM-PORT-50', 12500.00, 1),
    ('Arena Fina', 'Material', 'm3', 'La Cantera', 'ARE-FIN-01', 4500.00, 1),
    ('Grava 3/4', 'Material', 'm3', 'Piedras del Sur', 'GRAV-34-01', 5200.00, 1),
    ('Ladrillo Comun', 'Material', 'unidad', 'Ladrillera Norte', 'LAD-COM-01', 120.00, 2),
    ('Ladrillo Hueco 12', 'Material', 'unidad', 'Ladrillera Norte', 'LAD-H12-01', 210.00, 2),
    ('Block Hormigon 15', 'Material', 'unidad', 'PreMoldeados', 'BLO-H15-01', 380.00, 2),
    ('Hierro 8mm', 'Material', 'barra', 'Acindar', 'HIR-08-01', 9800.00, 1),
    ('Hierro 10mm', 'Material', 'barra', 'Acindar', 'HIR-10-01', 12500.00, 1),
    ('Hierro 12mm', 'Material', 'barra', 'Acindar', 'HIR-12-01', 16300.00, 1),
    ('Malla Sima 15x15', 'Material', 'rollo', 'MetalRed', 'SIM-15-01', 52800.00, 1),
    ('Clavo 2"', 'Ferreteria', 'kg', 'Clavos SRL', 'CLV-02-01', 3200.00, 3),
    ('Clavo 3"', 'Ferreteria', 'kg', 'Clavos SRL', 'CLV-03-01', 3500.00, 3),
    ('Clavo 4"', 'Ferreteria', 'kg', 'Clavos SRL', 'CLV-04-01', 3800.00, 3),
    ('Tornillo tirafondo 1"', 'Ferreteria', 'caja', 'Tornillos SA', 'TOR-10-01', 2100.00, 3),
    ('Tornillo tirafondo 2"', 'Ferreteria', 'caja', 'Tornillos SA', 'TOR-20-01', 2650.00, 3),
    ('Pintura Latex Blanca 20L', 'Pintura', 'balde', 'Colors', 'LAT-BLA-20', 18500.00, 4),
    ('Pintura Esmalte Satinado 4L', 'Pintura', 'lata', 'Colors', 'ESM-SAT-04', 9200.00, 4),
    ('Rodillo 23cm', 'Herramienta', 'unidad', 'Pintor Pro', 'ROD-23-01', 3200.00, 4),
    ('Brocha 2"', 'Herramienta', 'unidad', 'Pintor Pro', 'BRO-20-01', 950.00, 4),
    ('Silicona Transparente', 'Sellador', 'cartucho', 'SellaFix', 'SIL-TRA-01', 2600.00, 3),
    ('Silicona Blanca', 'Sellador', 'cartucho', 'SellaFix', 'SIL-BLA-01', 2600.00, 3),
    ('Sellador Poliuretano', 'Sellador', 'cartucho', 'SellaFix', 'SEL-POL-01', 3650.00, 3),
    ('Membrana Asfaltica 4mm', 'Impermeabilizante', 'rollo', 'Impermax', 'MEM-4M-01', 34800.00, 4),
    ('Membrana Asfaltica 5mm', 'Impermeabilizante', 'rollo', 'Impermax', 'MEM-5M-01', 39800.00, 4),
    ('Teja Colonial Roja', 'Cubierta', 'unidad', 'Tejaria', 'TEJ-COL-01', 890.00, 2),
    ('Teja Americana Gris', 'Cubierta', 'unidad', 'Tejaria', 'TEJ-AME-01', 920.00, 2),
    ('Aislante Termico 10mm', 'Aislante', 'rollo', 'ThermPro', 'AIS-10-01', 21500.00, 4),
    ('Aislante Termico 20mm', 'Aislante', 'rollo', 'ThermPro', 'AIS-20-01', 28700.00, 4),
    ('Yeso Proyectable 25kg', 'Material', 'bolsa', 'Yesera Sur', 'YES-25-01', 6400.00, 2),
    ('Masilla Junta Placa', 'Terminacion', 'balde', 'Yesera Sur', 'MAS-JUN-01', 8700.00, 2),
    ('Placa Durlock 9.5mm', 'Material', 'unidad', 'Durlock', 'PLA-095-01', 5800.00, 2),
    ('Placa Durlock 12.5mm', 'Material', 'unidad', 'Durlock', 'PLA-125-01', 7200.00, 2),
    ('Perfil Omega 35mm', 'Perfileria', 'unidad', 'SteelPro', 'PER-OMG-01', 2100.00, 1),
    ('Perfil Canal 70mm', 'Perfileria', 'unidad', 'SteelPro', 'PER-C70-01', 3200.00, 1),
    ('Perfil Montante 70mm', 'Perfileria', 'unidad', 'SteelPro', 'PER-M70-01', 3100.00, 1),
    ('Perfil Canal 90mm', 'Perfileria', 'unidad', 'SteelPro', 'PER-C90-01', 3650.00, 1),
    ('Lavatorio Ceramico', 'Sanitario', 'unidad', 'Sanitek', 'LAV-CER-01', 48500.00, 5),
    ('Inodoro Largo', 'Sanitario', 'unidad', 'Sanitek', 'INO-LAR-01', 79500.00, 5),
    ('Bidet Monocomando', 'Sanitario', 'unidad', 'Sanitek', 'BID-MON-01', 42900.00, 5),
    ('Griferia Cocina Monocomando', 'Griferia', 'unidad', 'AquaFlow', 'GRI-COC-01', 65900.00, 5),
    ('Griferia Lavatorio Pico Alto', 'Griferia', 'unidad', 'AquaFlow', 'GRI-LAV-01', 48900.00, 5),
)

ARTICULOS_TABLE_SQL = """
CREATE TABLE articulos (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    version INTEGER NOT NULL DEFAULT 1,
    nombre VARCHAR(255) NOT NULL,
    tipo_articulo VARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(50) NOT NULL,
    marca VARCHAR(100) NULL,
    sku VARCHAR(100) NULL,
    precio NUMERIC(15,2) NOT NULL,
    proveedor_id INTEGER NULL,
    UNIQUE(nombre, sku),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);
"""


def ensure_articulos(engine, metadata):
    inspector = inspect(engine)
    with engine.begin() as conn:
        if 'articulos' not in inspector.get_table_names():
            conn.execute(text(ARTICULOS_TABLE_SQL))
    metadata.reflect(bind=engine, only=['articulos'])
    with engine.begin() as conn:
        existing_proveedores = {row[0] for row in conn.execute(text("SELECT id FROM proveedores"))}
        for nombre, tipo, unidad, marca, sku, precio, proveedor_id in ARTICULOS:
            safe_proveedor = proveedor_id if proveedor_id in existing_proveedores else None
            conn.execute(
                text(
                    'INSERT INTO articulos (nombre, tipo_articulo, unidad_medida, marca, sku, precio, proveedor_id, created_at, updated_at, version) '
                    'VALUES (:nombre, :tipo, :unidad, :marca, :sku, :precio, :proveedor, NOW(), NOW(), 1) '
                    'ON CONFLICT DO NOTHING'
                ),
                {
                    'nombre': nombre,
                    'tipo': tipo,
                    'unidad': unidad,
                    'marca': marca,
                    'sku': sku,
                    'precio': precio,
                    'proveedor': safe_proveedor,
                },
            )


def run() -> bool:
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('[x] DATABASE_URL no definido. Abortando migración 015.')
        return False
    engine = create_engine(database_url)
    metadata = MetaData()
    try:
        ensure_articulos(engine, metadata)
        print('[ok] Migración 015 aplicada en la base PostgreSQL')
        return True
    finally:
        engine.dispose()


if __name__ == '__main__':
    run()
