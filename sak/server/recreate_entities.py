#!/usr/bin/env python3
"""
Script para eliminar y recrear completamente las entidades proveedores, tipos_operacion y facturas
"""
import sqlite3
import os
from datetime import datetime

def recreate_entities():
    # Buscar la base de datos
    db_path = None
    possible_paths = [
        'invoice_system.db',
        'data/invoice_system.db', 
        'app/invoice_system.db'
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ No se encontró la base de datos")
        return False
    
    print(f"📂 Usando base de datos: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Deshabilitar foreign keys temporalmente
        cursor.execute("PRAGMA foreign_keys = OFF")
        
        print("🗑️ Eliminando tablas existentes...")
        
        # Eliminar tablas en orden correcto (dependencias)
        tables_to_drop = ['facturas', 'proveedores', 'tipos_operacion']
        for table in tables_to_drop:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
            print(f"✅ Tabla {table} eliminada")
        
        # Limpiar secuencias
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('facturas', 'proveedores', 'tipos_operacion')")
        
        print("\n🔨 Creando tabla tipos_operacion...")
        cursor.execute("""
            CREATE TABLE tipos_operacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME,
                version INTEGER NOT NULL DEFAULT 1,
                descripcion VARCHAR(255) NOT NULL
            )
        """)
        print("✅ Tabla tipos_operacion creada")
        
        print("\n🔨 Creando tabla proveedores...")
        cursor.execute("""
            CREATE TABLE proveedores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME,
                version INTEGER NOT NULL DEFAULT 1,
                nombre VARCHAR(255) NOT NULL,
                razon_social VARCHAR(255) NOT NULL,
                cuit VARCHAR(15) NOT NULL,
                telefono VARCHAR(20),
                email VARCHAR(255),
                direccion VARCHAR(500),
                cbu VARCHAR(22),
                alias_bancario VARCHAR(100)
            )
        """)
        print("✅ Tabla proveedores creada")
        
        print("\n🔨 Creando tabla facturas...")
        cursor.execute("""
            CREATE TABLE facturas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME,
                version INTEGER NOT NULL DEFAULT 1,
                numero VARCHAR(50) NOT NULL,
                punto_venta VARCHAR(10) NOT NULL,
                tipo_comprobante VARCHAR(20) NOT NULL,
                fecha_emision DATE NOT NULL,
                fecha_vencimiento DATE,
                subtotal DECIMAL(10,2) NOT NULL,
                total_impuestos DECIMAL(10,2) NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                observaciones TEXT,
                proveedor_id INTEGER NOT NULL,
                tipo_operacion_id INTEGER NOT NULL,
                usuario_responsable_id INTEGER,
                pdf_path VARCHAR(500),
                FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
                FOREIGN KEY (tipo_operacion_id) REFERENCES tipos_operacion(id)
            )
        """)
        print("✅ Tabla facturas creada")
        
        # Rehabilitar foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        print("\n🌱 Insertando datos iniciales...")
        
        # Insertar tipos de operación básicos
        tipos_operacion = [
            ('Gastos Generales',),
            ('Servicios Profesionales',),
            ('Suministros y Materiales',),
            ('Mantenimiento y Reparaciones',),
            ('Viajes y Hospedaje',)
        ]
        
        cursor.executemany("""
            INSERT INTO tipos_operacion (descripcion, created_at, updated_at, version) 
            VALUES (?, datetime('now'), datetime('now'), 1)
        """, tipos_operacion)
        print(f"✅ {len(tipos_operacion)} tipos de operación insertados")
        
        # Insertar proveedores de ejemplo
        proveedores = [
            ('Proveedor Ejemplo 1', 'Proveedor Ejemplo 1 S.A.', '20-12345678-9', '1111-234567', 'ejemplo1@proveedor.com', 'Av. Ejemplo 123', '1234567890123456789012', 'EJEMPLO1.ALIAS'),
            ('Proveedor Ejemplo 2', 'Proveedor Ejemplo 2 S.R.L.', '20-87654321-9', '1111-765432', 'ejemplo2@proveedor.com', 'Calle Ejemplo 456', '2234567890123456789012', 'EJEMPLO2.ALIAS'),
            ('Proveedor Ejemplo 3', 'Proveedor Ejemplo 3 S.A.', '20-11223344-5', '1111-112233', 'ejemplo3@proveedor.com', 'Pasaje Ejemplo 789', '3234567890123456789012', 'EJEMPLO3.ALIAS')
        ]
        
        cursor.executemany("""
            INSERT INTO proveedores (nombre, razon_social, cuit, telefono, email, direccion, cbu, alias_bancario, created_at, updated_at, version) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 1)
        """, proveedores)
        print(f"✅ {len(proveedores)} proveedores insertados")
        
        conn.commit()
        
        print("\n🎉 ¡Recreación completada exitosamente!")
        print("🆕 Todas las entidades han sido recreadas con estructura limpia")
        print("📊 Datos iniciales insertados correctamente")
        print("🔗 Sistema listo para funcionar")
        
        # Verificar que todo esté correcto
        cursor.execute("SELECT COUNT(*) FROM tipos_operacion")
        count_tipos = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM proveedores")
        count_prov = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM facturas")
        count_fact = cursor.fetchone()[0]
        
        print(f"\n📈 Resumen final:")
        print(f"   📋 Tipos de operación: {count_tipos}")
        print(f"   🏢 Proveedores: {count_prov}")
        print(f"   📄 Facturas: {count_fact}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error durante la recreación: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Recreando entidades completas...")
    success = recreate_entities()
    
    if success:
        print("\n✅ ¡Recreación completada exitosamente!")
        print("🔗 Todas las entidades están limpias y listas")
    else:
        print("\n❌ La recreación falló")
