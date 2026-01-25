#!/usr/bin/env python3
"""
Script para activar todos los artículos (activo=true)
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select, text
from app.db import get_session
from app.models.articulo import Articulo


def activar_todos_articulos():
    """Activa todos los artículos (activo=true)"""
    
    with next(get_session()) as session:
        print("🔍 Verificando estado actual de artículos...")
        
        # 1. Verificar estado actual
        stmt = text("""
            SELECT 
                COUNT(*) as total_articulos,
                COUNT(CASE WHEN activo = true THEN 1 END) as activos,
                COUNT(CASE WHEN activo = false THEN 1 END) as inactivos
            FROM articulos
        """)
        
        result = session.exec(stmt).first()
        
        print(f"📊 Estado actual:")
        print(f"   🔢 Total artículos: {result.total_articulos}")
        print(f"   ✅ Ya activos: {result.activos}")
        print(f"   ❌ Inactivos: {result.inactivos}")
        
        if result.inactivos == 0:
            print(f"\n🎯 ¡Perfecto! Todos los artículos ya están activos")
            return
        
        # 2. Mostrar algunos ejemplos de artículos a activar
        print(f"\n📝 Ejemplos de artículos a activar:")
        stmt_ejemplos = text("""
            SELECT a.id, a.nombre, ta.nombre as tipo_nombre
            FROM articulos a
            LEFT JOIN tipos_articulo ta ON a.tipo_articulo_id = ta.id
            WHERE a.activo = false
            ORDER BY a.id
            LIMIT 10
        """)
        
        ejemplos = session.exec(stmt_ejemplos)
        for i, ejemplo in enumerate(ejemplos, 1):
            print(f"   {i}. ID {ejemplo.id}: {ejemplo.nombre[:40]}... [{ejemplo.tipo_nombre or 'Sin tipo'}]")
        
        if result.inactivos > 10:
            print(f"   ... y {result.inactivos - 10} más")
        
        # 3. Confirmar la actualización
        respuesta = input(f"\n¿Activar todos los {result.inactivos} artículos inactivos? (s/N): ")
        if respuesta.lower() not in ['s', 'si', 'sí', 'y', 'yes']:
            print("🚫 Operación cancelada")
            return
        
        # 4. Realizar la actualización
        print(f"\n🔄 Activando artículos...")
        
        stmt_update = select(Articulo).where(Articulo.activo == False)
        articulos_inactivos = session.exec(stmt_update).all()
        
        actualizados = 0
        for articulo in articulos_inactivos:
            articulo.activo = True
            session.add(articulo)
            actualizados += 1
        
        # 5. Confirmar cambios
        session.commit()
        
        print(f"\n✅ Actualización completada!")
        print(f"📊 {actualizados} artículos activados")
        
        # 6. Verificación final
        print(f"\n🔍 Verificación final...")
        result_final = session.exec(stmt).first()
        
        print(f"📊 Estado final:")
        print(f"   🔢 Total artículos: {result_final.total_articulos}")
        print(f"   ✅ Activos: {result_final.activos}")
        print(f"   ❌ Inactivos: {result_final.inactivos}")
        
        if result_final.activos == result_final.total_articulos:
            print(f"\n🎯 ¡Éxito! Todos los {result_final.total_articulos} artículos están ahora activos")
        else:
            print(f"\n⚠️  Advertencia: {result_final.inactivos} artículos siguen inactivos")


if __name__ == "__main__":
    activar_todos_articulos()