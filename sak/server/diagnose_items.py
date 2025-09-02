#!/usr/bin/env python3
"""
Script para diagnosticar problemas con los items
"""

import sqlite3
import os

def diagnosticar_items():
    db_path = 'data/dev.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return
    
    print(f"🔍 Diagnosticando items en: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Verificar items con deleted_at
        cursor.execute('SELECT COUNT(*) FROM items WHERE deleted_at IS NULL')
        items_activos = cursor.fetchone()[0]
        print(f"📦 Items activos (deleted_at IS NULL): {items_activos}")
        
        cursor.execute('SELECT COUNT(*) FROM items WHERE deleted_at IS NOT NULL')
        items_eliminados = cursor.fetchone()[0]
        print(f"🗑️  Items eliminados (deleted_at IS NOT NULL): {items_eliminados}")
        
        # Mostrar items que pueden estar causando problemas
        print("\n🔍 Primeros 5 items activos:")
        cursor.execute('''
            SELECT id, name, deleted_at, created_at, updated_at 
            FROM items 
            WHERE deleted_at IS NULL 
            ORDER BY id 
            LIMIT 5
        ''')
        for row in cursor.fetchall():
            print(f"  ID {row[0]}: {row[1]}")
            print(f"    deleted_at: {row[2]}")
            print(f"    created_at: {row[3]}")
            print(f"    updated_at: {row[4]}")
            print()
        
        # Verificar si hay problemas con timestamps
        print("🕒 Verificando timestamps problemáticos:")
        cursor.execute('''
            SELECT COUNT(*) FROM items 
            WHERE created_at IS NULL OR updated_at IS NULL
        ''')
        problemas_timestamp = cursor.fetchone()[0]
        print(f"Items con timestamps NULL: {problemas_timestamp}")
        
        # Verificar valores únicos de deleted_at
        cursor.execute('SELECT DISTINCT deleted_at FROM items ORDER BY deleted_at')
        valores_deleted = cursor.fetchall()
        print(f"\nValores únicos de deleted_at: {valores_deleted}")
        
        # Verificar la consulta que usa el backend
        print("\n🔍 Simulando consulta del backend (deleted_at IS NULL):")
        cursor.execute('''
            SELECT id, name, category, price 
            FROM items 
            WHERE deleted_at IS NULL 
            ORDER BY id 
            LIMIT 10
        ''')
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} ({row[2]}) - €{row[3]}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    diagnosticar_items()
