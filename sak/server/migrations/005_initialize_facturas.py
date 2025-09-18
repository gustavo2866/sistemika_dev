#!/usr/bin/env python3
"""
Migración 005: Inicializar facturas con datos íntegros
"""
import sqlite3
import os
from datetime import datetime

def run_migration():
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
        print("🧹 Limpiando facturas existentes...")
        cursor.execute("DELETE FROM facturas")
        
        print("👥 Verificando usuarios...")
        cursor.execute("SELECT id, nombre FROM users LIMIT 5")
        users = cursor.fetchall()
        if not users:
            print("❌ No hay usuarios disponibles")
            return False
        
        print("🏢 Verificando proveedores...")
        cursor.execute("SELECT id, nombre FROM proveedores LIMIT 5") 
        proveedores = cursor.fetchall()
        if not proveedores:
            print("❌ No hay proveedores disponibles")
            return False
            
        print("📋 Verificando tipos de operación...")
        cursor.execute("SELECT id, descripcion FROM tipos_operacion LIMIT 5")
        tipos_operacion = cursor.fetchall()
        if not tipos_operacion:
            print("❌ No hay tipos de operación disponibles")
            return False
        
        print("📄 Insertando facturas de prueba...")
        
        # Usar el primer usuario, proveedor y tipo de operación disponibles
        user_id = users[0][0]
        proveedor_id = proveedores[0][0]
        tipo_operacion_id = tipos_operacion[0][0]
        
        # Facturas de prueba con datos íntegros
        facturas = [
            {
                'numero': '0001-00000001',
                'punto_venta': '0001', 
                'tipo_comprobante': 'A',
                'fecha_emision': '2025-09-01',
                'fecha_vencimiento': '2025-10-01',
                'subtotal': 10000.00,
                'total_impuestos': 2100.00,
                'total': 12100.00,
                'estado': 'pendiente',
                'observaciones': 'Factura de prueba 1',
                'proveedor_id': proveedor_id,
                'tipo_operacion_id': tipo_operacion_id,
                'usuario_responsable_id': user_id,
                'extraido_por_ocr': 0,
                'extraido_por_llm': 0
            },
            {
                'numero': '0001-00000002',
                'punto_venta': '0001',
                'tipo_comprobante': 'B', 
                'fecha_emision': '2025-09-02',
                'fecha_vencimiento': '2025-10-02',
                'subtotal': 5000.00,
                'total_impuestos': 1050.00,
                'total': 6050.00,
                'estado': 'procesada',
                'observaciones': 'Factura de prueba 2',
                'proveedor_id': proveedor_id,
                'tipo_operacion_id': tipo_operacion_id,
                'usuario_responsable_id': user_id,
                'extraido_por_ocr': 1,
                'extraido_por_llm': 0,
                'confianza_extraccion': 0.95
            },
            {
                'numero': '0002-00000001',
                'punto_venta': '0002',
                'tipo_comprobante': 'A',
                'fecha_emision': '2025-09-03', 
                'fecha_vencimiento': '2025-10-03',
                'subtotal': 15000.00,
                'total_impuestos': 3150.00,
                'total': 18150.00,
                'estado': 'aprobada',
                'observaciones': 'Factura de prueba 3 - Aprobada',
                'proveedor_id': proveedor_id,
                'tipo_operacion_id': tipo_operacion_id,
                'usuario_responsable_id': user_id,
                'extraido_por_ocr': 0,
                'extraido_por_llm': 1,
                'confianza_extraccion': 0.88
            },
            {
                'numero': '0002-00000002',
                'punto_venta': '0002',
                'tipo_comprobante': 'C',
                'fecha_emision': '2025-09-04',
                'fecha_vencimiento': '2025-10-04', 
                'subtotal': 8000.00,
                'total_impuestos': 1680.00,
                'total': 9680.00,
                'estado': 'rechazada',
                'observaciones': 'Factura de prueba 4 - Rechazada',
                'proveedor_id': proveedor_id,
                'tipo_operacion_id': tipo_operacion_id,
                'usuario_responsable_id': user_id,
                'extraido_por_ocr': 1,
                'extraido_por_llm': 1,
                'confianza_extraccion': 0.92
            },
            {
                'numero': '0003-00000001',
                'punto_venta': '0003',
                'tipo_comprobante': 'A',
                'fecha_emision': '2025-09-05',
                'fecha_vencimiento': '2025-11-05',
                'subtotal': 25000.00,
                'total_impuestos': 5250.00,
                'total': 30250.00,
                'estado': 'pagada',
                'observaciones': 'Factura de prueba 5 - Pagada',
                'proveedor_id': proveedor_id,
                'tipo_operacion_id': tipo_operacion_id,
                'usuario_responsable_id': user_id,
                'nombre_archivo_pdf': 'factura_0003_00000001.pdf',
                'ruta_archivo_pdf': 'facturas/2025/09/factura_0003_00000001.pdf',
                'extraido_por_ocr': 1,
                'extraido_por_llm': 0,
                'confianza_extraccion': 0.97
            }
        ]
        
        # Insertar facturas
        for i, factura in enumerate(facturas, 1):
            columns = ', '.join(factura.keys())
            placeholders = ', '.join(['?' for _ in factura])
            
            sql = f"""
            INSERT INTO facturas (
                created_at, updated_at, version, {columns}
            ) VALUES (?, ?, ?, {placeholders})
            """
            
            now = datetime.now().isoformat()
            values = [now, now, 1] + list(factura.values())
            
            cursor.execute(sql, values)
            print(f"  ✅ Factura {i}: {factura['numero']} insertada")
        
        conn.commit()
        
        # Verificación final
        cursor.execute("SELECT COUNT(*) FROM facturas")
        count = cursor.fetchone()[0]
        print(f"\n🎉 ¡Migración completada exitosamente!")
        print(f"📊 Total facturas creadas: {count}")
        
        # Mostrar algunas facturas como verificación
        cursor.execute("""
            SELECT f.numero, u.nombre as usuario, p.nombre as proveedor, f.estado 
            FROM facturas f
            JOIN users u ON f.usuario_responsable_id = u.id
            JOIN proveedores p ON f.proveedor_id = p.id
            LIMIT 5
        """)
        
        print("\n📋 Facturas creadas:")
        for row in cursor.fetchall():
            print(f"  - {row[0]} | Usuario: {row[1]} | Proveedor: {row[2]} | Estado: {row[3]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Ejecutando migración 005: Inicializar facturas")
    success = run_migration()
    
    if success:
        print("\n✅ ¡Migración completada! Las facturas están listas para usar.")
        print("🔗 Puedes probar ahora el frontend sin errores de integridad.")
    else:
        print("\n❌ La migración falló. Revisa los errores anteriores.")
