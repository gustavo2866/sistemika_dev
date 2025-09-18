#!/usr/bin/env python3
"""
Script para verificar específicamente la tabla proveedores
"""
import sqlite3
import os

def check_proveedores_table():
    # Buscar la base de datos
    db_path = None
    possible_paths = [
        'invoice_system.db',
        'data/invoice_system.db', 
        'app/invoice_system.db'
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ No se encontró la base de datos")
        return False
    
    print(f"📂 Usando base de datos: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Verificar si la tabla existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='proveedores'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("❌ La tabla 'proveedores' no existe")
            return False
        
        print("✅ La tabla 'proveedores' existe")
        
        # Verificar la estructura de la tabla
        cursor.execute("PRAGMA table_info(proveedores)")
        columns = cursor.fetchall()
        print(f"📋 Estructura de la tabla 'proveedores':")
        for col in columns:
            print(f"  - {col[1]} {col[2]} {'NOT NULL' if col[3] else 'NULL'}")
        
        # Verificar datos
        cursor.execute("SELECT COUNT(*) FROM proveedores")
        count = cursor.fetchone()[0]
        print(f"📊 Total proveedores: {count}")
        
        if count > 0:
            cursor.execute("SELECT id, nombre, cuit FROM proveedores LIMIT 5")
            proveedores = cursor.fetchall()
            print("👥 Primeros proveedores:")
            for prov in proveedores:
                print(f"  - ID: {prov[0]}, Nombre: {prov[1]}, CUIT: {prov[2]}")
        
        # Intentar una consulta simple
        try:
            cursor.execute("SELECT * FROM proveedores LIMIT 1")
            result = cursor.fetchone()
            print("✅ Consulta SELECT básica funciona")
        except Exception as e:
            print(f"❌ Error en consulta SELECT básica: {e}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error verificando tabla proveedores: {e}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🔍 Verificando tabla proveedores...")
    success = check_proveedores_table()
    
    if success:
        print("\n✅ Verificación completada")
    else:
        print("\n❌ La verificación encontró problemas")
