#!/usr/bin/env python3
import os
import sys

# Cambiar al directorio backend
os.chdir(r"C:\Users\gpalmieri\source\sistemika\sak\backend")
sys.path.insert(0, os.getcwd())

from app.database import engine
import sqlalchemy as sa

def check_constraints():
    with engine.connect() as conn:
        # Verificar restricciones unique en propiedades
        query = sa.text("""
            SELECT conname, contype 
            FROM pg_constraint 
            WHERE conrelid = (
                SELECT oid FROM pg_class WHERE relname = 'propiedades'
            ) 
            AND contype IN ('u', 'p')
        """)
        
        result = conn.execute(query).fetchall()
        print("Restricciones en tabla propiedades:")
        for constraint_name, constraint_type in result:
            tipo = "PRIMARY KEY" if constraint_type == 'p' else "UNIQUE"
            print(f"  - {constraint_name} ({tipo})")
        
        # Verificar índices en la columna nombre
        indices_query = sa.text("""
            SELECT indexname, indexdef
            FROM pg_indexes 
            WHERE tablename = 'propiedades' 
            AND indexdef LIKE '%nombre%'
        """)
        
        indices = conn.execute(indices_query).fetchall()
        print("\nÍndices en columna nombre:")
        for index_name, index_def in indices:
            print(f"  - {index_name}: {index_def}")

if __name__ == "__main__":
    check_constraints()