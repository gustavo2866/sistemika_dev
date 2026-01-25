#!/usr/bin/env python3
"""
Script para verificar el estado del campo activo en todos los artículos
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, text
from app.db import get_session


def verificar_articulos_activo():
    """Verifica el estado del campo activo en todos los artículos"""
    
    with next(get_session()) as session:
        print("🔍 Verificando estado del campo 'activo' en artículos...")
        
        # Consulta para obtener estadísticas del campo activo
        stmt = text("""
            SELECT 
                COUNT(*) as total_articulos,
                COUNT(CASE WHEN activo = true THEN 1 END) as activos,
                COUNT(CASE WHEN activo = false THEN 1 END) as inactivos,
                COUNT(CASE WHEN activo IS NULL THEN 1 END) as nulos
            FROM articulos
        """)
        
        result = session.exec(stmt).first()
        
        print(f"\n📊 Resumen general:")
        print(f"   🔢 Total artículos: {result.total_articulos}")
        print(f"   ✅ Activos (true): {result.activos}")
        print(f"   ❌ Inactivos (false): {result.inactivos}")
        print(f"   ❓ Nulos: {result.nulos}")
        
        # Verificar por tipo de artículo
        print(f"\n📈 Estado por tipo de artículo:")
        stmt_por_tipo = text("""
            SELECT 
                COALESCE(ta.nombre, 'Sin tipo') as tipo_nombre,
                COUNT(*) as total,
                COUNT(CASE WHEN a.activo = true THEN 1 END) as activos,
                COUNT(CASE WHEN a.activo = false THEN 1 END) as inactivos,
                ROUND(COUNT(CASE WHEN a.activo = true THEN 1 END) * 100.0 / COUNT(*), 1) as porcentaje_activos
            FROM articulos a
            LEFT JOIN tipos_articulo ta ON a.tipo_articulo_id = ta.id
            GROUP BY ta.id, ta.nombre
            ORDER BY total DESC
        """)
        
        results_tipo = session.exec(stmt_por_tipo)
        for row in results_tipo:
            status = "✅" if row.porcentaje_activos == 100 else "⚠️" if row.porcentaje_activos > 0 else "❌"
            print(f"   {status} {row.tipo_nombre}: {row.total} total, {row.activos} activos, {row.inactivos} inactivos ({row.porcentaje_activos}%)")
        
        # Mostrar algunos ejemplos de artículos inactivos si los hay
        if result.inactivos > 0:
            print(f"\n🔍 Ejemplos de artículos inactivos:")
            stmt_ejemplos = text("""
                SELECT a.id, a.nombre, ta.nombre as tipo_nombre, a.activo
                FROM articulos a
                LEFT JOIN tipos_articulo ta ON a.tipo_articulo_id = ta.id
                WHERE a.activo = false
                ORDER BY a.id
                LIMIT 10
            """)
            
            ejemplos = session.exec(stmt_ejemplos)
            for i, ejemplo in enumerate(ejemplos, 1):
                print(f"   {i}. ID {ejemplo.id}: {ejemplo.nombre[:40]}... [{ejemplo.tipo_nombre or 'Sin tipo'}] - activo: {ejemplo.activo}")
        
        # Responder a la pregunta específica
        print(f"\n🎯 Respuesta:")
        if result.activos == result.total_articulos:
            print(f"   ✅ SÍ, todos los {result.total_articulos} artículos tienen activo=true")
        else:
            print(f"   ❌ NO, {result.inactivos} de {result.total_articulos} artículos tienen activo=false")
            print(f"   📊 Solo {result.activos} artículos ({(result.activos/result.total_articulos)*100:.1f}%) están activos")


if __name__ == "__main__":
    verificar_articulos_activo()