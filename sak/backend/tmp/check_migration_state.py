"""Verifica y aplica la migración de partes_diario_detalles."""
import warnings
warnings.filterwarnings("ignore")
import logging
logging.disable(logging.CRITICAL)

import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import sqlalchemy as sa

db_url = os.getenv("DATABASE_URL")
engine = sa.create_engine(db_url)

with engine.connect() as conn:
    # Verificar revision actual
    try:
        rev = conn.execute(sa.text("SELECT version_num FROM alembic_version")).scalar()
        print(f"alembic_version actual: {rev}")
    except Exception as e:
        print(f"Error leyendo alembic_version: {e}")

    # Verificar columnas actuales de partes_diario_detalles
    cols = conn.execute(sa.text("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'partes_diario_detalles'
        ORDER BY ordinal_position
    """)).fetchall()
    print("\nColumnas de partes_diario_detalles:")
    for col in cols:
        print(f"  {col[0]:30s}  {col[1]:20s}  nullable={col[2]}")
