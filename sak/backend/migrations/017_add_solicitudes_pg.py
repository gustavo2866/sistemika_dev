#!/usr/bin/env python3
"""Migration 017: create solicitudes master/detail tables (PostgreSQL)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text


def ensure_solicitudes(engine) -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if 'solicitudes' not in table_names:
        print('[+] Creando tabla solicitudes')
        with engine.begin() as conn:
            conn.execute(text(
                """
                CREATE TABLE solicitudes (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('normal','directa')),
                    fecha_necesidad DATE NOT NULL,
                    comentario TEXT NULL,
                    solicitante_id INTEGER NOT NULL REFERENCES users(id)
                )
                """
            ))
    else:
        print('[=] Tabla solicitudes ya existe')

    inspector = inspect(engine)
    existing_indexes = {idx['name'] for idx in inspector.get_indexes('solicitudes')}
    if 'idx_solicitudes_solicitante_id' not in existing_indexes:
        print('[+] Creando indice idx_solicitudes_solicitante_id')
        with engine.begin() as conn:
            conn.execute(text('CREATE INDEX idx_solicitudes_solicitante_id ON solicitudes (solicitante_id)'))


def ensure_solicitud_detalles(engine) -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if 'solicitud_detalles' not in table_names:
        print('[+] Creando tabla solicitud_detalles')
        with engine.begin() as conn:
            conn.execute(text(
                """
                CREATE TABLE solicitud_detalles (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
                    articulo_id INTEGER NULL REFERENCES articulos(id),
                    descripcion TEXT NOT NULL,
                    unidad_medida VARCHAR(50) NULL,
                    cantidad NUMERIC(12,3) NOT NULL
                )
                """
            ))
    else:
        print('[=] Tabla solicitud_detalles ya existe')

    inspector = inspect(engine)
    existing_indexes = {idx['name'] for idx in inspector.get_indexes('solicitud_detalles')}
    if 'idx_solicitud_detalles_solicitud_id' not in existing_indexes:
        print('[+] Creando indice idx_solicitud_detalles_solicitud_id')
        with engine.begin() as conn:
            conn.execute(text('CREATE INDEX idx_solicitud_detalles_solicitud_id ON solicitud_detalles (solicitud_id)'))
    if 'idx_solicitud_detalles_articulo_id' not in existing_indexes:
        print('[+] Creando indice idx_solicitud_detalles_articulo_id')
        with engine.begin() as conn:
            conn.execute(text('CREATE INDEX idx_solicitud_detalles_articulo_id ON solicitud_detalles (articulo_id)'))


def run() -> bool:
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('[x] DATABASE_URL no definido. Abortando migracion 017.')
        return False

    engine = create_engine(database_url)
    try:
        ensure_solicitudes(engine)
        ensure_solicitud_detalles(engine)
        print('[ok] Migracion 017 aplicada en la base PostgreSQL')
        return True
    finally:
        engine.dispose()


if __name__ == '__main__':
    run()
