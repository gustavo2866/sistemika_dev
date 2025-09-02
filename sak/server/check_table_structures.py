#!/usr/bin/env python3
"""
Script para verificar y comparar estructuras de tablas
"""

import sqlite3
import os

def verificar_estructuras():
    db_path = 'data/dev.db'

    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return

    print(f"🔍 Verificando estructuras de tablas en: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Verificar tablas existentes
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tablas = [row[0] for row in cursor.fetchall()]
        print(f"📋 Tablas existentes: {tablas}")

        # Verificar estructura de tabla 'item'
        print("\n🏗️  Estructura tabla 'item':")
        cursor.execute("PRAGMA table_info(item)")
        for row in cursor.fetchall():
            print(f"  {row[1]} {row[2]} {'NOT NULL' if row[3] else 'NULL'}")

        # Verificar estructura de tabla 'items'
        print("\n🏗️  Estructura tabla 'items':")
        cursor.execute("PRAGMA table_info(items)")
        for row in cursor.fetchall():
            print(f"  {row[1]} {row[2]} {'NOT NULL' if row[3] else 'NULL'}")

        # Comparar estructuras
        print("\n🔍 Comparación de estructuras:")

        cursor.execute("PRAGMA table_info(item)")
        estructura_item = cursor.fetchall()

        cursor.execute("PRAGMA table_info(items)")
        estructura_items = cursor.fetchall()

        columnas_item = [row[1] for row in estructura_item]
        columnas_items = [row[1] for row in estructura_items]

        print(f"  📊 item tiene {len(columnas_item)} columnas: {columnas_item}")
        print(f"  📊 items tiene {len(columnas_items)} columnas: {columnas_items}")

        # Verificar diferencias
        solo_en_item = set(columnas_item) - set(columnas_items)
        solo_en_items = set(columnas_items) - set(columnas_item)

        if solo_en_item:
            print(f"  ⚠️  Columnas solo en 'item': {list(solo_en_item)}")
        if solo_en_items:
            print(f"  ⚠️  Columnas solo en 'items': {list(solo_en_items)}")

        # Verificar datos
        print("\n📊 Datos en las tablas:")
        cursor.execute("SELECT COUNT(*) FROM item")
        count_item = cursor.fetchone()[0]
        print(f"  📦 item: {count_item} registros")

        cursor.execute("SELECT COUNT(*) FROM items")
        count_items = cursor.fetchone()[0]
        print(f"  📦 items: {count_items} registros")

        # Mostrar algunos registros de cada tabla
        print("\n📋 Registros en tabla 'item':")
        cursor.execute("SELECT * FROM item LIMIT 3")
        registros_item = cursor.fetchall()
        for i, registro in enumerate(registros_item):
            print(f"  {i+1}: {registro}")

        print("\n📋 Registros en tabla 'items' (primeros 3):")
        cursor.execute("SELECT * FROM items LIMIT 3")
        registros_items = cursor.fetchall()
        for i, registro in enumerate(registros_items):
            print(f"  {i+1}: {registro}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    verificar_estructuras()
