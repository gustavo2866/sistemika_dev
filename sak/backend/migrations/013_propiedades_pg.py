#!/usr/bin/env python3
"""Migration 013: add propiedades catalog and property support for facturas (PostgreSQL)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import MetaData, create_engine, inspect, select, text

DEFAULT_PROPIEDADES = (
    (1, 'Casa Central', 'Departamento', 'Inversiones SA', 'activa'),
    (2, 'Depósito Norte', 'Galpón', 'Logística SRL', 'activa'),
    (3, 'Oficina Microcentro', 'Oficina', 'Inmobiliaria SA', 'mantenimiento'),
    (4, 'Local Comercial 45', 'Local', 'Retail Partners', 'alquilada'),
    (5, 'Terreno Ruta 9', 'Terreno', 'Desarrollos SRL', 'disponible'),
)


def ensure_propiedades(engine, metadata):
    inspector = inspect(engine)
    with engine.begin() as conn:
        if 'propiedades' not in inspector.get_table_names():
            conn.execute(text(
                """
                CREATE TABLE propiedades (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    nombre VARCHAR(255) NOT NULL UNIQUE,
                    tipo VARCHAR(100) NOT NULL,
                    propietario VARCHAR(255) NOT NULL,
                    estado VARCHAR(100) NOT NULL
                )
                """
            ))
    metadata.reflect(bind=engine, only=['propiedades'])
    with engine.begin() as conn:
        for pid, nombre, tipo, propietario, estado in DEFAULT_PROPIEDADES:
            conn.execute(
                text(
                    'INSERT INTO propiedades (id, nombre, tipo, propietario, estado, created_at, updated_at, version) '
                    'VALUES (:id, :nombre, :tipo, :propietario, :estado, NOW(), NOW(), 1) '
                    'ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, '
                    'propietario = EXCLUDED.propietario, estado = EXCLUDED.estado'
                ),
                {'id': pid, 'nombre': nombre, 'tipo': tipo, 'propietario': propietario, 'estado': estado},
            )


def ensure_tipo_operacion(engine):
    inspector = inspect(engine)
    columns = {col['name'] for col in inspector.get_columns('tipos_operacion')}
    with engine.begin() as conn:
        if 'requiere_propiedad' not in columns:
            conn.execute(text('ALTER TABLE tipos_operacion ADD COLUMN requiere_propiedad BOOLEAN NOT NULL DEFAULT FALSE'))
        conn.execute(text('UPDATE tipos_operacion SET requiere_propiedad = TRUE WHERE id = 1'))
        conn.execute(text('UPDATE tipos_operacion SET requiere_propiedad = FALSE WHERE id = 2'))
        conn.execute(
            text(
                "INSERT INTO tipos_operacion (codigo, descripcion, activo, requiere_iva, requiere_propiedad, created_at, updated_at, version) "
                "SELECT 'PROP', 'Operacion asociada a propiedad', TRUE, TRUE, TRUE, NOW(), NOW(), 1 "
                "WHERE NOT EXISTS (SELECT 1 FROM tipos_operacion WHERE codigo = 'PROP')"
            )
        )


def ensure_facturas(engine):
    inspector = inspect(engine)
    columns = {col['name'] for col in inspector.get_columns('facturas')}
    with engine.begin() as conn:
        if 'propiedad_id' not in columns:
            conn.execute(text('ALTER TABLE facturas ADD COLUMN propiedad_id INTEGER NULL'))
    inspector = inspect(engine)
    fk_names = {fk['name'] for fk in inspector.get_foreign_keys('facturas') if fk.get('name')}
    with engine.begin() as conn:
        if 'facturas_propiedad_fk' not in fk_names:
            conn.execute(text(
                'ALTER TABLE facturas ADD CONSTRAINT facturas_propiedad_fk '
                'FOREIGN KEY (propiedad_id) REFERENCES propiedades(id)'
            ))


def run() -> bool:
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('[x] DATABASE_URL no definido. Abortando migración 013.')
        return False
    engine = create_engine(database_url)
    metadata = MetaData()
    try:
        ensure_propiedades(engine, metadata)
        ensure_tipo_operacion(engine)
        ensure_facturas(engine)
        print('[ok] Migración 013 aplicada en la base PostgreSQL')
        return True
    finally:
        engine.dispose()


if __name__ == '__main__':
    run()
