#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar estructura de tabla propiedades
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import os

load_dotenv()

def main():
    database_url = os.getenv('DATABASE_URL').replace('postgresql+psycopg://', 'postgresql://')
    
    conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = 'propiedades' 
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()
            
            print('Columnas de la tabla propiedades:')
            print('=' * 70)
            for col in columns:
                nullable = "NULL" if col["is_nullable"] == "YES" else "NOT NULL"
                default = col["column_default"] or ""
                print(f'{col["column_name"]:25} {col["data_type"]:15} {nullable:10} {default}')
            
            # Buscar específicamente el campo estado
            estado_cols = [col for col in columns if 'estado' in col['column_name'].lower()]
            if estado_cols:
                print('\n\nColumnas relacionadas con "estado":')
                print('=' * 50)
                for col in estado_cols:
                    nullable = "NULL" if col["is_nullable"] == "YES" else "NOT NULL"
                    print(f'{col["column_name"]:25} {col["data_type"]:15} {nullable:10}')
            else:
                print('\n❌ No se encontró campo "estado" en la tabla propiedades')
    
    finally:
        conn.close()

if __name__ == "__main__":
    main()