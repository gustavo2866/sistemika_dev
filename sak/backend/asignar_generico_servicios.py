#!/usr/bin/env python3
"""
Script para asignar generico=true a todos los articulos del tipo servicios
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select, text
from app.db import get_session
from app.models.articulo import Articulo
from app.models.tipo_articulo import TipoArticulo


def asignar_generico_servicios():
    """Asigna generico=true a todos los artículos del tipo servicios"""
    
    with next(get_session()) as session:
        print("🔍 Buscando tipo de artículo 'servicios'...")
        
        # 1. Buscar el tipo de artículo "servicios"
        stmt = select(TipoArticulo).where(
            TipoArticulo.nombre.ilike('%servicio%')
        )
        tipos_servicios = session.exec(stmt).all()
        
        if not tipos_servicios:
            print("❌ No se encontró tipo de artículo 'servicios'")
            print("📋 Tipos de artículo disponibles:")
            stmt_all = select(TipoArticulo)
            todos_tipos = session.exec(stmt_all).all()
            for tipo in todos_tipos:
                print(f"   • ID {tipo.id}: {tipo.nombre}")
            return
        
        print(f"✅ Tipos de servicio encontrados:")
        for tipo in tipos_servicios:
            print(f"   • ID {tipo.id}: {tipo.nombre}")
        
        # 2. Obtener IDs de tipos de servicio
        tipo_servicio_ids = [tipo.id for tipo in tipos_servicios]
        
        # 3. Buscar artículos de tipo servicio
        stmt = select(Articulo).where(
            Articulo.tipo_articulo_id.in_(tipo_servicio_ids)
        )
        articulos_servicio = session.exec(stmt).all()
        
        print(f"\n📊 Encontrados {len(articulos_servicio)} artículos de servicios")
        
        if len(articulos_servicio) == 0:
            print("ℹ️  No hay artículos para actualizar")
            return
        
        # 4. Mostrar algunos ejemplos antes de la actualización
        print(f"\n📝 Primeros 5 artículos a actualizar:")
        for i, articulo in enumerate(articulos_servicio[:5]):
            generico_actual = "🔄" if articulo.generico else "🎯"
            print(f"   • ID {articulo.id}: {articulo.nombre[:40]}... {generico_actual}")
        
        if len(articulos_servicio) > 5:
            print(f"   ... y {len(articulos_servicio) - 5} más")
        
        # 5. Confirmar la actualización
        respuesta = input(f"\n¿Actualizar generico=true para {len(articulos_servicio)} artículos de servicios? (s/N): ")
        if respuesta.lower() not in ['s', 'si', 'sí', 'y', 'yes']:
            print("🚫 Operación cancelada")
            return
        
        # 6. Realizar la actualización
        print(f"\n🔄 Actualizando artículos...")
        actualizados = 0
        
        for articulo in articulos_servicio:
            if not articulo.generico:  # Solo actualizar si no es genérico
                articulo.generico = True
                session.add(articulo)
                actualizados += 1
            
        # 7. Confirmar cambios
        session.commit()
        
        # 8. Verificar resultados
        print(f"\n✅ Actualización completada!")
        print(f"📊 {actualizados} artículos actualizados a generico=true")
        print(f"ℹ️  {len(articulos_servicio) - actualizados} ya tenían generico=true")
        
        # 9. Verificación final
        print(f"\n🔍 Verificación final...")
        for tipo_id in tipo_servicio_ids:
            stmt_verificacion = text(f"""
                SELECT 
                    ta.nombre as tipo_nombre,
                    COUNT(*) as total_articulos,
                    COUNT(CASE WHEN a.generico = true THEN 1 END) as genericos,
                    COUNT(CASE WHEN a.generico = false THEN 1 END) as especificos
                FROM articulos a
                JOIN tipos_articulo ta ON a.tipo_articulo_id = ta.id
                WHERE ta.id = {tipo_id}
                GROUP BY ta.id, ta.nombre
                ORDER BY ta.nombre
            """)
            
            result = session.exec(stmt_verificacion)
            
            for row in result:
                print(f"   📈 {row.tipo_nombre}: {row.total_articulos} total, {row.genericos} genéricos, {row.especificos} específicos")


if __name__ == "__main__":
    asignar_generico_servicios()