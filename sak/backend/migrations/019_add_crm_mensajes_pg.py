#!/usr/bin/env python3
"""Migration 019: create crm_mensajes table (PostgreSQL)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS crm_mensajes (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,

    tipo VARCHAR(20) NOT NULL DEFAULT 'entrada',
    canal VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
    contacto_id INTEGER NULL REFERENCES crm_contactos(id),
    contacto_referencia VARCHAR(255) NULL,
    contacto_nombre_propuesto VARCHAR(255) NULL,
    oportunidad_generar BOOLEAN NOT NULL DEFAULT FALSE,
    evento_id INTEGER NULL REFERENCES crm_eventos(id),
    estado VARCHAR(30) NOT NULL DEFAULT 'nuevo',
    prioridad VARCHAR(20) NOT NULL DEFAULT 'media',
    asunto VARCHAR(255) NULL,
    contenido TEXT NULL,
    adjuntos JSON NOT NULL DEFAULT '[]',
    origen_externo_id VARCHAR(255) NULL,
    metadata JSON NOT NULL DEFAULT '{}',
    responsable_id INTEGER NULL REFERENCES users(id),

    CONSTRAINT chk_crm_mensajes_tipo CHECK (tipo IN ('entrada','salida')),
    CONSTRAINT chk_crm_mensajes_canal CHECK (canal IN ('whatsapp','email','red_social','otro')),
    CONSTRAINT chk_crm_mensajes_estado CHECK (
        estado IN ('nuevo','confirmado','descartado','pendiente_envio','enviado','error_envio')
    ),
    CONSTRAINT chk_crm_mensajes_prioridad CHECK (prioridad IN ('alta','media','baja'))
);

CREATE INDEX IF NOT EXISTS idx_crm_mensajes_estado_tipo ON crm_mensajes (estado, tipo);
CREATE INDEX IF NOT EXISTS idx_crm_mensajes_canal_ref ON crm_mensajes (canal, contacto_referencia);
CREATE INDEX IF NOT EXISTS idx_crm_mensajes_evento ON crm_mensajes (evento_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensajes_contacto ON crm_mensajes (contacto_id);
"""


def run_migration():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL no configurada")

    engine = create_engine(database_url)
    insp = inspect(engine)
    with engine.connect() as conn:
        conn.execute(text("COMMIT"))
        conn.execute(text(CREATE_TABLE_SQL))
        conn.execute(text("COMMIT"))


if __name__ == "__main__":
    run_migration()
