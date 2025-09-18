#!/usr/bin/env python3
"""
Migración 004: Agregar usuario responsable a facturas

Este script realiza:
1. Agrega la columna usuario_responsable_id a la tabla facturas
2. Crea foreign key constraint con usuarios
3. Asigna un usuario por defecto a facturas existentes

Fecha: 2025-09-16
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    """Ejecuta la migración de base de datos"""
    
    # Ruta de la base de datos
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'dev.db')
    
    print(f"🔄 Iniciando migración 004...")
    print(f"📂 Base de datos: {db_path}")
    
    # Verificar que existe la base de datos
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return False
    
    # Hacer backup
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"💾 Backup creado: {backup_path}")
    
    # Conectar a la base de datos
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Verificar si la tabla facturas existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='facturas'")
        if not cursor.fetchone():
            print("❌ Tabla 'facturas' no encontrada")
            return False
        
        # Verificar si la tabla usuarios existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print("❌ Tabla 'users' no encontrada")
            return False
        
        # Verificar si la columna ya existe
        cursor.execute("PRAGMA table_info(facturas)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'usuario_responsable_id' in columns:
            print("⚠️  La columna 'usuario_responsable_id' ya existe en la tabla facturas")
            return True
        
        print("📋 Agregando columna usuario_responsable_id a facturas...")
        
        # 1. Agregar la columna usuario_responsable_id (sin foreign key constraint por ahora)
        cursor.execute("""
            ALTER TABLE facturas 
            ADD COLUMN usuario_responsable_id INTEGER
        """)
        
        # 2. Obtener el primer usuario disponible para asignar por defecto
        cursor.execute("SELECT id FROM users ORDER BY id LIMIT 1")
        primer_usuario = cursor.fetchone()
        
        if primer_usuario:
            usuario_default_id = primer_usuario[0]
            print(f"👤 Asignando usuario por defecto (ID: {usuario_default_id}) a facturas existentes...")
            
            # 3. Asignar el usuario por defecto a todas las facturas existentes
            cursor.execute("""
                UPDATE facturas 
                SET usuario_responsable_id = ? 
                WHERE usuario_responsable_id IS NULL
            """, (usuario_default_id,))
            
            print(f"✅ {cursor.rowcount} facturas actualizadas con usuario responsable")
        else:
            print("⚠️  No hay usuarios en la base de datos. Las facturas quedarán sin usuario responsable.")
        
        # 4. Mostrar estado final
        cursor.execute("SELECT COUNT(*) FROM facturas")
        total_facturas = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM facturas WHERE usuario_responsable_id IS NOT NULL")
        facturas_con_usuario = cursor.fetchone()[0]
        
        print(f"📊 Estado final:")
        print(f"   Total facturas: {total_facturas}")
        print(f"   Facturas con usuario responsable: {facturas_con_usuario}")
        
        # Confirmar cambios
        conn.commit()
        print("✅ Migración 004 completada exitosamente")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Error en la migración: {e}")
        conn.rollback()
        return False
        
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

def verificar_migracion():
    """Verifica que la migración se aplicó correctamente"""
    
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'dev.db')
    
    if not os.path.exists(db_path):
        print("❌ Base de datos no encontrada para verificación")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Verificar estructura de la tabla
        print("🔍 Verificando estructura de la tabla facturas...")
        cursor.execute("PRAGMA table_info(facturas)")
        columns = cursor.fetchall()
        
        print("📋 Columnas de la tabla facturas:")
        for col in columns:
            col_name = col[1]
            col_type = col[2]
            is_nullable = "NULL" if col[3] == 0 else "NOT NULL"
            default_val = f" DEFAULT {col[4]}" if col[4] else ""
            print(f"   {col_name}: {col_type} {is_nullable}{default_val}")
        
        # Verificar datos
        cursor.execute("""
            SELECT COUNT(*) as total_facturas,
                   COUNT(usuario_responsable_id) as con_usuario,
                   COUNT(*) - COUNT(usuario_responsable_id) as sin_usuario
            FROM facturas
        """)
        
        result = cursor.fetchone()
        print(f"\n📊 Estado de los datos:")
        print(f"   Total facturas: {result[0]}")
        print(f"   Con usuario responsable: {result[1]}")
        print(f"   Sin usuario responsable: {result[2]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en verificación: {e}")
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 MIGRACIÓN 004: Agregar usuario responsable a facturas")
    print("=" * 60)
    
    # Ejecutar migración
    if run_migration():
        print("\n" + "=" * 60)
        verificar_migracion()
        print("=" * 60)
    else:
        print("\n❌ La migración falló")
