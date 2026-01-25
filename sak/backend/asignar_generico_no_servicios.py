#!/usr/bin/env python3
"""
Script para asignar generico=false a todos los artículos que NO son del tipo servicios
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select, text
from app.db import get_session
from app.models.articulo import Articulo
from app.models.tipo_articulo import TipoArticulo


def asignar_generico_no_servicios():
    """Asigna generico=false a todos los artículos que NO son del tipo servicios"""
    
    with next(get_session()) as session:
        print("🔍 Identificando tipos de artículo que NO son servicios...")
        
        # 1. Buscar el tipo de artículo "servicios"
        stmt = select(TipoArticulo).where(
            TipoArticulo.nombre.ilike('%servicio%')
        )
        tipos_servicios = session.exec(stmt).all()
        
        if not tipos_servicios:
            print("❌ No se encontró tipo de artículo 'servicios'")
            return
        
        tipo_servicio_ids = [tipo.id for tipo in tipos_servicios]
        print(f"✅ Tipos de servicio identificados: {[tipo.nombre for tipo in tipos_servicios]}")
        
        # 2. Buscar artículos que NO son de tipo servicio
        stmt = select(Articulo).where(
            ~Articulo.tipo_articulo_id.in_(tipo_servicio_ids)
        )
        articulos_no_servicio = session.exec(stmt).all()
        
        print(f"\n📊 Encontrados {len(articulos_no_servicio)} artículos que NO son servicios")
        
        if len(articulos_no_servicio) == 0:
            print("ℹ️  No hay artículos para actualizar")
            return
        
        # 3. Contar cuántos necesitan actualización
        articulos_a_actualizar = [a for a in articulos_no_servicio if a.generico == True]
        
        print(f"🔄 {len(articulos_a_actualizar)} artículos necesitan actualización (generico: true → false)")
        print(f"✅ {len(articulos_no_servicio) - len(articulos_a_actualizar)} ya tienen generico=false")
        
        # 4. Mostrar algunos ejemplos antes de la actualización
        if len(articulos_a_actualizar) > 0:
            print(f"\n📝 Primeros 5 artículos a actualizar:")
            for i, articulo in enumerate(articulos_a_actualizar[:5]):
                tipo_nombre = "Sin tipo"
                if articulo.tipo_articulo_id:
                    tipo_rel = session.get(TipoArticulo, articulo.tipo_articulo_id)
                    if tipo_rel:
                        tipo_nombre = tipo_rel.nombre
                
                generico_actual = "🔄" if articulo.generico else "🎯"
                print(f"   • ID {articulo.id}: {articulo.nombre[:30]}... [{tipo_nombre}] {generico_actual}")
            
            if len(articulos_a_actualizar) > 5:
                print(f"   ... y {len(articulos_a_actualizar) - 5} más")
        
        # 5. Mostrar resumen por tipo
        print(f"\n📊 Resumen por tipos de artículo:")
        stmt_resumen = text("""
            SELECT 
                COALESCE(ta.nombre, 'Sin tipo') as tipo_nombre,
                ta.id as tipo_id,
                COUNT(*) as total_articulos,
                COUNT(CASE WHEN a.generico = true THEN 1 END) as genericos,
                COUNT(CASE WHEN a.generico = false THEN 1 END) as especificos
            FROM articulos a
            LEFT JOIN tipos_articulo ta ON a.tipo_articulo_id = ta.id
            WHERE (ta.id IS NULL OR ta.id NOT IN (13))
            GROUP BY ta.id, ta.nombre
            ORDER BY total_articulos DESC
        """)
        
        result = session.exec(stmt_resumen)
        for row in result:
            print(f"   📈 {row.tipo_nombre}: {row.total_articulos} total, {row.genericos} genéricos, {row.especificos} específicos")
        
        # 6. Confirmar la actualización
        if len(articulos_a_actualizar) > 0:
            respuesta = input(f"\n¿Actualizar generico=false para {len(articulos_a_actualizar)} artículos NO servicios? (s/N): ")
            if respuesta.lower() not in ['s', 'si', 'sí', 'y', 'yes']:
                print("🚫 Operación cancelada")
                return
            
            # 7. Realizar la actualización
            print(f"\n🔄 Actualizando artículos...")
            actualizados = 0
            
            for articulo in articulos_a_actualizar:
                articulo.generico = False
                session.add(articulo)
                actualizados += 1
            
            # 8. Confirmar cambios
            session.commit()
            
            print(f"\n✅ Actualización completada!")
            print(f"📊 {actualizados} artículos actualizados a generico=false")
        
        # 9. Verificación final
        print(f"\n🔍 Verificación final por tipos...")
        result_final = session.exec(stmt_resumen)
        for row in result_final:
            print(f"   📈 {row.tipo_nombre}: {row.total_articulos} total, {row.genericos} genéricos, {row.especificos} específicos")
        
        # 10. Resumen global
        print(f"\n🎯 Resumen global final:")
        stmt_global = text("""
            SELECT 
                COUNT(*) as total_articulos,
                COUNT(CASE WHEN a.generico = true THEN 1 END) as genericos,
                COUNT(CASE WHEN a.generico = false THEN 1 END) as especificos,
                COUNT(CASE WHEN ta.nombre ILIKE '%servicio%' THEN 1 END) as servicios,
                COUNT(CASE WHEN ta.nombre NOT ILIKE '%servicio%' OR ta.nombre IS NULL THEN 1 END) as no_servicios
            FROM articulos a
            LEFT JOIN tipos_articulo ta ON a.tipo_articulo_id = ta.id
        """)
        
        result_global = session.exec(stmt_global).first()
        if result_global:
            print(f"   🔢 Total artículos: {result_global.total_articulos}")
            print(f"   🔄 Genéricos: {result_global.genericos}")
            print(f"   🎯 Específicos: {result_global.especificos}")
            print(f"   🛠️  Servicios: {result_global.servicios}")
            print(f"   📦 No servicios: {result_global.no_servicios}")


if __name__ == "__main__":
    asignar_generico_no_servicios()