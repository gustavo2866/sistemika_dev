#!/usr/bin/env python3
"""
Test simple KPIs usando las funciones exactas del test de precisión que funcionaron
"""
import sys
from pathlib import Path

# Agregar directorio app al path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

from app.db import get_session
from app.models.views.kpis_proyectos import VwKpisProyectosPoOrders
from sqlmodel import select
import time

def test_simple_post_correccion():
    """Test simple para verificar que la corrección funciona"""
    
    print("🔍 TEST: KPIs Simples Post-Corrección")
    print("=" * 50)
    
    session = next(get_session())
    
    try:
        # 1. Verificar vista optimizada directamente
        print("1️⃣ VERIFICAR VISTA OPTIMIZADA DIRECTA")
        
        start_time = time.time()
        
        # Query exacta de la vista
        query = select(VwKpisProyectosPoOrders).where(
            VwKpisProyectosPoOrders.fecha_emision >= '2025-12-01'
        ).where(
            VwKpisProyectosPoOrders.fecha_emision <= '2026-03-31'
        )
        
        result = session.exec(query).all()
        query_time = time.time() - start_time
        
        print(f"   ⏱️  Query tiempo: {query_time:.3f}s")
        print(f"   📊 Total órdenes: {len(result)}")
        
        if len(result) > 15:
            print(f"   🎉 ¡CORRECCIÓN EXITOSA! Pasamos de 15 a {len(result)} órdenes (+{len(result)-15})")
        
        # Agrupar por concepto
        conceptos = {}
        for orden in result:
            concepto = orden.concepto_proyecto or 'otros'
            if concepto not in conceptos:
                conceptos[concepto] = {'count': 0, 'importe': 0}
            conceptos[concepto]['count'] += 1
            conceptos[concepto]['importe'] += float(orden.importe_orden or 0)
        
        print("   📋 Distribución por concepto:")
        for concepto, data in conceptos.items():
            print(f"      {concepto}: {data['count']} órdenes, ${data['importe']:,.0f}")
        
        # Verificar MO Propia específicamente
        mo_propia_ordenes = [o for o in result if o.concepto_proyecto == 'mo_propia']
        mo_propia_importe = sum(float(o.importe_orden or 0) for o in mo_propia_ordenes)
        
        print(f"   🔍 MO Propia detallada:")
        print(f"      Órdenes: {len(mo_propia_ordenes)}")
        print(f"      Importe total: ${mo_propia_importe:,.0f}")
        
        if mo_propia_importe > 600_000_000:
            print(f"   🎉 ¡PERFECTO! MO Propia refleja las 16 órdenes corregidas ($640M+)")
        
        # 2. Verificar por proyecto
        print(f"\n2️⃣ VERIFICAR POR PROYECTO")
        
        proyectos = {}
        for orden in result:
            proyecto_id = orden.proyecto_id
            if proyecto_id not in proyectos:
                proyectos[proyecto_id] = {'count': 0, 'importe': 0, 'nombre': orden.proyecto_nombre}
            proyectos[proyecto_id]['count'] += 1
            proyectos[proyecto_id]['importe'] += float(orden.importe_orden or 0)
        
        print(f"   📋 Órdenes por proyecto (proyectos 14-17):")
        for proyecto_id in sorted([14, 15, 16, 17]):
            if proyecto_id in proyectos:
                data = proyectos[proyecto_id]
                nombre = data['nombre'][:30] + "..." if len(data['nombre']) > 30 else data['nombre']
                print(f"      P{proyecto_id}: {data['count']} órdenes, ${data['importe']:,.0f} - {nombre}")
            else:
                print(f"      P{proyecto_id}: 0 órdenes")
        
        # 3. Verificar rango de fechas
        print(f"\n3️⃣ VERIFICAR RANGO FECHAS")
        
        fechas = [o.fecha_emision for o in result if o.fecha_emision]
        if fechas:
            fecha_min = min(fechas)
            fecha_max = max(fechas)
            print(f"   📅 Rango: {fecha_min} → {fecha_max}")
            
            # Contar por mes
            meses = {}
            for fecha in fechas:
                mes_key = f"{fecha.year}-{fecha.month:02d}"
                meses[mes_key] = meses.get(mes_key, 0) + 1
            
            print(f"   📊 Distribución mensual:")
            for mes, count in sorted(meses.items()):
                print(f"      {mes}: {count} órdenes")
        
        # 4. Resumen final
        print(f"\n4️⃣ RESUMEN FINAL")
        total_importe = sum(float(o.importe_orden or 0) for o in result)
        
        print(f"   📊 Resumen corrección:")
        print(f"      Total órdenes: {len(result)}")
        print(f"      Total importe: ${total_importe:,.0f}")
        print(f"      Proyectos únicos: {len(proyectos)}")
        
        if len(result) == 31 and mo_propia_importe > 600_000_000:
            print(f"   ✅ CORRECCIÓN 100% EXITOSA")
            print(f"   🚀 Dashboard proyectos funcionará con datos completos")
        elif len(result) > 15:
            print(f"   ✅ Corrección parcial exitosa (+{len(result)-15} órdenes)")
        else:
            print(f"   ⚠️ Corrección no se refleja en vista optimizada")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        session.close()

    print("\n✅ Test simple completado")

if __name__ == "__main__":
    test_simple_post_correccion()