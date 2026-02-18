#!/usr/bin/env python3
"""
Script para verificar y corregir secuencias desfasadas en PostgreSQL.

Este script verifica si las secuencias de primary keys están sincronizadas
con los valores máximos existentes en las tablas y las corrige si es necesario.

Uso:
    python fix_sequences.py                    # Verifica todas las tablas
    python fix_sequences.py --table propiedades  # Verifica solo una tabla específica
    python fix_sequences.py --dry-run         # Solo verifica, no corrige
"""

import os
import argparse
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

def get_database_connection():
    """Obtiene la conexión a la base de datos."""
    load_dotenv()
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise Exception('DATABASE_URL no encontrado en .env')
    return create_engine(DATABASE_URL)

def get_tables_with_sequences(engine):
    """Obtiene todas las tablas que tienen secuencias de primary key."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT 
                t.table_name,
                c.column_name,
                pg_get_serial_sequence(t.table_name, c.column_name) as sequence_name
            FROM information_schema.tables t
            JOIN information_schema.columns c ON t.table_name = c.table_name
            WHERE t.table_schema = 'public' 
            AND c.column_default LIKE 'nextval%'
            AND pg_get_serial_sequence(t.table_name, c.column_name) IS NOT NULL
            ORDER BY t.table_name
        """))
        return result.fetchall()

def check_sequence_sync(engine, table_name, column_name):
    """Verifica si la secuencia está sincronizada con la tabla."""
    with engine.connect() as conn:
        # Obtener el máximo ID de la tabla
        result = conn.execute(text(f'SELECT MAX({column_name}) FROM {table_name}'))
        max_id = result.fetchone()[0]
        
        if max_id is None:
            return None, None, True  # Tabla vacía, no hay problema
        
        # Obtener el valor actual de la secuencia
        sequence_name = f'{table_name}_{column_name}_seq'
        try:
            # Usar lastval() si está disponible, si no, usar nextval y luego setval para revertir
            result = conn.execute(text(f"SELECT nextval('{sequence_name}')"))
            next_val = result.fetchone()[0]
            
            # Revertir el nextval
            conn.execute(text(f"SELECT setval('{sequence_name}', {next_val - 1})"))
            
            current_val = next_val - 1
            is_synced = current_val >= max_id
            
            return max_id, current_val, is_synced
        except Exception as e:
            print(f"Error verificando secuencia para {table_name}: {e}")
            return max_id, None, False

def fix_sequence(engine, table_name, column_name, max_id):
    """Corrige la secuencia para que esté sincronizada."""
    sequence_name = f'{table_name}_{column_name}_seq'
    new_val = max_id + 1
    
    with engine.connect() as conn:
        conn.execute(text(f"SELECT setval('{sequence_name}', {new_val})"))
        conn.commit()
    
    return new_val

def main():
    parser = argparse.ArgumentParser(description='Verificar y corregir secuencias desfasadas')
    parser.add_argument('--table', help='Verificar solo una tabla específica')
    parser.add_argument('--dry-run', action='store_true', help='Solo verificar, no corregir')
    args = parser.parse_args()

    try:
        engine = get_database_connection()
        
        # Obtener tablas con secuencias
        tables = get_tables_with_sequences(engine)
        
        if args.table:
            tables = [t for t in tables if t[0] == args.table]
            if not tables:
                print(f"❌ Tabla '{args.table}' no encontrada o no tiene secuencia")
                return
        
        print("🔍 Verificando secuencias...\n")
        
        problems_found = False
        
        for table_name, column_name, sequence_name in tables:
            print(f"📋 Tabla: {table_name}")
            
            max_id, current_val, is_synced = check_sequence_sync(engine, table_name, column_name)
            
            if max_id is None:
                print("   ✅ Tabla vacía - OK")
            elif is_synced:
                print(f"   ✅ Secuencia OK - Máximo ID: {max_id}, Secuencia: {current_val}")
            else:
                problems_found = True
                print(f"   ⚠️  PROBLEMA - Máximo ID: {max_id}, Secuencia: {current_val}")
                
                if not args.dry_run:
                    try:
                        new_val = fix_sequence(engine, table_name, column_name, max_id)
                        print(f"   🔧 CORREGIDO - Secuencia actualizada a: {new_val}")
                    except Exception as e:
                        print(f"   ❌ Error corrigiendo: {e}")
                else:
                    print(f"   💡 Se necesita actualizar secuencia a: {max_id + 1}")
            
            print()
        
        if not problems_found:
            print("🎉 Todas las secuencias están correctamente sincronizadas")
        elif args.dry_run:
            print("🔍 Verificación completada. Usar sin --dry-run para corregir los problemas")
        else:
            print("🔧 Correcciones aplicadas")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()