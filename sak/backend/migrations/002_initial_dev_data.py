#!/usr/bin/env python3
"""
Migración 002: Datos iniciales para desarrollo

Este script crea datos de prueba para desarrollo:
- 4 usuarios con datos realistas
- 12 items distribuidos entre los usuarios
- Resetea la base de datos dev.db con datos frescos

Fecha: 2025-08-31
"""

import sqlite3
import os
from datetime import datetime, timedelta
import random

def run_migration():
    """Ejecuta la migración de datos iniciales para desarrollo"""
    
    # Ruta de la base de datos de desarrollo
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'dev.db')
    
    print(f"🔄 Iniciando migración 002 - Datos iniciales para desarrollo...")
    print(f"📂 Base de datos: {db_path}")
    
    # Crear directorio data si no existe
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Hacer backup si existe
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"💾 Backup creado: {backup_path}")
    
    # Conectar a la base de datos
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Crear las tablas desde cero
        print("🏗️  Recreando estructura de base de datos...")
        
        # Eliminar tablas existentes para recrearlas con la estructura correcta
        cursor.execute("DROP TABLE IF EXISTS items")
        cursor.execute("DROP TABLE IF EXISTS users")
        
        # Crear tabla users
        cursor.execute("""
            CREATE TABLE users (
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
        
        # Crear tabla items
        cursor.execute("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2),
                category VARCHAR(100),
                stock INTEGER DEFAULT 0,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP,
                version INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Limpiar datos existentes (ya no es necesario ya que recreamos las tablas)
        print("🧹 Tablas recreadas, listas para datos...")
        
        # Datos de usuarios de prueba
        usuarios_data = [
            {
                'nombre': 'Ana García López',
                'telefono': '+34 612 345 678',
                'email': 'ana.garcia@sistemika.com',
                'url_foto': 'https://images.unsplash.com/photo-1494790108755-2616b612b417?w=150&h=150&fit=crop&crop=face'
            },
            {
                'nombre': 'Carlos Rodríguez Martín',
                'telefono': '+34 687 234 567',
                'email': 'carlos.rodriguez@sistemika.com',
                'url_foto': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
            },
            {
                'nombre': 'María Fernández Silva',
                'telefono': '+34 634 567 890',
                'email': 'maria.fernandez@sistemika.com',
                'url_foto': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
            },
            {
                'nombre': 'David López Jiménez',
                'telefono': '+34 698 876 543',
                'email': 'david.lopez@sistemika.com',
                'url_foto': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
            }
        ]
        
        # Insertar usuarios
        print("👥 Insertando usuarios de prueba...")
        user_ids = []
        for i, user in enumerate(usuarios_data, 1):
            created_date = (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
            cursor.execute("""
                INSERT INTO users (nombre, telefono, email, url_foto, created_at, updated_at, version)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                user['nombre'],
                user['telefono'],
                user['email'],
                user['url_foto'],
                created_date,
                created_date,
                1
            ))
            user_ids.append(i)
            print(f"   ✓ Usuario {i}: {user['nombre']} ({user['email']})")
        
        # Datos de items de prueba
        items_data = [
            # Items para Ana García (id: 1)
            {'name': 'Laptop Dell XPS 13', 'description': 'Laptop ultrabook para desarrollo', 'price': 1299.99, 'category': 'Tecnología', 'stock': 5, 'user_id': 1},
            {'name': 'Monitor 4K Samsung', 'description': 'Monitor 27 pulgadas para diseño', 'price': 399.99, 'category': 'Tecnología', 'stock': 8, 'user_id': 1},
            {'name': 'Teclado Mecánico RGB', 'description': 'Teclado gaming con switches azules', 'price': 149.99, 'category': 'Accesorios', 'stock': 12, 'user_id': 1},
            
            # Items para Carlos Rodríguez (id: 2)
            {'name': 'iPhone 15 Pro Max', 'description': 'Smartphone de última generación', 'price': 1199.99, 'category': 'Móviles', 'stock': 3, 'user_id': 2},
            {'name': 'MacBook Air M3', 'description': 'Laptop Apple con chip M3', 'price': 1599.99, 'category': 'Tecnología', 'stock': 6, 'user_id': 2},
            {'name': 'AirPods Pro 2', 'description': 'Auriculares inalámbricos con cancelación', 'price': 249.99, 'category': 'Audio', 'stock': 15, 'user_id': 2},
            
            # Items para María Fernández (id: 3)
            {'name': 'Cámara Canon EOS R6', 'description': 'Cámara mirrorless profesional', 'price': 2499.99, 'category': 'Fotografía', 'stock': 2, 'user_id': 3},
            {'name': 'Lente Sony 85mm f/1.4', 'description': 'Lente retrato profesional', 'price': 599.99, 'category': 'Fotografía', 'stock': 4, 'user_id': 3},
            {'name': 'Trípode Manfrotto Carbon', 'description': 'Trípode de fibra de carbono', 'price': 329.99, 'category': 'Fotografía', 'stock': 7, 'user_id': 3},
            
            # Items para David López (id: 4)
            {'name': 'Xbox Series X', 'description': 'Consola de videojuegos de Microsoft', 'price': 499.99, 'category': 'Gaming', 'stock': 10, 'user_id': 4},
            {'name': 'PlayStation 5 Digital', 'description': 'Consola PlayStation sin lector de discos', 'price': 399.99, 'category': 'Gaming', 'stock': 8, 'user_id': 4},
            {'name': 'SteamDeck OLED', 'description': 'Consola portátil de Valve', 'price': 649.99, 'category': 'Gaming', 'stock': 5, 'user_id': 4}
        ]
        
        # Insertar items
        print("📦 Insertando items de prueba...")
        for i, item in enumerate(items_data, 1):
            created_date = (datetime.now() - timedelta(days=random.randint(1, 20))).isoformat()
            cursor.execute("""
                INSERT INTO items (name, description, price, category, stock, user_id, created_at, updated_at, version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item['name'],
                item['description'],
                item['price'],
                item['category'],
                item['stock'],
                item['user_id'],
                created_date,
                created_date,
                1
            ))
            
            # Obtener el nombre del usuario
            user_name = usuarios_data[item['user_id'] - 1]['nombre']
            print(f"   ✓ Item {i}: {item['name']} → {user_name}")
        
        # Confirmar cambios
        conn.commit()
        
        # Mostrar estadísticas finales
        print("\n📊 Estadísticas de la migración:")
        
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"   👥 Usuarios creados: {user_count}")
        
        cursor.execute("SELECT COUNT(*) FROM items")
        item_count = cursor.fetchone()[0]
        print(f"   📦 Items creados: {item_count}")
        
        cursor.execute("""
            SELECT u.nombre, COUNT(i.id) as item_count 
            FROM users u 
            LEFT JOIN items i ON u.id = i.user_id 
            GROUP BY u.id, u.nombre
            ORDER BY u.id
        """)
        user_stats = cursor.fetchall()
        
        print("   📋 Items por usuario:")
        for user_name, count in user_stats:
            print(f"      • {user_name}: {count} items")
        
        cursor.execute("SELECT DISTINCT category FROM items ORDER BY category")
        categories = [row[0] for row in cursor.fetchall()]
        print(f"   🏷️  Categorías: {', '.join(categories)}")
        
        cursor.execute("SELECT SUM(stock) FROM items")
        total_stock = cursor.fetchone()[0]
        print(f"   📊 Stock total: {total_stock} unidades")
        
        cursor.execute("SELECT SUM(price * stock) FROM items")
        total_value = cursor.fetchone()[0]
        print(f"   💰 Valor total inventario: €{total_value:,.2f}")
        
        print(f"\n✅ Migración 002 completada exitosamente!")
        print(f"🗄️  Base de datos: {db_path}")
        print(f"🕒 Completada en: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
