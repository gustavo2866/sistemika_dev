#!/usr/bin/env python3
"""
Verificar impacto de corrección en KPIs del dashboard proyectos
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sak_user:cambia_esta_clave@localhost:5432/sak")

def verificar_impacto_correccion():
    """Verificar cómo cambió la vista optimizada después de la corrección"""
    
    engine = create_engine(DATABASE_URL)
    
    print("🔍 VERIFICACIÓN: Impacto corrección en KPIs Proyectos")
    print("=" * 60)
    
    with engine.begin() as conn:
        
        # 1. Contar órdenes en vista optimizada por mes
        print("1️⃣ ÓRDENES EN VISTA OPTIMIZADA POR MES")
        query_vista = """
        SELECT 
            EXTRACT(YEAR FROM fecha_emision) as año,
            EXTRACT(MONTH FROM fecha_emision) as mes,
            COUNT(*) as total_ordenes,
            SUM(importe_orden) as total_importe
        FROM vw_kpis_proyectos_po_orders
        WHERE fecha_emision >= '2025-12-01' 
            AND fecha_emision <= '2026-03-31'
        GROUP BY EXTRACT(YEAR FROM fecha_emision), EXTRACT(MONTH FROM fecha_emision)
        ORDER BY año, mes;
        """
        
        result_vista = conn.execute(text(query_vista)).fetchall()
        total_ordenes = sum(r.total_ordenes for r in result_vista)
        total_importe = sum(r.total_importe or 0 for r in result_vista)
        
        print(f"   📊 Total órdenes en vista: {total_ordenes}")
        print(f"   💰 Total importe: ${total_importe:,.2f}")
        print("   📅 Distribución mensual:")
        for r in result_vista:
            mes_nombre = {12: 'Dic', 1: 'Ene', 2: 'Feb', 3: 'Mar'}.get(int(r.mes), str(r.mes))
            print(f"       {int(r.año)}-{mes_nombre}: {r.total_ordenes} órdenes, ${r.total_importe or 0:,.0f}")
        
        # 2. Comparar con órdenes departamento 4 en marzo
        print("\n2️⃣ COMPARAR CON DEPARTAMENTO PROYECTOS MARZO 2026")
        query_dept_marzo = """
        SELECT 
            COUNT(*) as total_ordenes,
            SUM(po.total) as total_importe
        FROM po_orders po
        WHERE po.departamento_id = 4
            AND po.created_at >= '2026-03-01'
            AND po.created_at < '2026-04-01';
        """
        
        result_dept = conn.execute(text(query_dept_marzo)).fetchone()
        
        # Solo órdenes de marzo en vista optimizada
        ordenes_marzo_vista = next((r for r in result_vista if int(r.año) == 2026 and int(r.mes) == 3), None)
        
        if ordenes_marzo_vista and result_dept:
            print(f"   📊 Departamento 4 Marzo: {result_dept.total_ordenes} órdenes")
            print(f"   📊 Vista optimizada Marzo: {ordenes_marzo_vista.total_ordenes} órdenes")
            print(f"   ✅ Diferencia: {result_dept.total_ordenes - ordenes_marzo_vista.total_ordenes} órdenes")
            
            if result_dept.total_ordenes == ordenes_marzo_vista.total_ordenes:
                print("   🎉 ¡PERFECTO! Todas las órdenes de proyectos ahora están en vista")
            else:
                print("   ⚠️ Aún hay discrepancia (pueden ser órdenes sin fecha_emision)")
        
        # 3. Verificar proyectos individuales
        print("\n3️⃣ ÓRDENES POR PROYECTO EN VISTA OPTIMIZADA")
        query_por_proyecto = """
        SELECT 
            proyecto_id,
            proyecto_nombre,
            concepto_proyecto,
            COUNT(*) as total_ordenes,
            SUM(importe_orden) as total_importe,
            MIN(fecha_emision) as primera_emision,
            MAX(fecha_emision) as ultima_emision
        FROM vw_kpis_proyectos_po_orders
        WHERE proyecto_id BETWEEN 14 AND 17
        GROUP BY proyecto_id, proyecto_nombre, concepto_proyecto
        ORDER BY proyecto_id;
        """
        
        result_proyectos = conn.execute(text(query_por_proyecto)).fetchall()
        
        print(f"   📊 Total proyectos en vista: {len(result_proyectos)}")
        print("   📋 Detalle por proyecto:")
        print(f"   {'Proyecto':<10} {'Concepto':<15} {'Órdenes':<8} {'Importe':<15} {'Período':<20}")
        print("   " + "-" * 75)
        
        for r in result_proyectos:
            concepto_corto = str(r.concepto_proyecto or "")[:12] + "..." if len(str(r.concepto_proyecto or "")) > 12 else str(r.concepto_proyecto or "")
            periodo = f"{r.primera_emision.strftime('%m/%d')}-{r.ultima_emision.strftime('%m/%d')}" if r.primera_emision and r.ultima_emision else "N/A"
            print(f"   {r.proyecto_id:<10} {concepto_corto:<15} {r.total_ordenes:<8} ${r.total_importe or 0:<14,.0f} {periodo:<20}")
        
        # 4. Resumen de cambio
        print(f"\n4️⃣ RESUMEN DEL CAMBIO")
        print(f"   📈 Antes de corrección: 15 órdenes en vista optimizada")
        print(f"   📈 Después de corrección: {total_ordenes} órdenes en vista optimizada")
        print(f"   🚀 Incremento: {total_ordenes - 15} órdenes")
        print(f"   💰 Incremento importe: ${total_importe - (total_importe / total_ordenes * 15):,.2f}" if total_ordenes > 0 else "")
        
        if total_ordenes > 15:
            print(f"   ✅ Los KPIs del dashboard ahora incluyen MÁS datos de proyectos")
            print(f"   📊 Esto mejorará la precisión de los cálculos presupuestarios")

    print("\n✅ Verificación completada")

if __name__ == "__main__":
    verificar_impacto_correccion()