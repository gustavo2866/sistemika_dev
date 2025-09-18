#!/usr/bin/env python3
"""
Script para inicializar la tabla facturas con datos de prueba íntegros
"""
import sys
import os
sys.path.append('.')

from app.database import engine
from sqlmodel import Session, select, text
from app.models.factura import Factura
from app.models.user import User
from app.models.proveedor import Proveedor
from app.models.tipo_operacion import TipoOperacion
from decimal import Decimal
from datetime import datetime, date

def initialize_facturas():
    """Inicializa la tabla facturas con datos de prueba íntegros"""
    
    with Session(engine) as session:
        print("🧹 Limpiando tabla facturas...")
        
        # Eliminar todas las facturas existentes
        session.exec(text("DELETE FROM facturas"))
        session.commit()
        
        print("👥 Verificando usuarios disponibles...")
        users = session.exec(select(User)).all()
        if not users:
            print("❌ No hay usuarios en la base de datos")
            return False
            
        for user in users:
            print(f"  - {user.id}: {user.nombre}")
        
        print("🏢 Verificando proveedores disponibles...")
        proveedores = session.exec(select(Proveedor)).all()
        if not proveedores:
            print("❌ No hay proveedores en la base de datos")
            return False
            
        for proveedor in proveedores:
            print(f"  - {proveedor.id}: {proveedor.nombre}")
        
        print("📋 Verificando tipos de operación disponibles...")
        tipos_operacion = session.exec(select(TipoOperacion)).all()
        if not tipos_operacion:
            print("❌ No hay tipos de operación en la base de datos")
            return False
            
        for tipo in tipos_operacion:
            print(f"  - {tipo.id}: {tipo.descripcion}")
        
        print("📄 Creando facturas de prueba...")
        
        # Crear facturas de prueba con datos íntegros
        facturas_prueba = [
            {
                "numero": "0001-00000001",
                "punto_venta": "0001",
                "tipo_comprobante": "A",
                "fecha_emision": "2025-09-01",
                "fecha_vencimiento": "2025-10-01",
                "subtotal": Decimal("10000.00"),
                "total_impuestos": Decimal("2100.00"),
                "total": Decimal("12100.00"),
                "estado": "pendiente",
                "observaciones": "Factura de prueba 1",
                "proveedor_id": proveedores[0].id,
                "tipo_operacion_id": tipos_operacion[0].id,
                "usuario_responsable_id": users[0].id,
                "extraido_por_ocr": False,
                "extraido_por_llm": False
            },
            {
                "numero": "0001-00000002",
                "punto_venta": "0001",
                "tipo_comprobante": "B",
                "fecha_emision": "2025-09-02",
                "fecha_vencimiento": "2025-10-02",
                "subtotal": Decimal("5000.00"),
                "total_impuestos": Decimal("1050.00"),
                "total": Decimal("6050.00"),
                "estado": "procesada",
                "observaciones": "Factura de prueba 2",
                "proveedor_id": proveedores[min(1, len(proveedores)-1)].id,
                "tipo_operacion_id": tipos_operacion[min(1, len(tipos_operacion)-1)].id,
                "usuario_responsable_id": users[min(1, len(users)-1)].id,
                "extraido_por_ocr": True,
                "extraido_por_llm": False,
                "confianza_extraccion": 0.95
            },
            {
                "numero": "0002-00000001",
                "punto_venta": "0002",
                "tipo_comprobante": "A",
                "fecha_emision": "2025-09-03",
                "fecha_vencimiento": "2025-10-03",
                "subtotal": Decimal("15000.00"),
                "total_impuestos": Decimal("3150.00"),
                "total": Decimal("18150.00"),
                "estado": "aprobada",
                "observaciones": "Factura de prueba 3 - Aprobada",
                "proveedor_id": proveedores[0].id,
                "tipo_operacion_id": tipos_operacion[0].id,
                "usuario_responsable_id": users[min(2, len(users)-1)].id,
                "extraido_por_ocr": False,
                "extraido_por_llm": True,
                "confianza_extraccion": 0.88
            },
            {
                "numero": "0002-00000002",
                "punto_venta": "0002",
                "tipo_comprobante": "C",
                "fecha_emision": "2025-09-04",
                "fecha_vencimiento": "2025-10-04",
                "subtotal": Decimal("8000.00"),
                "total_impuestos": Decimal("1680.00"),
                "total": Decimal("9680.00"),
                "estado": "rechazada",
                "observaciones": "Factura de prueba 4 - Rechazada por revisión",
                "proveedor_id": proveedores[min(1, len(proveedores)-1)].id,
                "tipo_operacion_id": tipos_operacion[min(1, len(tipos_operacion)-1)].id,
                "usuario_responsable_id": users[min(3, len(users)-1)].id,
                "extraido_por_ocr": True,
                "extraido_por_llm": True,
                "confianza_extraccion": 0.92
            },
            {
                "numero": "0003-00000001",
                "punto_venta": "0003",
                "tipo_comprobante": "A",
                "fecha_emision": "2025-09-05",
                "fecha_vencimiento": "2025-11-05",
                "subtotal": Decimal("25000.00"),
                "total_impuestos": Decimal("5250.00"),
                "total": Decimal("30250.00"),
                "estado": "pagada",
                "observaciones": "Factura de prueba 5 - Ya pagada",
                "proveedor_id": proveedores[0].id,
                "tipo_operacion_id": tipos_operacion[0].id,
                "usuario_responsable_id": users[0].id,
                "nombre_archivo_pdf": "factura_0003_00000001.pdf",
                "ruta_archivo_pdf": "facturas/2025/09/factura_0003_00000001.pdf",
                "extraido_por_ocr": True,
                "extraido_por_llm": False,
                "confianza_extraccion": 0.97
            }
        ]
        
        for i, factura_data in enumerate(facturas_prueba, 1):
            try:
                factura = Factura(**factura_data)
                session.add(factura)
                session.commit()
                session.refresh(factura)
                print(f"  ✅ Factura {i} creada: ID {factura.id}, Número {factura.numero}")
            except Exception as e:
                print(f"  ❌ Error creando factura {i}: {e}")
                session.rollback()
                return False
        
        print("\n🎉 Facturas inicializadas correctamente!")
        
        # Verificación final
        facturas_count = session.exec(select(Factura)).all()
        print(f"📊 Total de facturas en la base de datos: {len(facturas_count)}")
        
        return True

if __name__ == "__main__":
    print("🚀 Inicializando tabla facturas...")
    success = initialize_facturas()
    
    if success:
        print("✅ Inicialización completada exitosamente")
        print("🔗 Ahora puedes probar el frontend sin errores de integridad")
    else:
        print("❌ Error durante la inicialización")
        sys.exit(1)
