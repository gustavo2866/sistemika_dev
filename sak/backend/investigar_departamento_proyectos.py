#!/usr/bin/env python3
"""
Investigar discrepancia: órdenes con departamento "Proyectos" vs órdenes relacionadas a proyectos reales
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("dotenv not available, using os.getenv directly")

# Obtener DATABASE_URL del entorno
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment, using default local database")
    DATABASE_URL = "postgresql://sak_user:cambia_esta_clave@localhost:5432/sak"

def investigar_discrepancia():
    """Investigar órdenes con departamento Proyectos vs relación real con proyectos"""
    
    engine = create_engine(DATABASE_URL)
    
    print("🔍 INVESTIGACIÓN: Departamento 'Proyectos' vs Relación real")
    print("=" * 70)
    
    with engine.connect() as conn:
        
        # 1. Órdenes con departamento "Proyectos" en marzo 2026
        print("1️⃣ ÓRDENES CON DEPARTAMENTO 'PROYECTOS' - MARZO 2026")
        query_dept = """
        SELECT 
            po.id,
            po.created_at,
            d.nombre as departamento,
            po.oportunidad_id,
            po.total,
            pos.nombre as status
        FROM po_orders po
        LEFT JOIN departamentos d ON po.departamento_id = d.id
        LEFT JOIN po_order_status pos ON po.order_status_id = pos.id
        WHERE d.nombre ILIKE '%proyecto%'
            AND po.created_at >= '2026-03-01'
            AND po.created_at < '2026-04-01'
        ORDER BY po.created_at;
        """
        
        result_dept = conn.execute(text(query_dept)).fetchall()
        print(f"   📊 Total órdenes departamento 'Proyectos': {len(result_dept)}")
        
        if len(result_dept) > 0:
            print("   📅 Fechas:", min(r.created_at for r in result_dept).date(), "→", max(r.created_at for r in result_dept).date())
            print(f"   💰 Total importe: ${sum(r.total or 0 for r in result_dept):,.2f}")
            
            # Mostrar ejemplos
            print("\n   📝 Ejemplos (primeros 10):")
            print(f"   {'ID':<8} {'Fecha':<12} {'Departamento':<15} {'Oportunidad_ID':<15} {'Total':<12} {'Status':<12}")
            print("   " + "-" * 80)
            for r in result_dept[:10]:
                total_str = f"${r.total:,.0f}" if r.total else "N/A"
                print(f"   {r.id:<8} {str(r.created_at)[:10]:<12} {r.departamento:<15} {str(r.oportunidad_id):<15} {total_str:<12} {r.status:<12}")
        
        # 2. De esas órdenes, cuáles tienen oportunidad_id válida
        print(f"\n2️⃣ VERIFICAR oportunidad_id DE ÓRDENES DEPARTAMENTO PROYECTOS")
        
        if len(result_dept) > 0:
            oportunidad_ids = [r.oportunidad_id for r in result_dept if r.oportunidad_id]
            print(f"   📊 Órdenes con oportunidad_id: {len(oportunidad_ids)}")
            print(f"   📊 Órdenes sin oportunidad_id: {len(result_dept) - len(oportunidad_ids)}")
            
            if oportunidad_ids:
                # Verificar cuáles oportunidad_id corresponden a proyectos reales
                query_proyectos = """
                SELECT DISTINCT
                    o.id as oportunidad_id,
                    p.id as proyecto_id,
                    p.nombre as proyecto_nombre,
                    o.tipo_solicitud_id
                FROM oportunidades o
                LEFT JOIN proyectos p ON o.id = p.oportunidad_id
                WHERE o.id = ANY(%(oportunidad_ids)s);
                """
                
                result_proyectos = conn.execute(text(query_proyectos), 
                                              {"oportunidad_ids": oportunidad_ids}).fetchall()
                
                print(f"   📊 Oportunidades válidas encontradas: {len(result_proyectos)}")
                
                # Clasificar oportunidades
                con_proyecto = [r for r in result_proyectos if r.proyecto_id]
                sin_proyecto = [r for r in result_proyectos if not r.proyecto_id]
                
                print(f"   ✅ Con proyecto real: {len(con_proyecto)}")
                print(f"   ❌ Sin proyecto real: {len(sin_proyecto)}")
                
                if con_proyecto:
                    print("\n   📝 Oportunidades CON proyecto:")
                    print(f"   {'Oportunidad_ID':<15} {'Proyecto_ID':<12} {'Proyecto_Nombre':<35} {'Tipo_Solicitud':<15}")
                    print("   " + "-" * 80)
                    for r in con_proyecto[:5]:
                        nombre_corto = str(r.proyecto_nombre or "")[:32] + "..." if len(str(r.proyecto_nombre or "")) > 32 else str(r.proyecto_nombre or "")
                        print(f"   {str(r.oportunidad_id):<15} {str(r.proyecto_id):<12} {nombre_corto:<35} {str(r.tipo_solicitud_id):<15}")
                
                if sin_proyecto:
                    print("\n   📝 Oportunidades SIN proyecto:")
                    print(f"   {'Oportunidad_ID':<15} {'Tipo_Solicitud':<15}")
                    print("   " + "-" * 32)
                    for r in sin_proyecto[:10]:
                        print(f"   {str(r.oportunidad_id):<15} {str(r.tipo_solicitud_id):<15}")
        
        # 3. Comparar con nuestra vista optimizada
        print(f"\n3️⃣ COMPARACIÓN CON VISTA OPTIMIZADA - MARZO 2026")
        query_vista = """
        SELECT COUNT(*) as total, 
               SUM(importe_orden) as total_importe
        FROM vw_kpis_proyectos_po_orders
        WHERE fecha_emision >= '2026-03-01' 
            AND fecha_emision < '2026-04-01';
        """
        
        result_vista = conn.execute(text(query_vista)).fetchone()
        print(f"   📊 Órdenes en vista optimizada: {result_vista.total}")
        print(f"   💰 Total importe vista: ${result_vista.total_importe or 0:,.2f}")
        
        # 4. Análisis de diferencias
        print(f"\n4️⃣ ANÁLISIS DE DIFERENCIAS")
        dept_count = len(result_dept)
        vista_count = result_vista.total
        
        print(f"   📊 Departamento 'Proyectos': {dept_count} órdenes")
        print(f"   📊 Vista optimizada: {vista_count} órdenes")
        print(f"   🔢 Diferencia: {dept_count - vista_count} órdenes")
        
        if dept_count > vista_count:
            print(f"   ⚠️ HAY {dept_count - vista_count} ÓRDENES ADICIONALES con departamento 'Proyectos'")
            print("   🔍 Estas órdenes NO están vinculadas a proyectos reales o no tienen fecha_emision")
        
        # 5. Investigar órdenes faltantes
        if dept_count > vista_count:
            print(f"\n5️⃣ INVESTIGAR ÓRDENES FALTANTES EN VISTA")
            
            query_faltantes = """
            SELECT 
                po.id,
                po.created_at,
                d.nombre as departamento,
                po.oportunidad_id,
                po.total,
                pos.nombre as status,
                CASE 
                    WHEN p.id IS NOT NULL THEN 'SÍ'
                    ELSE 'NO'
                END as tiene_proyecto,
                CASE 
                    WHEN psl.fecha IS NOT NULL THEN 'SÍ'
                    ELSE 'NO'  
                END as tiene_fecha_emision
            FROM po_orders po
            LEFT JOIN departamentos d ON po.departamento_id = d.id
            LEFT JOIN po_order_status pos ON po.order_status_id = pos.id
            LEFT JOIN oportunidades o ON po.oportunidad_id = o.id
            LEFT JOIN proyectos p ON o.id = p.oportunidad_id
            LEFT JOIN po_order_status_log psl ON po.id = psl.order_id AND psl.status_id = 3
            WHERE d.nombre ILIKE '%proyecto%'
                AND po.created_at >= '2026-03-01'
                AND po.created_at < '2026-04-01'
                AND (p.id IS NULL OR psl.fecha IS NULL)
            ORDER BY po.created_at;
            """
            
            result_faltantes = conn.execute(text(query_faltantes)).fetchall()
            print(f"   📊 Órdenes que NO aparecen en vista: {len(result_faltantes)}")
            
            if result_faltantes:
                print("\n   📝 Análisis de órdenes faltantes:")
                print(f"   {'ID':<8} {'Fecha':<12} {'Oportunidad_ID':<15} {'Total':<12} {'Proyecto':<9} {'F.Emisión':<10} {'Status':<12}")
                print("   " + "-" * 85)
                for r in result_faltantes[:15]:
                    total_str = f"${r.total:,.0f}" if r.total else "N/A"
                    print(f"   {r.id:<8} {str(r.created_at)[:10]:<12} {str(r.oportunidad_id):<15} {total_str:<12} {r.tiene_proyecto:<9} {r.tiene_fecha_emision:<10} {r.status:<12}")
                
                # Contar razones de exclusión
                sin_proyecto = len([r for r in result_faltantes if r.tiene_proyecto == 'NO'])
                sin_fecha_emision = len([r for r in result_faltantes if r.tiene_fecha_emision == 'NO'])
                
                print(f"\n   📋 Razones de exclusión:")
                print(f"   ❌ Sin proyecto real: {sin_proyecto} órdenes")
                print(f"   ❌ Sin fecha emisión: {sin_fecha_emision} órdenes")

    print("\n✅ Investigación completada")

if __name__ == "__main__":
    investigar_discrepancia()