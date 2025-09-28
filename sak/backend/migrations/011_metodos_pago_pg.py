#!/usr/bin/env python3
"""Migration 011: add metodos_pago catalog and relations for facturas (PostgreSQL)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import MetaData, create_engine, inspect, text

DEFAULT_METODOS = (
    (1, 'Caja'),
    (2, 'Cheque'),
    (3, 'Pago Facil'),
)


def ensure_metodos_pago(engine, metadata):
    inspector = inspect(engine)
    with engine.begin() as conn:
        if 'metodos_pago' not in inspector.get_table_names():
            conn.execute(text(
                """
                CREATE TABLE metodos_pago (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    nombre VARCHAR(100) NOT NULL UNIQUE
                )
                """
            ))
    metadata.reflect(bind=engine, only=['metodos_pago'])
    with engine.begin() as conn:
        for metodo_id, nombre in DEFAULT_METODOS:
            conn.execute(
                text(
                    'INSERT INTO metodos_pago (id, nombre, created_at, updated_at, version) '
                    'VALUES (:id, :nombre, NOW(), NOW(), 1) '
                    'ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre'
                ),
                {'id': metodo_id, 'nombre': nombre},
            )
        conn.execute(text('UPDATE metodos_pago SET created_at = COALESCE(created_at, NOW())'))
        conn.execute(text('UPDATE metodos_pago SET updated_at = COALESCE(updated_at, NOW())'))
        conn.execute(text('UPDATE metodos_pago SET version = COALESCE(version, 1)'))


def ensure_facturas_columns(engine):
    inspector = inspect(engine)
    columns = {col['name'] for col in inspector.get_columns('facturas')}
    with engine.begin() as conn:
        if 'id_tipocomprobante' not in columns and 'id_tipofactura' in columns:
            conn.execute(text('ALTER TABLE facturas ADD COLUMN id_tipocomprobante INTEGER'))
            conn.execute(text('UPDATE facturas SET id_tipocomprobante = id_tipofactura'))
        if 'metodo_pago_id' not in columns:
            conn.execute(text('ALTER TABLE facturas ADD COLUMN metodo_pago_id INTEGER'))
        if 'registrado_por_id' not in columns:
            conn.execute(text('ALTER TABLE facturas ADD COLUMN registrado_por_id INTEGER'))
        conn.execute(text('UPDATE facturas SET metodo_pago_id = COALESCE(metodo_pago_id, 1)'))
        conn.execute(text('UPDATE facturas SET registrado_por_id = COALESCE(registrado_por_id, 1)'))
        if 'id_tipofactura' in columns:
            conn.execute(text('ALTER TABLE facturas DROP COLUMN id_tipofactura'))

    inspector = inspect(engine)
    fk_names = {fk['name'] for fk in inspector.get_foreign_keys('facturas') if fk.get('name')}
    with engine.begin() as conn:
        if 'facturas_id_tipocomprobante_fk' not in fk_names:
            conn.execute(text(
                'ALTER TABLE facturas ADD CONSTRAINT facturas_id_tipocomprobante_fk '
                'FOREIGN KEY (id_tipocomprobante) REFERENCES tipos_comprobante(id)'
            ))
        if 'facturas_metodo_pago_fk' not in fk_names:
            conn.execute(text(
                'ALTER TABLE facturas ADD CONSTRAINT facturas_metodo_pago_fk '
                'FOREIGN KEY (metodo_pago_id) REFERENCES metodos_pago(id)'
            ))
        if 'facturas_registrado_por_fk' not in fk_names:
            conn.execute(text(
                'ALTER TABLE facturas ADD CONSTRAINT facturas_registrado_por_fk '
                'FOREIGN KEY (registrado_por_id) REFERENCES users(id)'
            ))
        conn.execute(text('ALTER TABLE facturas ALTER COLUMN id_tipocomprobante SET NOT NULL'))
        conn.execute(text('ALTER TABLE facturas ALTER COLUMN metodo_pago_id SET NOT NULL'))
        conn.execute(text('ALTER TABLE facturas ALTER COLUMN registrado_por_id SET NOT NULL'))


def run() -> bool:
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('[x] DATABASE_URL no definido. Abortando migración 011.')
        return False
    engine = create_engine(database_url)
    metadata = MetaData()
    try:
        ensure_metodos_pago(engine, metadata)
        ensure_facturas_columns(engine)
        print('[ok] Migración 011 aplicada en la base PostgreSQL')
        return True
    finally:
        engine.dispose()


if __name__ == '__main__':
    run()
