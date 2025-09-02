#!/usr/bin/env python3
"""
Script para migrar datos de tabla 'items' a 'item' y eliminar 'items'
"""

import sqlite3
import os
from datetime import datetime

def migrar_tabla_items_a_item():
    """Migra los datos de la tabla 'items' a 'item' y elimina 'items'"""

    db_path = 'data/dev.db'

    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return

    print(f"🔄 Iniciando migración de tabla 'items' a 'item'...")
    print(f"📂 Base de datos: {db_path}")

    # Hacer backup
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"💾 Backup creado: {backup_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Verificar tablas existentes
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tablas = [row[0] for row in cursor.fetchall()]
        print(f"📋 Tablas existentes: {tablas}")

        # Verificar si existe tabla 'items'
        if 'items' not in tablas:
            print("❌ La tabla 'items' no existe")
            return

        # Verificar si ya existe tabla 'item'
        if 'item' in tablas:
            print("⚠️  La tabla 'item' ya existe. Verificando contenido...")
            cursor.execute("SELECT COUNT(*) FROM item")
            count_item = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM items")
            count_items = cursor.fetchone()[0]
            print(f"   📊 item: {count_item} registros")
            print(f"   📊 items: {count_items} registros")

            if count_item > 0:
                respuesta = input("La tabla 'item' ya tiene datos. ¿Deseas continuar? (s/n): ")
                if respuesta.lower() != 's':
                    print("❌ Operación cancelada por el usuario")
                    return
        else:
            # Crear tabla 'item' con la misma estructura que 'items'
            print("🏗️  Creando tabla 'item'...")
            cursor.execute("""
                CREATE TABLE item (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(10,2),
                    category VARCHAR(100),
                    stock INTEGER DEFAULT 0,
                    user_id INTEGER,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    deleted_at TIMESTAMP,
                    version INTEGER DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)

        # Copiar datos de 'items' a 'item'
        print("📋 Copiando datos de 'items' a 'item'...")

        # Obtener todos los registros de items
        cursor.execute("SELECT * FROM items ORDER BY id")
        registros_items = cursor.fetchall()

        # Obtener nombres de columnas
        cursor.execute("PRAGMA table_info(items)")
        columnas = [row[1] for row in cursor.fetchall()]

        print(f"📊 Total de registros a copiar: {len(registros_items)}")
        print(f"📋 Columnas: {columnas}")

        # Insertar registros en tabla 'item'
        registros_copiados = 0
        for registro in registros_items:
            placeholders = ','.join(['?' for _ in columnas])
            query = f"INSERT OR REPLACE INTO item ({','.join(columnas)}) VALUES ({placeholders})"
            cursor.execute(query, registro)
            registros_copiados += 1

            if registros_copiados % 10 == 0:
                print(f"   ✅ Copiados {registros_copiados}/{len(registros_items)} registros")

        print(f"✅ Todos los registros copiados: {registros_copiados}")

        # Verificar que los datos se copiaron correctamente
        cursor.execute("SELECT COUNT(*) FROM item")
        count_item_final = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM items")
        count_items_final = cursor.fetchone()[0]

        print("\n📊 Verificación:")
        print(f"   📦 item: {count_item_final} registros")
        print(f"   📦 items: {count_items_final} registros")

        if count_item_final == count_items_final:
            print("✅ Los datos se copiaron correctamente")

            # Eliminar tabla 'items'
            print("🗑️  Eliminando tabla 'items'...")
            cursor.execute("DROP TABLE items")
            print("✅ Tabla 'items' eliminada")

            # Verificar tablas finales
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tablas_finales = [row[0] for row in cursor.fetchall()]
            print(f"📋 Tablas finales: {tablas_finales}")

            # Mostrar algunos registros de la nueva tabla
            print("\n📋 Primeros 5 registros en tabla 'item':")
            cursor.execute("SELECT id, name, category, user_id FROM item ORDER BY id LIMIT 5")
            for row in cursor.fetchall():
                print(f"   {row[0]}: {row[1]} ({row[2]}) - user: {row[3]}")

        else:
            print("❌ Error: Los datos no se copiaron correctamente")
            conn.rollback()
            return

        # Confirmar cambios
        conn.commit()

        print("\n✅ Migración completada exitosamente!")
        print(f"🗄️  Base de datos: {db_path}")
        print(f"🕒 Completada en: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    migrar_tabla_items_a_item()
