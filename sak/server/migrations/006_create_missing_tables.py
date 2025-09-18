#!/usr/bin/env python3
"""
Migración 006: Crear tablas faltantes (proveedores, tipos_operacion, facturas)
"""
import sqlite3
import os
from datetime import datetime

def create_missing_tables():
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
        # Verificar qué tablas ya existen
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = [row[0] for row in cursor.fetchall()]
        print(f"📋 Tablas existentes: {existing_tables}")
        
        # Crear tabla tipos_operacion
        if 'tipos_operacion' not in existing_tables:
            print("🏗️  Creando tabla tipos_operacion...")
            cursor.execute("""
                CREATE TABLE tipos_operacion (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    deleted_at DATETIME NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    descripcion VARCHAR(255) NOT NULL,
                    activo BOOLEAN NOT NULL DEFAULT 1
                )
            """)
            
            # Insertar tipos básicos
            cursor.execute("""
                INSERT INTO tipos_operacion (descripcion, activo)
                VALUES ('Gastos Generales', 1)
            """)
            cursor.execute("""
                INSERT INTO tipos_operacion (descripcion, activo)
                VALUES ('Servicios', 1)
            """)
            cursor.execute("""
                INSERT INTO tipos_operacion (descripcion, activo)
                VALUES ('Compras', 1)
            """)
            print("✅ Tabla tipos_operacion creada con datos iniciales")
        else:
            print("⏭️  Tabla tipos_operacion ya existe")
        
        # Crear tabla proveedores
        if 'proveedores' not in existing_tables:
            print("🏗️  Creando tabla proveedores...")
            cursor.execute("""
                CREATE TABLE proveedores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    deleted_at DATETIME NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    nombre VARCHAR(255) NOT NULL,
                    razon_social VARCHAR(255) NOT NULL,
                    cuit VARCHAR(15) NOT NULL UNIQUE,
                    telefono VARCHAR(20) NULL,
                    email VARCHAR(255) NULL,
                    direccion VARCHAR(500) NULL,
                    cbu VARCHAR(22) NULL,
                    alias_bancario VARCHAR(100) NULL,
                    activo BOOLEAN NOT NULL DEFAULT 1
                )
            """)
            
            # Insertar proveedor básico
            cursor.execute("""
                INSERT INTO proveedores (nombre, razon_social, cuit, email, activo)
                VALUES ('Proveedor Test', 'Proveedor Test S.A.', '20-12345678-9', 'test@proveedor.com', 1)
            """)
            print("✅ Tabla proveedores creada con datos iniciales")
        else:
            print("⏭️  Tabla proveedores ya existe")
        
        # Crear tabla facturas
        if 'facturas' not in existing_tables:
            print("🏗️  Creando tabla facturas...")
            cursor.execute("""
                CREATE TABLE facturas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    deleted_at DATETIME NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    numero VARCHAR(50) NOT NULL,
                    punto_venta VARCHAR(10) NOT NULL,
                    tipo_comprobante VARCHAR(20) NOT NULL,
                    fecha_emision VARCHAR(10) NOT NULL,
                    fecha_vencimiento VARCHAR(10) NULL,
                    fecha_recepcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    subtotal DECIMAL(15,2) NOT NULL,
                    total_impuestos DECIMAL(15,2) NOT NULL,
                    total DECIMAL(15,2) NOT NULL,
                    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                    observaciones TEXT NULL,
                    nombre_archivo_pdf VARCHAR(500) NULL,
                    ruta_archivo_pdf VARCHAR(1000) NULL,
                    extraido_por_ocr BOOLEAN NOT NULL DEFAULT 0,
                    extraido_por_llm BOOLEAN NOT NULL DEFAULT 0,
                    confianza_extraccion REAL NULL,
                    proveedor_id INTEGER NOT NULL,
                    tipo_operacion_id INTEGER NOT NULL,
                    usuario_responsable_id INTEGER NOT NULL,
                    FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
                    FOREIGN KEY (tipo_operacion_id) REFERENCES tipos_operacion (id),
                    FOREIGN KEY (usuario_responsable_id) REFERENCES users (id)
                )
            """)
            print("✅ Tabla facturas creada")
        else:
            print("⏭️  Tabla facturas ya existe")
        
        conn.commit()
        
        # Verificación final
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        final_tables = [row[0] for row in cursor.fetchall()]
        print(f"\n📊 Tablas después de la migración: {final_tables}")
        
        # Verificar datos
        if 'tipos_operacion' in final_tables:
            cursor.execute("SELECT COUNT(*) FROM tipos_operacion")
            count_tipos = cursor.fetchone()[0]
            print(f"📋 Tipos de operación: {count_tipos}")
        
        if 'proveedores' in final_tables:
            cursor.execute("SELECT COUNT(*) FROM proveedores")
            count_prov = cursor.fetchone()[0]
            print(f"🏢 Proveedores: {count_prov}")
        
        if 'facturas' in final_tables:
            cursor.execute("SELECT COUNT(*) FROM facturas")
            count_fact = cursor.fetchone()[0]
            print(f"📄 Facturas: {count_fact}")
        
        print("\n🎉 ¡Migración completada exitosamente!")
        return True
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Ejecutando migración 006: Crear tablas faltantes")
    success = create_missing_tables()
    
    if success:
        print("\n✅ ¡Migración completada! Todas las tablas están creadas.")
        print("🔗 Ahora el backend debería funcionar correctamente.")
    else:
        print("\n❌ La migración falló. Revisa los errores anteriores.")
