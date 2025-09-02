#!/usr/bin/env python3
"""
Script para verificar el contenido de la base de datos
"""

import sqlite3
import os

def verificar_db():
    db_path = 'data/dev.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return
    
    print(f"🔍 Verificando base de datos: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Contar registros
        cursor.execute('SELECT COUNT(*) FROM items')
        total_items = cursor.fetchone()[0]
        print(f"📦 Total items: {total_items}")
        
        cursor.execute('SELECT COUNT(*) FROM users')
        total_users = cursor.fetchone()[0]
        print(f"👥 Total users: {total_users}")
        
        # Mostrar primeros items
        print("\n📋 Primeros 10 items:")
        cursor.execute('SELECT id, name, user_id FROM items ORDER BY id LIMIT 10')
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} (user: {row[2]})")
        
        # Mostrar usuarios
        print("\n👥 Usuarios:")
        cursor.execute('SELECT id, nombre, email FROM users ORDER BY id')
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} ({row[2]})")
        
        # Verificar estructura de tablas
        print("\n🏗️  Estructura tabla items:")
        cursor.execute("PRAGMA table_info(items)")
        for row in cursor.fetchall():
            print(f"  {row[1]} {row[2]} {'NOT NULL' if row[3] else 'NULL'}")
        
        # Verificar items por categoría
        print("\n🏷️  Items por categoría:")
        cursor.execute('SELECT category, COUNT(*) FROM items GROUP BY category ORDER BY COUNT(*) DESC LIMIT 5')
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} items")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    verificar_db()
