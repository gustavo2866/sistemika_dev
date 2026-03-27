#!/usr/bin/env python3
"""
Análisis detallado de performance del dashboard proyectos
"""
import sys
from pathlib import Path
import time
from datetime import datetime

# Agregar directorio app al path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

from app.db import get_session
from app.services.proyectos_dashboard import (
    fetch_proyectos_for_dashboard,
    build_proyectos_dashboard_payload,
)

def analizar_performance_detallada():
    """Análisis paso a paso de performance del dashboard"""
    
    print("🔍 ANÁLISIS: Performance Dashboard Proyectos")
    print("=" * 55)
    
    session = next(get_session())
    
    try:
        # Configurar período de prueba
        start_date = "2026-03-01"
        end_date = "2026-03-31"
        
        print(f"📅 Período de análisis: {start_date} → {end_date}")
        print()
        
        # 1. PASO 1: Fetch proyectos
        print("1️⃣ PASO 1: Fetch proyectos")
        start_time = time.time()
        
        items = fetch_proyectos_for_dashboard(
            session=session,
            start_date=start_date,
            end_date=end_date,
        )
        
        fetch_time = time.time() - start_time
        print(f"   ⏱️  Tiempo fetch: {fetch_time:.3f}s")
        print(f"   📊 Proyectos encontrados: {len(items)}")
        print(f"   📈 Tiempo por proyecto: {(fetch_time/len(items)*1000) if items else 0:.1f}ms")
        
        if fetch_time > 1.0:
            print("   ⚠️ BOTTLENECK: Fetch proyectos >1s")
        
        # 2. PASO 2: Build dashboard payload (donde están los KPIs)
        print(f"\n2️⃣ PASO 2: Build dashboard payload")
        payload_start = time.time()
        
        # Interceptar subfunciones si es posible
        class TimeTracker:
            def __init__(self):
                self.times = {}
                self.start_times = {}
            
            def start(self, name):
                self.start_times[name] = time.time()
            
            def end(self, name):
                if name in self.start_times:
                    elapsed = time.time() - self.start_times[name]
                    self.times[name] = elapsed
                    return elapsed
                return 0
        
        tracker = TimeTracker()
        
        # Simular build con tracking manual
        mini_payload_start = time.time()
        
        # Hacer payload mínimo primero
        try:
            payload = build_proyectos_dashboard_payload(
                items,
                start_date=start_date,
                end_date=end_date,
                limit_top=3,  # Reducir para test
                filters={},
                session=session,
                periodo_tipo="mensual",
            )
            
            payload_time = time.time() - mini_payload_start
            
            print(f"   ⏱️  Tiempo payload: {payload_time:.3f}s")
            
            # Analizar componentes del payload
            kpis = payload.get('kpis', {})
            proyectos_data = payload.get('proyectos', [])
            
            print(f"   📊 KPIs generados: {len(kpis)} tipos")
            print(f"   📋 Proyectos procesados: {len(proyectos_data)}")
            
            # Verificar si hay KPIs con datos
            kpi_totals = {}
            for kpi_type, kpi_data in kpis.items():
                if isinstance(kpi_data, dict):
                    total = kpi_data.get('importe', 0)
                    kpi_totals[kpi_type] = total
                    print(f"       {kpi_type}: ${total:,.0f}")
                else:
                    kpi_totals[kpi_type] = kpi_data
                    print(f"       {kpi_type}: {kpi_data}")
            
            if payload_time > 3.0:
                print("   🚨 BOTTLENECK CRÍTICO: Build payload >3s")
            elif payload_time > 1.0:
                print("   ⚠️ BOTTLENECK: Build payload >1s")
                
        except Exception as e:
            print(f"   ❌ Error en payload: {e}")
            payload_time = time.time() - mini_payload_start
        
        total_time = fetch_time + payload_time
        print(f"\n📊 RESUMEN PERFORMANCE:")
        print(f"   🔍 Fetch proyectos: {fetch_time:.3f}s ({fetch_time/total_time*100:.1f}%)")
        print(f"   🏗️  Build payload: {payload_time:.3f}s ({payload_time/total_time*100:.1f}%)")
        print(f"   ⏱️  Total: {total_time:.3f}s")
        
        # 3. ANÁLISIS DE CAUSAS PROBABLES
        print(f"\n3️⃣ ANÁLISIS DE CAUSAS")
        
        print("   🔍 Posibles causas de lentitud:")
        
        # Causa 1: Muchos proyectos
        if len(items) > 10:
            print(f"   • Cantidad proyectos: {len(items)} (óptimo: <10)")
            
        # Causa 2: Consultas N+1 por proyecto
        if payload_time > fetch_time * 2:
            print(f"   • Posible consulta N+1: payload {payload_time:.1f}s vs fetch {fetch_time:.1f}s")
            
        # Causa 3: Cálculos complejos
        if len(items) > 0:
            tiempo_por_proyecto = payload_time / len(items)
            if tiempo_por_proyecto > 0.2:  # >200ms por proyecto
                print(f"   • Cálculo lento por proyecto: {tiempo_por_proyecto*1000:.0f}ms/proyecto")
        
        # 4. RECOMENDACIONES
        print(f"\n4️⃣ RECOMENDACIONES DE OPTIMIZACIÓN")
        
        optimizaciones = []
        
        if fetch_time > 1.0:
            optimizaciones.append("📊 Optimizar consulta fetch_proyectos (índices, filtros)")
            
        if len(items) > 15:
            optimizaciones.append("📄 Implementar paginación (máximo 10-15 proyectos)")
            
        if payload_time > 2.0:
            optimizaciones.append("🏗️ Optimizar build_payload (batch queries, eager loading)")
            
        if total_time > 2.0:
            optimizaciones.append("💾 Implementar cache para KPIs (Redis, memoria)")
            
        optimizaciones.append("📈 Crear índices específicos en po_orders, proyectos")
        optimizaciones.append("🔄 Pre-calcular KPIs en background job")
        
        for i, opt in enumerate(optimizaciones, 1):
            print(f"   {i}. {opt}")
        
        # 5. TARGET PERFORMANCE
        print(f"\n5️⃣ TARGET PERFORMANCE")
        print(f"   🎯 Objetivo: <1.5s total")
        print(f"   📊 Fetch proyectos: <0.5s")
        print(f"   🏗️ Build payload: <1.0s")
        
        gap = total_time - 1.5
        if gap > 0:
            print(f"   ⚡ Mejora necesaria: -{gap:.1f}s ({gap/total_time*100:.0f}%)")
        else:
            print(f"   ✅ Performance aceptable")

    finally:
        session.close()

    print("\n✅ Análisis de performance completado")

if __name__ == "__main__":
    analizar_performance_detallada()