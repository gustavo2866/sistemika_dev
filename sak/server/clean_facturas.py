#!/usr/bin/env python3
"""
Script para limpiar todas las tablas relacionadas con facturas
"""
import sqlite3
import os

def clean_all_related_tables():
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
        # Verificar qué tablas existen
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"📋 Tablas disponibles: {tables}")
        
        # Limpiar facturas
        if 'facturas' in tables:
            cursor.execute("SELECT COUNT(*) FROM facturas")
            count_before = cursor.fetchone()[0]
            print(f"📊 Facturas antes del limpiado: {count_before}")
            
            print("🧹 Limpiando tabla facturas...")
            cursor.execute("DELETE FROM facturas")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='facturas'")
            print("✅ Facturas limpiadas")
        
        # Limpiar proveedores 
        if 'proveedores' in tables:
            cursor.execute("SELECT COUNT(*) FROM proveedores")
            count_prov = cursor.fetchone()[0]
            print(f"📊 Proveedores existentes: {count_prov}")
            
            if count_prov > 0:
                print("🧹 Limpiando tabla proveedores...")
                cursor.execute("DELETE FROM proveedores")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='proveedores'")
                print("✅ Proveedores limpiados")
        
        # Limpiar tipos de operación
        if 'tipos_operacion' in tables:
            cursor.execute("SELECT COUNT(*) FROM tipos_operacion")
            count_tipos = cursor.fetchone()[0]
            print(f"📊 Tipos de operación existentes: {count_tipos}")
            
            if count_tipos > 0:
                print("🧹 Limpiando tabla tipos_operacion...")
                cursor.execute("DELETE FROM tipos_operacion")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='tipos_operacion'")
                print("✅ Tipos de operación limpiados")
        
        # Crear datos mínimos básicos
        print("🔧 Creando datos básicos necesarios...")
        
        # Crear un proveedor básico
        cursor.execute("""
            INSERT INTO proveedores (created_at, updated_at, version, nombre, razon_social, cuit, email, telefono) 
            VALUES (datetime('now'), datetime('now'), 1, 'Proveedor Test', 'Proveedor Test S.A.', '20-12345678-9', 'test@proveedor.com', '1234567890')
        """)
        proveedor_id = cursor.lastrowid
        print(f"✅ Proveedor test creado con ID: {proveedor_id}")
        
        # Crear un tipo de operación básico
        cursor.execute("""
            INSERT INTO tipos_operacion (created_at, updated_at, version, descripcion) 
            VALUES (datetime('now'), datetime('now'), 1, 'Gastos Generales')
        """)
        tipo_op_id = cursor.lastrowid
        print(f"✅ Tipo operación test creado con ID: {tipo_op_id}")
        
        conn.commit()
        
        print("\n🎉 ¡Limpiado completado exitosamente!")
        print("🆕 Tablas limpias con datos básicos necesarios")
        print("🔗 Ahora puedes crear facturas desde el frontend")
        
        return True
        
    except Exception as e:
        print(f"❌ Error durante el limpiado: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Limpiando todas las tablas relacionadas...")
    success = clean_all_related_tables()
    
    if success:
        print("\n✅ ¡Limpiado completado!")
        print("🔗 Todas las tablas están limpias y listas para nuevos registros")
    else:
        print("\n❌ El limpiado falló")
