#!/usr/bin/env python3
"""
Script simple para migrar datos de items a item
"""

import sqlite3
import os
import time

def migrar_simple():
    """Migración simple y directa"""

    db_path = 'data/dev.db'
    max_retries = 5
    retry_delay = 1

    for attempt in range(max_retries):
        try:
            print(f"🔄 Intento {attempt + 1}/{max_retries}...")

            conn = sqlite3.connect(db_path, timeout=30)
            cursor = conn.cursor()

            # Verificar estado
            cursor.execute("SELECT COUNT(*) FROM items")
            count_items = cursor.fetchone()[0]
            print(f"📦 items: {count_items} registros")

            # Copiar datos directamente
            print("📋 Copiando datos...")

            # Limpiar item primero
            cursor.execute("DELETE FROM item")

            # Copiar todos los datos
            cursor.execute("""
                INSERT INTO item (id, created_at, updated_at, deleted_at, version, name, description, user_id, price, category, stock)
                SELECT id, created_at, updated_at, deleted_at, version, name, description, user_id, price, category, stock
                FROM items
                ORDER BY id
            """)

            # Verificar
            cursor.execute("SELECT COUNT(*) FROM item")
            count_item = cursor.fetchone()[0]
            print(f"✅ Copiados {count_item} registros a 'item'")

            if count_item == count_items:
                # Eliminar tabla items
                cursor.execute("DROP TABLE items")
                print("✅ Tabla 'items' eliminada")

                conn.commit()
                print("✅ Migración completada!")
                return True
            else:
                print("❌ Error: No se copiaron todos los registros")
                conn.rollback()
                return False

        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                print(f"⚠️  Base de datos bloqueada, reintentando en {retry_delay}s...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            else:
                print(f"❌ Error: {e}")
                return False
        except Exception as e:
            print(f"❌ Error inesperado: {e}")
            return False
        finally:
            try:
                conn.close()
            except:
                pass

    print("❌ No se pudo completar la migración después de varios intentos")
    return False

if __name__ == "__main__":
    success = migrar_simple()
    if success:
        print("\n🎉 Migración exitosa! Ahora el frontend debería funcionar correctamente.")
    else:
        print("\n❌ La migración falló. Revisa los logs para más detalles.")
