#!/usr/bin/env python3
"""
Script para verificar que el campo default_articulos_id se agregó correctamente a proveedores
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, text
from app.db import get_session


def verificar_default_articulos_campo():
    """Verifica que el campo default_articulos_id existe en la tabla proveedores"""
    
    with next(get_session()) as session:
        print("🔍 Verificando campo default_articulos_id en tabla proveedores...")
        
        # 1. Verificar que la columna existe
        try:
            stmt = text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'proveedores' 
                AND column_name = 'default_articulos_id'
            """)
            
            result = session.exec(stmt).first()
            
            if result:
                print(f"✅ Campo 'default_articulos_id' encontrado:")
                print(f"   📝 Tipo de dato: {result.data_type}")
                print(f"   🔄 Permite NULL: {result.is_nullable}")
            else:
                print(f"❌ Campo 'default_articulos_id' NO encontrado en la tabla")
                return False
        
        except Exception as e:
            print(f"❌ Error al verificar la columna: {str(e)}")
            return False
        
        # 2. Verificar foreign key
        try:
            stmt_fk = text("""
                SELECT 
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_name = 'proveedores'
                AND kcu.column_name = 'default_articulos_id'
            """)
            
            fk_result = session.exec(stmt_fk).first()
            
            if fk_result:
                print(f"✅ Foreign key encontrada:")
                print(f"   📝 Constraint: {fk_result.constraint_name}")
                print(f"   🔗 Referencia: {fk_result.foreign_table_name}.{fk_result.foreign_column_name}")
            else:
                print(f"⚠️  Foreign key no encontrada para default_articulos_id")
        
        except Exception as e:
            print(f"⚠️  Error al verificar foreign key: {str(e)}")
        
        # 3. Verificar índice
        try:
            stmt_idx = text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'proveedores'
                AND indexname LIKE '%default_articulos_id%'
            """)
            
            idx_results = session.exec(stmt_idx).all()
            
            if idx_results:
                print(f"✅ Índices encontrados:")
                for idx in idx_results:
                    print(f"   📚 {idx.indexname}")
            else:
                print(f"⚠️  No se encontraron índices para default_articulos_id")
        
        except Exception as e:
            print(f"⚠️  Error al verificar índices: {str(e)}")
        
        # 4. Verificar estado actual de proveedores
        try:
            stmt_count = text("""
                SELECT 
                    COUNT(*) as total_proveedores,
                    COUNT(default_articulos_id) as con_default_articulos,
                    COUNT(*) - COUNT(default_articulos_id) as sin_default_articulos
                FROM proveedores
            """)
            
            count_result = session.exec(stmt_count).first()
            
            print(f"\n📊 Estado actual de proveedores:")
            print(f"   🔢 Total proveedores: {count_result.total_proveedores}")
            print(f"   ✅ Con default_articulos_id: {count_result.con_default_articulos}")
            print(f"   ❓ Sin default_articulos_id (NULL): {count_result.sin_default_articulos}")
            
            # Mostrar algunos ejemplos
            if count_result.total_proveedores > 0:
                stmt_ejemplos = text("""
                    SELECT id, nombre, default_articulos_id
                    FROM proveedores
                    ORDER BY id
                    LIMIT 5
                """)
                
                ejemplos = session.exec(stmt_ejemplos).all()
                print(f"\n📝 Primeros 5 proveedores:")
                for ejemplo in ejemplos:
                    articulo_status = f"Artículo ID: {ejemplo.default_articulos_id}" if ejemplo.default_articulos_id else "Sin artículo default"
                    print(f"   • ID {ejemplo.id}: {ejemplo.nombre[:30]}... - {articulo_status}")
            
        except Exception as e:
            print(f"❌ Error al verificar estado de proveedores: {str(e)}")
            return False
        
        print(f"\n🎯 Campo default_articulos_id agregado exitosamente a la tabla proveedores!")
        return True


if __name__ == "__main__":
    verificar_default_articulos_campo()