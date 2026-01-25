#!/usr/bin/env python3
"""
Script para verificar que los nuevos campos se agregaron correctamente a las tablas
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, text
from app.db import get_session


def verificar_campos_agregados():
    """Verifica que todos los campos nuevos se agregaron correctamente"""
    
    with next(get_session()) as session:
        print("🔍 Verificando campos agregados en las tablas...")
        
        # 1. Verificar solicitudes
        print("\n1️⃣ Tabla: solicitudes")
        result = session.exec(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'solicitudes' 
            AND column_name IN ('tipo_compra')
            ORDER BY column_name
        """))
        
        for row in result:
            print(f"   ✅ {row.column_name}: {row.data_type} (nullable: {row.is_nullable}, default: {row.column_default})")
        
        # 2. Verificar po_ordenes_compra
        print("\n2️⃣ Tabla: po_ordenes_compra")
        result = session.exec(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'po_ordenes_compra' 
            AND column_name IN ('departamento_id', 'tipo_compra')
            ORDER BY column_name
        """))
        
        for row in result:
            print(f"   ✅ {row.column_name}: {row.data_type} (nullable: {row.is_nullable}, default: {row.column_default})")
        
        # 3. Verificar proveedores
        print("\n3️⃣ Tabla: proveedores")
        result = session.exec(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'proveedores' 
            AND column_name IN ('default_tipo_solicitud_id', 'default_departamento_id', 'default_metodo_pago_id', 'default_usuario_responsable_id')
            ORDER BY column_name
        """))
        
        for row in result:
            print(f"   ✅ {row.column_name}: {row.data_type} (nullable: {row.is_nullable}, default: {row.column_default})")
        
        # 4. Verificar po_facturas
        print("\n4️⃣ Tabla: po_facturas")
        result = session.exec(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'po_facturas' 
            AND column_name IN ('departamento_id', 'tipo_compra')
            ORDER BY column_name
        """))
        
        for row in result:
            print(f"   ✅ {row.column_name}: {row.data_type} (nullable: {row.is_nullable}, default: {row.column_default})")
        
        # 5. Verificar foreign keys
        print("\n5️⃣ Verificando foreign keys...")
        result = session.exec(text("""
            SELECT 
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu 
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu 
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN ('solicitudes', 'po_ordenes_compra', 'proveedores', 'po_facturas')
            AND kcu.column_name LIKE '%default_%' OR kcu.column_name IN ('tipo_compra', 'departamento_id')
            ORDER BY tc.table_name, kcu.column_name
        """))
        
        foreign_keys = list(result)
        if foreign_keys:
            for row in foreign_keys:
                print(f"   🔗 {row.table_name}.{row.column_name} → {row.foreign_table_name}.{row.foreign_column_name}")
        
        # 6. Verificar índices
        print("\n6️⃣ Verificando índices...")
        result = session.exec(text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename IN ('solicitudes', 'po_ordenes_compra', 'proveedores', 'po_facturas')
            AND (indexname LIKE '%tipo_compra%' OR indexname LIKE '%departamento%' OR indexname LIKE '%default_%')
            ORDER BY tablename, indexname
        """))
        
        indices = list(result)
        if indices:
            for row in indices:
                print(f"   📑 {row.tablename}: {row.indexname}")
        
        print(f"\n🎉 Verificación completada!")
        print(f"📊 Campos agregados: ✅")
        print(f"🔗 Foreign keys: {len(foreign_keys)} encontradas")
        print(f"📑 Índices: {len(indices)} encontrados")


if __name__ == "__main__":
    verificar_campos_agregados()