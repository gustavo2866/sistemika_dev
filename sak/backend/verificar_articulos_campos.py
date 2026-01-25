#!/usr/bin/env python3
"""
Script para verificar que los campos activo y generico se agregaron a articulos
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, text
from app.db import get_session


def verificar_campos_articulos():
    """Verifica que los campos activo y generico se agregaron correctamente"""
    
    with next(get_session()) as session:
        print("🔍 Verificando campos agregados en tabla articulos...")
        
        # 1. Verificar estructura de campos
        result = session.exec(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'articulos' 
            AND column_name IN ('activo', 'generico')
            ORDER BY column_name
        """))
        
        campos_encontrados = []
        for row in result:
            campos_encontrados.append(row.column_name)
            print(f"   ✅ {row.column_name}: {row.data_type} (nullable: {row.is_nullable}, default: {row.column_default})")
        
        # 2. Verificar que ambos campos existen
        campos_esperados = ['activo', 'generico']
        campos_faltantes = [campo for campo in campos_esperados if campo not in campos_encontrados]
        
        if campos_faltantes:
            print(f"   ❌ Campos faltantes: {campos_faltantes}")
        else:
            print(f"   ✅ Todos los campos esperados están presentes")
        
        # 3. Verificar índices
        print(f"\n📑 Verificando índices...")
        result = session.exec(text("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'articulos'
            AND (indexname LIKE '%activo%' OR indexname LIKE '%generico%')
            ORDER BY indexname
        """))
        
        indices = list(result)
        for row in indices:
            print(f"   📑 {row.indexname}: {row.indexdef}")
        
        # 4. Verificar datos existentes
        print(f"\n📊 Verificando datos existentes...")
        result = session.exec(text("""
            SELECT 
                COUNT(*) as total_articulos,
                COUNT(CASE WHEN activo = true THEN 1 END) as activos,
                COUNT(CASE WHEN activo = false THEN 1 END) as inactivos,
                COUNT(CASE WHEN generico = true THEN 1 END) as genericos,
                COUNT(CASE WHEN generico = false THEN 1 END) as especificos
            FROM articulos
        """))
        
        stats = result.first()
        if stats:
            print(f"   📈 Total artículos: {stats.total_articulos}")
            print(f"   ✅ Activos: {stats.activos}")
            print(f"   ❌ Inactivos: {stats.inactivos}")
            print(f"   🔄 Genéricos: {stats.genericos}")
            print(f"   🎯 Específicos: {stats.especificos}")
        
        # 5. Mostrar algunos artículos de ejemplo
        if stats and stats.total_articulos > 0:
            print(f"\n📝 Primeros 5 artículos con nuevos campos:")
            result = session.exec(text("""
                SELECT id, nombre, activo, generico
                FROM articulos
                ORDER BY id
                LIMIT 5
            """))
            
            for row in result:
                activo_str = "🟢" if row.activo else "🔴"
                generico_str = "🔄" if row.generico else "🎯"
                print(f"   • ID {row.id}: {row.nombre[:30]}... {activo_str} {generico_str}")
        
        print(f"\n🎉 Verificación completada!")
        print(f"📊 Campos agregados: {len(campos_encontrados)}/2")
        print(f"📑 Índices creados: {len(indices)}")
        print(f"📈 Artículos en BD: {stats.total_articulos if stats else 0}")


if __name__ == "__main__":
    verificar_campos_articulos()