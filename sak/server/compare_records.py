#!/usr/bin/env python3
"""
Script para comparar registros que aparecen vs los que no aparecen
"""

import sqlite3
import os
import json

def comparar_registros():
    db_path = 'data/dev.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return
    
    print(f"🔍 Comparando registros en: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Obtener todos los campos de los primeros 5 registros
        print("📋 COMPARACIÓN DETALLADA:")
        print("=" * 80)
        
        # Obtener estructura de columnas
        cursor.execute("PRAGMA table_info(items)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Columnas: {columns}")
        print()
        
        # Comparar registros específicos
        registros_a_comparar = [1, 2, 3, 4, 5]
        
        for item_id in registros_a_comparar:
            print(f"🔍 ITEM {item_id}:")
            print("-" * 50)
            
            # Obtener todos los campos del registro
            placeholders = ','.join(['?' for _ in columns])
            query = f"SELECT {','.join(columns)} FROM items WHERE id = ?"
            cursor.execute(query, (item_id,))
            row = cursor.fetchone()
            
            if row:
                for i, (col, value) in enumerate(zip(columns, row)):
                    print(f"  {col}: {repr(value)} ({type(value).__name__})")
            else:
                print(f"  ❌ No encontrado")
            print()
        
        # Verificar diferencias específicas
        print("🔍 ANÁLISIS DE DIFERENCIAS:")
        print("=" * 80)
        
        # Comparar campos críticos entre registros que aparecen vs no aparecen
        campos_criticos = ['deleted_at', 'created_at', 'updated_at', 'version']
        
        for campo in campos_criticos:
            print(f"\n📊 Campo '{campo}':")
            cursor.execute(f"""
                SELECT id, {campo} 
                FROM items 
                WHERE id IN (1,2,3,4,5) 
                ORDER BY id
            """)
            for row in cursor.fetchall():
                print(f"  ID {row[0]}: {repr(row[1])}")
        
        # Buscar patrones en los datos
        print("\n🔍 PATRONES EN LOS DATOS:")
        print("=" * 80)
        
        # Verificar si hay diferencias en los tipos de datos
        cursor.execute("""
            SELECT 
                id,
                typeof(deleted_at) as deleted_at_type,
                typeof(created_at) as created_at_type,
                typeof(updated_at) as updated_at_type,
                typeof(version) as version_type,
                deleted_at,
                created_at,
                updated_at,
                version
            FROM items 
            WHERE id <= 10
            ORDER BY id
        """)
        
        print("ID | deleted_at_type | created_at_type | updated_at_type | version_type | deleted_at | created_at | updated_at | version")
        print("-" * 120)
        for row in cursor.fetchall():
            print(f"{row[0]:2} | {row[1]:15} | {row[2]:15} | {row[3]:15} | {row[4]:12} | {str(row[5])[:10]:10} | {str(row[6])[:10]:10} | {str(row[7])[:10]:10} | {row[8]}")
        
        # Verificar si hay duplicados o problemas de inserción
        print(f"\n🔍 VERIFICACIÓN DE INSERCIÓN:")
        print("=" * 80)
        
        cursor.execute("""
            SELECT 
                MIN(id) as min_id,
                MAX(id) as max_id,
                COUNT(*) as total,
                COUNT(DISTINCT id) as unique_ids
            FROM items
        """)
        row = cursor.fetchone()
        print(f"Min ID: {row[0]}, Max ID: {row[1]}, Total: {row[2]}, IDs únicos: {row[3]}")
        
        # Verificar secuencia de IDs
        cursor.execute("SELECT id FROM items ORDER BY id")
        ids = [row[0] for row in cursor.fetchall()]
        gaps = []
        for i in range(1, max(ids) + 1):
            if i not in ids:
                gaps.append(i)
        
        if gaps:
            print(f"❌ IDs faltantes: {gaps}")
        else:
            print("✅ Secuencia de IDs completa")
            
        # Verificar timestamps específicos que podrían causar problemas
        print(f"\n🕒 ANÁLISIS DE TIMESTAMPS:")
        print("=" * 80)
        
        cursor.execute("""
            SELECT id, created_at, updated_at,
                   datetime(created_at) as created_parsed,
                   datetime(updated_at) as updated_parsed
            FROM items 
            WHERE id <= 5
            ORDER BY id
        """)
        
        for row in cursor.fetchall():
            print(f"ID {row[0]}:")
            print(f"  created_at: '{row[1]}' -> parsed: '{row[3]}'")
            print(f"  updated_at: '{row[2]}' -> parsed: '{row[4]}'")
            print()
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    comparar_registros()
