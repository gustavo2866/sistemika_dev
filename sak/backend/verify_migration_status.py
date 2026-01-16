#!/usr/bin/env python3
"""Verificar estado final de migraciones"""

import os
from sqlalchemy import create_engine, text

# Cargar .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

db_url = os.getenv('DATABASE_URL')
engine = create_engine(db_url)

def main():
    with engine.begin() as conn:
        # Verificar qué migración está aplicada
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        current_migration = result.scalar()
        print(f"Migración actual: {current_migration}")
        
        # Verificar si la tabla po_factura_totales existe
        result = conn.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_name = 'po_factura_totales'
        """))
        table_exists = result.scalar()
        print(f"Tabla po_factura_totales existe: {'Sí' if table_exists > 0 else 'No'}")
        
        # Verificar esquema de crm_eventos
        result = conn.execute(text("""
            SELECT column_name, is_nullable, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'crm_eventos' 
            AND column_name IN ('oportunidad_id', 'titulo')
            ORDER BY column_name
        """))
        
        print("\nEsquema de crm_eventos:")
        for row in result:
            nullable = "Sí" if row.is_nullable == "YES" else "No"
            print(f"  {row.column_name}: {row.data_type}, nullable: {nullable}")

if __name__ == "__main__":
    main()