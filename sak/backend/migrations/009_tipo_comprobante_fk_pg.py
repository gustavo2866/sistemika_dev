#!/usr/bin/env python3
"""Migration 009: add tipos_comprobante catalog (PostgreSQL) and migrate facturas."""

from __future__ import annotations

import os
import unicodedata
from dotenv import load_dotenv

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text

DEFAULT_TIPOS = (
    'Factura A',
    'Factura B',
    'Factura C',
    'Factura M',
    'NC A',
    'NC B',
    'NC C',
)

_ALIAS_MAP = {
    'FACTURA A': 'Factura A',
    'FACTURAA': 'Factura A',
    'FACTURA B': 'Factura B',
    'FACTURAB': 'Factura B',
    'FACTURA C': 'Factura C',
    'FACTURAC': 'Factura C',
    'FACTURA M': 'Factura M',
    'FACTURAM': 'Factura M',
    'A': 'Factura A',
    'B': 'Factura B',
    'C': 'Factura C',
    'M': 'Factura M',
    'NC': 'NC A',
    'NC A': 'NC A',
    'NCA': 'NC A',
    'NOTA DE CREDITO A': 'NC A',
    'NOTACREDITOA': 'NC A',
    'NC B': 'NC B',
    'NCB': 'NC B',
    'NOTA DE CREDITO B': 'NC B',
    'NOTACREDITOB': 'NC B',
    'NC C': 'NC C',
    'NCC': 'NC C',
    'NOTA DE CREDITO C': 'NC C',
    'NOTACREDITOC': 'NC C',
}


def normalize_tipo(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = unicodedata.normalize('NFKD', str(value).strip())
    cleaned = ''.join(ch for ch in cleaned if not unicodedata.combining(ch))
    if not cleaned:
        return None
    upper = cleaned.upper()
    if upper in _ALIAS_MAP:
        return _ALIAS_MAP[upper]
    if upper.startswith('FACTURA '):
        suffix = upper.split('FACTURA ', 1)[1].strip()
        return _ALIAS_MAP.get(f'FACTURA {suffix}') or _ALIAS_MAP.get(suffix) or upper.title()
    if upper.startswith('NOTA DE CREDITO '):
        suffix = upper.split('NOTA DE CREDITO ', 1)[1].strip()
        return _ALIAS_MAP.get(f'NC {suffix}') or upper.title()
    return upper.title()


def ensure_tipos_comprobante(engine, metadata) -> Table:
    inspector = inspect(engine)
    if 'tipos_comprobante' not in inspector.get_table_names():
        create_sql = """
        CREATE TABLE tipos_comprobante (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
            version INTEGER NOT NULL DEFAULT 1,
            name VARCHAR(100) NOT NULL UNIQUE
        );
        """
        with engine.begin() as conn:
            conn.execute(text(create_sql))
    tipo_table = Table('tipos_comprobante', metadata, autoload_with=engine)
    with engine.begin() as conn:
        conn.execute(text('UPDATE tipos_comprobante SET created_at = NOW() WHERE created_at IS NULL'))
        conn.execute(text('UPDATE tipos_comprobante SET updated_at = NOW() WHERE updated_at IS NULL'))
        conn.execute(text('UPDATE tipos_comprobante SET version = COALESCE(version, 1)'))
        conn.execute(text('ALTER TABLE tipos_comprobante ALTER COLUMN created_at SET DEFAULT NOW()'))
        conn.execute(text('ALTER TABLE tipos_comprobante ALTER COLUMN updated_at SET DEFAULT NOW()'))
        conn.execute(text('ALTER TABLE tipos_comprobante ALTER COLUMN version SET DEFAULT 1'))
        conn.execute(text('ALTER TABLE tipos_comprobante ALTER COLUMN created_at SET NOT NULL'))
        conn.execute(text('ALTER TABLE tipos_comprobante ALTER COLUMN updated_at SET NOT NULL'))
        conn.execute(text('ALTER TABLE tipos_comprobante ALTER COLUMN version SET NOT NULL'))
    with engine.begin() as conn:
        for name in DEFAULT_TIPOS:
            conn.execute(
                text(
                    'INSERT INTO tipos_comprobante (name, created_at, updated_at, version) VALUES (:name, NOW(), NOW(), 1) '
                    'ON CONFLICT (name) DO NOTHING'
                ),
                {'name': name},
            )
    return tipo_table


def migrate_facturas(engine, metadata, tipo_table):
    inspector = inspect(engine)
    factura_columns = {col['name'] for col in inspector.get_columns('facturas')}

    with engine.begin() as conn:
        if 'id_tipocomprobante' not in factura_columns:
            conn.execute(text('ALTER TABLE facturas ADD COLUMN id_tipocomprobante INTEGER'))

    factura_table = Table('facturas', metadata, autoload_with=engine)

    with engine.begin() as conn:
        rows = conn.execute(
            select(factura_table.c.id, factura_table.c.tipo_comprobante)
        ).fetchall()
        cache: dict[str, int] = {}
        for row in rows:
            canonical = normalize_tipo(row.tipo_comprobante)
            if canonical is None:
                continue
            if canonical not in cache:
                tipo_id = conn.execute(
                    select(tipo_table.c.id).where(tipo_table.c.name == canonical)
                ).scalar()
                if tipo_id is None:
                    tipo_id = conn.execute(
                        tipo_table.insert().values(name=canonical).returning(tipo_table.c.id)
                    ).scalar()
                cache[canonical] = tipo_id
            conn.execute(
                factura_table.update()
                .where(factura_table.c.id == row.id)
                .values(id_tipocomprobante=cache[canonical])
            )
        default_id = conn.execute(
            select(tipo_table.c.id).where(tipo_table.c.name == 'Factura B')
        ).scalar()
        conn.execute(
            factura_table.update()
            .where(factura_table.c.id_tipocomprobante.is_(None))
            .values(id_tipocomprobante=default_id)
        )
        conn.execute(
            text('UPDATE tipos_comprobante SET updated_at = NOW() WHERE updated_at IS NULL')
        )

    fk_names = {fk.get('name') for fk in inspector.get_foreign_keys('facturas')}
    if 'facturas_id_tipocomprobante_fk' not in fk_names:
        with engine.begin() as conn:
            conn.execute(
                text(
                    'ALTER TABLE facturas ADD CONSTRAINT facturas_id_tipocomprobante_fk '
                    'FOREIGN KEY (id_tipocomprobante) REFERENCES tipos_comprobante(id)'
                )
            )
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE facturas ALTER COLUMN id_tipocomprobante SET NOT NULL'))
        if 'tipo_comprobante' in factura_columns:
            conn.execute(text('ALTER TABLE facturas DROP COLUMN tipo_comprobante'))


def run() -> bool:
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('[x] DATABASE_URL no definido. Abortando.')
        return False
    engine = create_engine(database_url)
    metadata = MetaData()
    try:
        tipo_table = ensure_tipos_comprobante(engine, metadata)
        migrate_facturas(engine, metadata, tipo_table)
        print('[ok] Migracion 009 aplicada en base de datos principal')
        return True
    finally:
        engine.dispose()


if __name__ == '__main__':
    run()
