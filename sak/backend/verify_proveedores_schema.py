#!/usr/bin/env python3
"""Verificar esquema de la tabla proveedores"""

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
        # Verificar esquema de proveedores
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'proveedores'
            ORDER BY ordinal_position
        """))
        
        print("Esquema de la tabla proveedores:")
        for row in result:
            nullable = "Sí" if row.is_nullable == "YES" else "No"
            default = row.column_default if row.column_default else "Sin default"
            print(f"  {row.column_name}: {row.data_type}, nullable: {nullable}, default: {default}")

        # Verificar si existe la tabla adm_conceptos
        result = conn.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_name = 'adm_conceptos'
        """))
        adm_conceptos_exists = result.scalar() > 0
        print(f"\nTabla adm_conceptos existe: {'Sí' if adm_conceptos_exists else 'No'}")

if __name__ == "__main__":
    main()