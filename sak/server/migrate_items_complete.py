#!/usr/bin/env python3
"""
Script para migrar datos de tabla 'items' a 'item' con estructura completa
"""

import sqlite3
import os
from datetime import datetime

def migrar_items_completo():
    """Migra completamente los datos de 'items' a 'item' con todas las columnas"""

    db_path = 'data/dev.db'

    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return

    print(f"🔄 Iniciando migración completa de 'items' a 'item'...")
    print(f"📂 Base de datos: {db_path}")

    # Hacer backup
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"💾 Backup creado: {backup_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Verificar datos existentes
        cursor.execute("SELECT COUNT(*) FROM item")
        count_item = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM items")
        count_items = cursor.fetchone()[0]

        print(f"📊 Estado inicial:")
        print(f"   📦 item: {count_item} registros")
        print(f"   📦 items: {count_items} registros")

        # Hacer backup de los datos existentes en 'item'
        if count_item > 0:
            print("💾 Creando backup de datos existentes en 'item'...")
            cursor.execute("CREATE TABLE item_backup AS SELECT * FROM item")
            print("✅ Backup creado")

        # Actualizar estructura de tabla 'item' para incluir columnas faltantes
        print("🏗️  Actualizando estructura de tabla 'item'...")

        # Agregar columnas faltantes
        columnas_a_agregar = [
            ('price', 'DECIMAL(10,2)'),
            ('category', 'VARCHAR(100)'),
            ('stock', 'INTEGER DEFAULT 0')
        ]

        for columna, tipo in columnas_a_agregar:
            try:
                cursor.execute(f"ALTER TABLE item ADD COLUMN {columna} {tipo}")
                print(f"   ✅ Columna '{columna}' agregada")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print(f"   ⚠️  Columna '{columna}' ya existe")
                else:
                    raise

        # Verificar estructura actualizada
        cursor.execute("PRAGMA table_info(item)")
        estructura_item = cursor.fetchall()
        columnas_item = [row[1] for row in estructura_item]
        print(f"   📋 Columnas en 'item': {columnas_item}")

        # Limpiar datos existentes en 'item' (son datos de prueba)
        if count_item > 0:
            print("🧹 Limpiando datos de prueba en tabla 'item'...")
            cursor.execute("DELETE FROM item")
            print("✅ Datos de prueba eliminados")

        # Copiar datos de 'items' a 'item' con mapeo correcto
        print("📋 Copiando datos de 'items' a 'item'...")

        # Obtener todos los registros de items
        cursor.execute("SELECT * FROM items ORDER BY id")
        registros_items = cursor.fetchall()

        # Mapeo de columnas (items -> item)
        # items: id, name, description, price, category, stock, user_id, created_at, updated_at, deleted_at, version
        # item:  id, created_at, updated_at, deleted_at, version, name, description, user_id, [price, category, stock]

        registros_copiados = 0
        for registro in registros_items:
            # Reordenar los campos para que coincidan con la estructura de 'item'
            # item espera: id, created_at, updated_at, deleted_at, version, name, description, user_id, price, category, stock
            item_registro = (
                registro[0],  # id
                registro[7],  # created_at
                registro[8],  # updated_at
                registro[9],  # deleted_at
                registro[10], # version
                registro[1],  # name
                registro[2],  # description
                registro[6],  # user_id
                registro[3],  # price
                registro[4],  # category
                registro[5],  # stock
            )

            cursor.execute("""
                INSERT INTO item (id, created_at, updated_at, deleted_at, version, name, description, user_id, price, category, stock)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, item_registro)

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

            # Limpiar backup si existe
            try:
                cursor.execute("DROP TABLE item_backup")
                print("🧹 Backup de datos antiguos eliminado")
            except:
                pass

            # Verificar tablas finales
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tablas_finales = [row[0] for row in cursor.fetchall()]
            print(f"📋 Tablas finales: {tablas_finales}")

            # Mostrar algunos registros de la nueva tabla
            print("\n📋 Primeros 5 registros en tabla 'item':")
            cursor.execute("SELECT id, name, category, price, stock, user_id FROM item ORDER BY id LIMIT 5")
            for row in cursor.fetchall():
                print(f"   {row[0]}: {row[1]} ({row[2]}) - €{row[3]} - Stock: {row[4]} - User: {row[5]}")

            # Estadísticas finales
            cursor.execute("SELECT COUNT(*) FROM item")
            total_items = cursor.fetchone()[0]

            cursor.execute("SELECT SUM(stock) FROM item")
            total_stock = cursor.fetchone()[0] or 0

            cursor.execute("SELECT SUM(price * stock) FROM item")
            total_valor = cursor.fetchone()[0] or 0

            cursor.execute("SELECT category, COUNT(*) FROM item GROUP BY category ORDER BY COUNT(*) DESC LIMIT 3")
            top_categorias = cursor.fetchall()

            print("\n📊 Estadísticas finales:")
            print(f"   📦 Total items: {total_items}")
            print(f"   📊 Stock total: {total_stock} unidades")
            print(f"   💰 Valor total inventario: €{total_valor:,.2f}")
            print("   🏷️  Top categorías:")
            for categoria, count in top_categorias:
                print(f"      • {categoria}: {count} items")

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
    migrar_items_completo()
