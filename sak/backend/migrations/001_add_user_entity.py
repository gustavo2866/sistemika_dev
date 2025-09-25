#!/usr/bin/env python3
"""
Migración 001: Agregar entidad User y relación con Item

Este script realiza:
1. Crea la tabla users
2. Agrega la columna user_id a items
3. Crea un usuario inicial
4. Asigna todos los items existentes al usuario inicial

Fecha: 2025-08-31
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    """Ejecuta la migración de base de datos"""
    
    # Ruta de la base de datos
    db_path = os.path.join(os.path.dirname(__file__), '..', 'test.db')
    
    print(f"🔄 Iniciando migración 001...")
    print(f"📂 Base de datos: {db_path}")
    
    # Hacer backup
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    if os.path.exists(db_path):
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"💾 Backup creado: {backup_path}")
    
    # Conectar a la base de datos
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 1. Crear tabla users
        print("📋 Creando tabla users...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre VARCHAR(100) NOT NULL,
                telefono VARCHAR(20),
                email VARCHAR(255) NOT NULL UNIQUE,
                url_foto VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP,
                version INTEGER DEFAULT 1
            )
        """)
        
        # 2. Verificar si la columna user_id ya existe en item
        cursor.execute("PRAGMA table_info(item)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'user_id' not in columns:
            print("🔗 Agregando columna user_id a tabla item...")
            cursor.execute("ALTER TABLE item ADD COLUMN user_id INTEGER REFERENCES users(id)")
        else:
            print("ℹ️  Columna user_id ya existe en tabla item")
        
        # 3. Crear usuario inicial si no existe
        cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'admin@sistema.com'")
        if cursor.fetchone()[0] == 0:
            print("👤 Creando usuario inicial...")
            cursor.execute("""
                INSERT INTO users (nombre, telefono, email, url_foto)
                VALUES ('Administrador Sistema', '+123456789', 'admin@sistema.com', NULL)
            """)
            user_id = cursor.lastrowid
            print(f"✅ Usuario inicial creado con ID: {user_id}")
        else:
            cursor.execute("SELECT id FROM users WHERE email = 'admin@sistema.com'")
            user_id = cursor.fetchone()[0]
            print(f"ℹ️  Usuario inicial ya existe con ID: {user_id}")
        
        # 4. Asignar items sin usuario al usuario inicial
        cursor.execute("SELECT COUNT(*) FROM item WHERE user_id IS NULL")
        items_sin_usuario = cursor.fetchone()[0]
        
        if items_sin_usuario > 0:
            print(f"🔄 Asignando {items_sin_usuario} items al usuario inicial...")
            cursor.execute("UPDATE item SET user_id = ? WHERE user_id IS NULL", (user_id,))
            print(f"✅ {items_sin_usuario} items actualizados")
        else:
            print("ℹ️  Todos los items ya tienen usuario asignado")
        
        # Confirmar cambios
        conn.commit()
        print("✅ Migración completada exitosamente!")
        
        # Mostrar estadísticas finales
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM item")
        total_items = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM item WHERE user_id IS NOT NULL")
        items_con_usuario = cursor.fetchone()[0]
        
        print(f"\n📊 Estadísticas finales:")
        print(f"   👥 Total usuarios: {total_users}")
        print(f"   📦 Total items: {total_items}")
        print(f"   🔗 Items con usuario: {items_con_usuario}")
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
