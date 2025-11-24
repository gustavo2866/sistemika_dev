#!/usr/bin/env python3
"""Migration 020: add version column to crm_mensajes (PostgreSQL)."""

from __future__ import annotations

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect


ALTER_TABLE_SQL = """
ALTER TABLE crm_mensajes
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
"""


def run_migration():
    load_dotenv()
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL no configurada")
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text("COMMIT"))
        conn.execute(text(ALTER_TABLE_SQL))
        conn.execute(text("COMMIT"))


if __name__ == "__main__":
    run_migration()
