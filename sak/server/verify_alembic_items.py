#!/usr/bin/env python3
"""
Script para verificar los items agregados por Alembic
"""

import sqlite3
import os

def verificar_items_alembic():
    db_path = 'data/dev.db'

    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return

    print(f"🔍 Verificando items agregados por Alembic en: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Items agregados por la migración de Alembic (IDs 61-79)
        print("📦 Items agregados por Alembic (IDs 61-79):")
        print("=" * 80)

        cursor.execute("""
            SELECT id, name, category, price, user_id
            FROM items
            WHERE id > 60
            ORDER BY id
        """)

        for row in cursor.fetchall():
            print(f"  {row[0]:2}: {row[1]:30} ({row[2]:15}) - €{row[3]:8.2f} (user: {row[4]})")

        # Estadísticas de los nuevos items
        print("\n📊 Estadísticas de items agregados por Alembic:")
        print("=" * 80)

        cursor.execute("SELECT COUNT(*) FROM items WHERE id > 60")
        nuevos_items = cursor.fetchone()[0]
        print(f"📦 Nuevos items agregados: {nuevos_items}")

        cursor.execute("SELECT SUM(stock) FROM items WHERE id > 60")
        nuevo_stock = cursor.fetchone()[0]
        print(f"📊 Nuevo stock agregado: {nuevo_stock} unidades")

        cursor.execute("SELECT SUM(price * stock) FROM items WHERE id > 60")
        nuevo_valor = cursor.fetchone()[0]
        print(f"💰 Nuevo valor agregado: €{nuevo_valor:,.2f}")

        # Categorías de los nuevos items
        print("\n🏷️  Categorías de nuevos items:")
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM items
            WHERE id > 60
            GROUP BY category
            ORDER BY count DESC
        """)

        for row in cursor.fetchall():
            print(f"  • {row[0]}: {row[1]} items")

        # Distribución por usuario
        print("\n👥 Distribución por usuario (nuevos items):")
        cursor.execute("""
            SELECT u.nombre, COUNT(i.id) as count
            FROM users u
            LEFT JOIN items i ON u.id = i.user_id AND i.id > 60
            GROUP BY u.id, u.nombre
            ORDER BY count DESC
        """)

        for row in cursor.fetchall():
            print(f"  • {row[0]}: {row[1]} items")

        print("\n✅ Verificación completada!")
        print(f"🗄️  Base de datos: {db_path}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    verificar_items_alembic()
