#!/usr/bin/env python3
"""
Migración 003: Agregar más items de prueba

Este script agrega una cantidad significativa de items adicionales:
- 40+ items adicionales distribuidos entre usuarios
- Múltiples categorías (Electrónicos, Hogar, Deportes, Libros, Ropa, etc.)
- Variedad de precios y stocks
- Datos realistas para testing completo

Fecha: 2025-08-31
"""

import sqlite3
import os
from datetime import datetime, timedelta
import random

def run_migration():
    """Ejecuta la migración de items adicionales"""
    
    # Ruta de la base de datos de desarrollo
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'dev.db')
    
    print(f"🔄 Iniciando migración 003 - Agregar más items...")
    print(f"📂 Base de datos: {db_path}")
    
    # Hacer backup
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"💾 Backup creado: {backup_path}")
    
    # Conectar a la base de datos
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Verificar usuarios existentes
        cursor.execute("SELECT id, nombre FROM users ORDER BY id")
        usuarios = cursor.fetchall()
        print(f"👥 Usuarios existentes: {len(usuarios)}")
        for user_id, nombre in usuarios:
            print(f"   • {user_id}: {nombre}")
        
        # Datos de items adicionales - más variedad
        items_adicionales = [
            # Electrónicos y Gadgets
            {'name': 'Smart TV Samsung 55" QLED', 'description': 'Televisor 4K con HDR y Smart Hub', 'price': 899.99, 'category': 'Electrónicos', 'stock': 8, 'user_id': 1},
            {'name': 'Tablet iPad Air 5', 'description': 'Tablet Apple con chip M1', 'price': 679.99, 'category': 'Electrónicos', 'stock': 12, 'user_id': 1},
            {'name': 'Smartwatch Apple Watch Series 9', 'description': 'Reloj inteligente con GPS', 'price': 449.99, 'category': 'Electrónicos', 'stock': 15, 'user_id': 1},
            {'name': 'Auriculares Sony WH-1000XM5', 'description': 'Auriculares noise-cancelling premium', 'price': 349.99, 'category': 'Audio', 'stock': 20, 'user_id': 1},
            {'name': 'Webcam Logitech C920', 'description': 'Cámara web HD para streaming', 'price': 89.99, 'category': 'Accesorios', 'stock': 25, 'user_id': 1},
            
            # Smartphone y Móviles
            {'name': 'Samsung Galaxy S24 Ultra', 'description': 'Smartphone Android flagship', 'price': 1299.99, 'category': 'Móviles', 'stock': 6, 'user_id': 2},
            {'name': 'Google Pixel 8 Pro', 'description': 'Smartphone con IA avanzada', 'price': 999.99, 'category': 'Móviles', 'stock': 8, 'user_id': 2},
            {'name': 'OnePlus 12', 'description': 'Smartphone gaming premium', 'price': 849.99, 'category': 'Móviles', 'stock': 10, 'user_id': 2},
            {'name': 'Xiaomi 14 Pro', 'description': 'Smartphone con Leica cameras', 'price': 749.99, 'category': 'Móviles', 'stock': 12, 'user_id': 2},
            {'name': 'Power Bank Anker 20000mAh', 'description': 'Batería externa de alta capacidad', 'price': 59.99, 'category': 'Accesorios', 'stock': 30, 'user_id': 2},
            
            # Fotografía y Video
            {'name': 'Cámara Sony A7R V', 'description': 'Cámara mirrorless de 61MP', 'price': 3899.99, 'category': 'Fotografía', 'stock': 3, 'user_id': 3},
            {'name': 'Lente Canon RF 24-70mm f/2.8', 'description': 'Lente zoom profesional', 'price': 2199.99, 'category': 'Fotografía', 'stock': 5, 'user_id': 3},
            {'name': 'Flash Godox V1', 'description': 'Flash profesional para retratos', 'price': 269.99, 'category': 'Fotografía', 'stock': 8, 'user_id': 3},
            {'name': 'DJI Mini 4 Pro', 'description': 'Drone compacto con cámara 4K', 'price': 759.99, 'category': 'Fotografía', 'stock': 6, 'user_id': 3},
            {'name': 'GoPro Hero 12 Black', 'description': 'Cámara de acción resistente', 'price': 399.99, 'category': 'Fotografía', 'stock': 15, 'user_id': 3},
            
            # Gaming
            {'name': 'Nintendo Switch OLED', 'description': 'Consola híbrida con pantalla OLED', 'price': 349.99, 'category': 'Gaming', 'stock': 20, 'user_id': 4},
            {'name': 'Logitech G Pro X Superlight', 'description': 'Ratón gaming inalámbrico', 'price': 149.99, 'category': 'Gaming', 'stock': 25, 'user_id': 4},
            {'name': 'SteelSeries Arctis 7P', 'description': 'Auriculares gaming inalámbricos', 'price': 179.99, 'category': 'Gaming', 'stock': 18, 'user_id': 4},
            {'name': 'Razer BlackWidow V4', 'description': 'Teclado mecánico RGB gaming', 'price': 199.99, 'category': 'Gaming', 'stock': 12, 'user_id': 4},
            {'name': 'ASUS ROG Ally', 'description': 'Consola portátil gaming Windows', 'price': 699.99, 'category': 'Gaming', 'stock': 8, 'user_id': 4},
            
            # Hogar y Oficina
            {'name': 'Silla Herman Miller Aeron', 'description': 'Silla ergonómica premium', 'price': 1395.99, 'category': 'Oficina', 'stock': 4, 'user_id': 1},
            {'name': 'Escritorio Uplift V2 Standing', 'description': 'Escritorio ajustable en altura', 'price': 699.99, 'category': 'Oficina', 'stock': 6, 'user_id': 1},
            {'name': 'Lámpara Philips Hue Go', 'description': 'Lámpara inteligente RGB', 'price': 79.99, 'category': 'Hogar', 'stock': 20, 'user_id': 2},
            {'name': 'Altavoz Amazon Echo Studio', 'description': 'Altavoz inteligente de alta fidelidad', 'price': 199.99, 'category': 'Hogar', 'stock': 15, 'user_id': 2},
            {'name': 'Robot Aspirador Roomba j7+', 'description': 'Aspiradora robótica inteligente', 'price': 799.99, 'category': 'Hogar', 'stock': 8, 'user_id': 3},
            
            # Deportes y Fitness
            {'name': 'Bicicleta Canyon Grail CF SL 8', 'description': 'Bicicleta gravel de carbono', 'price': 2199.99, 'category': 'Deportes', 'stock': 3, 'user_id': 4},
            {'name': 'Zapatillas Nike Air Zoom Pegasus 40', 'description': 'Zapatillas running premium', 'price': 139.99, 'category': 'Deportes', 'stock': 25, 'user_id': 4},
            {'name': 'Pulsera Garmin Vivosmart 5', 'description': 'Monitor de actividad y salud', 'price': 149.99, 'category': 'Deportes', 'stock': 18, 'user_id': 1},
            {'name': 'Esterilla Yoga Manduka Pro', 'description': 'Esterilla profesional de yoga', 'price': 119.99, 'category': 'Deportes', 'stock': 12, 'user_id': 2},
            {'name': 'Mancuernas Ajustables Bowflex', 'description': 'Set de mancuernas 5-50 lbs', 'price': 549.99, 'category': 'Deportes', 'stock': 6, 'user_id': 3},
            
            # Libros y Educación
            {'name': 'Kindle Paperwhite 11ª Gen', 'description': 'E-reader con pantalla de 6.8"', 'price': 149.99, 'category': 'Libros', 'stock': 30, 'user_id': 1},
            {'name': 'Set Libros "Clean Code"', 'description': 'Colección de libros de programación', 'price': 89.99, 'category': 'Libros', 'stock': 20, 'user_id': 2},
            {'name': 'Tablet reMarkable 2', 'description': 'Tablet para escritura digital', 'price': 399.99, 'category': 'Oficina', 'stock': 8, 'user_id': 3},
            
            # Moda y Accesorios
            {'name': 'Gafas de Sol Ray-Ban Aviator', 'description': 'Gafas clásicas con protección UV', 'price': 179.99, 'category': 'Moda', 'stock': 15, 'user_id': 4},
            {'name': 'Mochila Peak Design Everyday', 'description': 'Mochila para equipos fotográficos', 'price': 259.99, 'category': 'Moda', 'stock': 10, 'user_id': 1},
            {'name': 'Reloj Casio G-Shock GA-2100', 'description': 'Reloj resistente y elegante', 'price': 109.99, 'category': 'Moda', 'stock': 20, 'user_id': 2},
            
            # Herramientas y Hardware
            {'name': 'Destornillador iFixit Pro Tech', 'description': 'Kit de herramientas para reparación', 'price': 69.99, 'category': 'Herramientas', 'stock': 15, 'user_id': 3},
            {'name': 'Taladro Bosch GSR 18V', 'description': 'Taladro inalámbrico profesional', 'price': 149.99, 'category': 'Herramientas', 'stock': 8, 'user_id': 4},
            {'name': 'Multímetro Fluke 117', 'description': 'Multímetro digital profesional', 'price': 249.99, 'category': 'Herramientas', 'stock': 6, 'user_id': 1},
            
            # Cocina y Hogar
            {'name': 'Cafetera Nespresso Vertuo Next', 'description': 'Cafetera de cápsulas premium', 'price': 199.99, 'category': 'Cocina', 'stock': 12, 'user_id': 2},
            {'name': 'Air Fryer Ninja Foodi', 'description': 'Freidora de aire multifunción', 'price': 129.99, 'category': 'Cocina', 'stock': 10, 'user_id': 3},
            {'name': 'Procesador KitchenAid Artisan', 'description': 'Robot de cocina profesional', 'price': 449.99, 'category': 'Cocina', 'stock': 5, 'user_id': 4},
            
            # Salud y Bienestar
            {'name': 'Báscula Inteligente Withings Body+', 'description': 'Báscula con análisis corporal', 'price': 99.99, 'category': 'Salud', 'stock': 15, 'user_id': 1},
            {'name': 'Purificador Aire Dyson Pure Cool', 'description': 'Purificador y ventilador 2 en 1', 'price': 549.99, 'category': 'Salud', 'stock': 6, 'user_id': 2},
            {'name': 'Humidificador Levoit LV600HH', 'description': 'Humidificador ultrasónico inteligente', 'price': 89.99, 'category': 'Salud', 'stock': 12, 'user_id': 3},
            
            # Automóvil
            {'name': 'Dash Cam 70mai A500S', 'description': 'Cámara para coche con GPS', 'price': 149.99, 'category': 'Automóvil', 'stock': 10, 'user_id': 4},
            {'name': 'Cargador Tesla Wall Connector', 'description': 'Cargador doméstico para vehículos eléctricos', 'price': 475.99, 'category': 'Automóvil', 'stock': 4, 'user_id': 1},
            {'name': 'Aspiradora Coche Black+Decker', 'description': 'Aspiradora portátil 12V', 'price': 39.99, 'category': 'Automóvil', 'stock': 20, 'user_id': 2}
        ]
        
        # Verificar items existentes
        cursor.execute("SELECT COUNT(*) FROM items")
        items_existentes = cursor.fetchone()[0]
        print(f"📦 Items existentes: {items_existentes}")
        
        # Insertar items adicionales
        print("📦 Insertando items adicionales...")
        items_insertados = 0
        
        for item in items_adicionales:
            created_date = (datetime.now() - timedelta(days=random.randint(1, 60))).isoformat()
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
            
            items_insertados += 1
            # Obtener el nombre del usuario
            user_name = next(nombre for user_id, nombre in usuarios if user_id == item['user_id'])
            print(f"   ✓ Item {items_existentes + items_insertados}: {item['name']} → {user_name}")
        
        # Confirmar cambios
        conn.commit()
        
        # Mostrar estadísticas finales
        print("\n📊 Estadísticas después de la migración:")
        
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"   👥 Usuarios total: {user_count}")
        
        cursor.execute("SELECT COUNT(*) FROM items")
        item_count = cursor.fetchone()[0]
        print(f"   📦 Items total: {item_count}")
        print(f"   📦 Items agregados: {items_insertados}")
        
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
        
        cursor.execute("SELECT category, COUNT(*) FROM items GROUP BY category ORDER BY COUNT(*) DESC")
        categories = cursor.fetchall()
        print("   🏷️  Items por categoría:")
        for category, count in categories:
            print(f"      • {category}: {count} items")
        
        cursor.execute("SELECT SUM(stock) FROM items")
        total_stock = cursor.fetchone()[0]
        print(f"   📊 Stock total: {total_stock} unidades")
        
        cursor.execute("SELECT SUM(price * stock) FROM items")
        total_value = cursor.fetchone()[0]
        print(f"   💰 Valor total inventario: €{total_value:,.2f}")
        
        cursor.execute("SELECT AVG(price) FROM items")
        avg_price = cursor.fetchone()[0]
        print(f"   💰 Precio promedio: €{avg_price:.2f}")
        
        cursor.execute("SELECT MIN(price), MAX(price) FROM items")
        min_price, max_price = cursor.fetchone()
        print(f"   💰 Rango precios: €{min_price:.2f} - €{max_price:,.2f}")
        
        print(f"\n✅ Migración 003 completada exitosamente!")
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
