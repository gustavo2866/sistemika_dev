#!/usr/bin/env python3
import os
import sys

os.chdir(r"C:\Users\gpalmieri\source\sistemika\sak\backend")
sys.path.insert(0, os.getcwd())

from app.database import engine
import sqlalchemy as sa

def check_propiedades_constraints():
    with engine.connect() as conn:
        # Verificar todas las restricciones e índices en propiedades
        print("=== RESTRICCIONES EN TABLA PROPIEDADES ===")
        
        constraints_query = sa.text("""
            SELECT 
                conname, 
                contype,
                CASE contype 
                    WHEN 'u' THEN 'UNIQUE'
                    WHEN 'p' THEN 'PRIMARY KEY'  
                    WHEN 'f' THEN 'FOREIGN KEY'
                    WHEN 'c' THEN 'CHECK'
                    ELSE contype::text
                END as type_desc
            FROM pg_constraint 
            WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'propiedades')
            ORDER BY contype, conname
        """)
        
        constraints = conn.execute(constraints_query).fetchall()
        for name, ctype, desc in constraints:
            print(f"  {name}: {desc}")
        
        print("\n=== ÍNDICES EN TABLA PROPIEDADES ===")
        
        indices_query = sa.text("""
            SELECT indexname, indexdef
            FROM pg_indexes 
            WHERE tablename = 'propiedades'
            ORDER BY indexname
        """)
        
        indices = conn.execute(indices_query).fetchall()
        for name, definition in indices:
            is_unique = "UNIQUE" if "UNIQUE" in definition else "REGULAR"
            print(f"  {name} ({is_unique}): {definition}")
        
        print("\n=== COLUMNAS CON RESTRICCIÓN UNIQUE ===")
        
        unique_cols_query = sa.text("""
            SELECT 
                a.attname as column_name,
                con.conname as constraint_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
            WHERE rel.relname = 'propiedades' 
            AND con.contype = 'u'
        """)
        
        unique_cols = conn.execute(unique_cols_query).fetchall()
        if unique_cols:
            for col_name, constraint_name in unique_cols:
                print(f"  Columna '{col_name}' tiene restricción unique: {constraint_name}")
        else:
            print("  No hay columnas con restricción unique")

if __name__ == "__main__":
    check_propiedades_constraints()