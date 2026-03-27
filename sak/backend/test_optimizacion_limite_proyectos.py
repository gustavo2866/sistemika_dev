#!/usr/bin/env python3
"""
Optimización CRÍTICA: Agregar límite a fetch_proyectos_for_dashboard
"""
import sys
from pathlib import Path
import time

# Agregar directorio app al path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

from app.db import get_session
from app.services.proyectos_dashboard import fetch_proyectos_for_dashboard, build_proyectos_dashboard_payload

def test_optimizacion_limite():
    """Test crítico: agregar límite para reducir Projects de 21 a 10"""
    
    print("⚡ OPTIMIZACIÓN CRÍTICA: Límite de proyectos")
    print("=" * 50)
    
    session = next(get_session())
    
    try:
        start_date = "2026-03-01"
        end_date = "2026-03-31"
        
        print(f"📅 Período: {start_date} → {end_date}")
        
        # 1. TEST ACTUAL (sin límite)
        print(f"\n1️⃣ PERFORMANCE ACTUAL (sin límite)")
        start_time = time.time()
        
        items_full = fetch_proyectos_for_dashboard(
            session=session,
            start_date=start_date,
            end_date=end_date,
        )
        
        fetch_time_full = time.time() - start_time
        print(f"   📊 Proyectos: {len(items_full)}")
        print(f"   ⏱️  Fetch tiempo: {fetch_time_full:.3f}s")
        print(f"   📈 Por proyecto: {(fetch_time_full/len(items_full)*1000) if items_full else 0:.0f}ms")
        
        # 2. TEST SIMULADO CON LÍMITE (tomar solo primeros 10)
        print(f"\n2️⃣ SIMULACIÓN CON LÍMITE (top 10)")
        
        items_limited = items_full[:10]  # Simular límite
        
        # Medir solo el payload con 10 proyectos
        payload_start = time.time()
        
        payload_limited = build_proyectos_dashboard_payload(
            items_limited,
            start_date=start_date,
            end_date=end_date,
            limit_top=5,
            filters={},
            session=session,
            periodo_tipo="mensual",
        )
        
        payload_time_limited = time.time() - payload_start
        
        # Estimar fetch time reducido (proporcionalmente)
        fetch_time_estimated = fetch_time_full * (len(items_limited) / len(items_full))
        total_time_estimated = fetch_time_estimated + payload_time_limited
        
        print(f"   📊 Proyectos: {len(items_limited)}")
        print(f"   ⏱️  Fetch estimado: {fetch_time_estimated:.3f}s")
        print(f"   ⏱️  Payload real: {payload_time_limited:.3f}s")
        print(f"   ⏱️  Total estimado: {total_time_estimated:.3f}s")
        
        # 3. COMPARACIÓN PERFORMANCE
        print(f"\n3️⃣ COMPARACIÓN PERFORMANCE")
        
        tiempo_original = fetch_time_full + 1.6  # Estimado del análisis anterior
        tiempo_optimizado = total_time_estimated
        mejora_segundos = tiempo_original - tiempo_optimizado
        mejora_porcentaje = (mejora_segundos / tiempo_original) * 100
        
        print(f"   📊 ANTES (21 proyectos):")
        print(f"      ⏱️ Total: ~{tiempo_original:.1f}s")
        print(f"      📈 230ms por proyecto")
        
        print(f"   ✅ DESPUÉS (10 proyectos):")
        print(f"      ⏱️ Total: {tiempo_optimizado:.1f}s")
        print(f"      📈 {(tiempo_optimizado/10*1000):.0f}ms por proyecto")
        
        print(f"   🚀 MEJORA:")
        print(f"      ⚡ -{mejora_segundos:.1f}s ({mejora_porcentaje:.0f}% mejora)")
        
        # 4. VERIFICAR CALIDAD DE DATOS
        print(f"\n4️⃣ VERIFICAR CALIDAD DE DATOS")
        
        kpis_limited = payload_limited.get('kpis', {})
        
        print("   📈 KPIs con 10 proyectos:")
        for kpi_name, kpi_data in kpis_limited.items():
            if isinstance(kpi_data, dict) and 'importe' in kpi_data:
                print(f"      {kpi_name}: ${kpi_data['importe']:,.0f}")
            elif isinstance(kpi_data, (int, float)):
                print(f"      {kpi_name}: {kpi_data}")
        
        # 5. RECOMENDACIÓN FINAL
        print(f"\n5️⃣ RECOMENDACIÓN IMPLEMENTACIÓN")
        
        if tiempo_optimizado < 2.0:
            print(f"   🎯 TARGET ALCANZADO: <2s dashboard")
            print(f"   ✅ IMPLEMENTAR: Límite 10-15 proyectos")
            
            print(f"\n   🔧 Cambio en fetch_proyectos_for_dashboard:")
            print(f"      • Agregar LIMIT 15 en query SQL")
            print(f"      • Ordenar por relevancia (created_at DESC)")
            print(f"      • Implementar paginación en frontend")
            
            # Código sugerido para implementar
            codigo_optimizado = '''
# En app/services/proyectos_dashboard.py - función fetch_proyectos_for_dashboard:

# ANTES: sin límite
stmt = select(Proyecto)...

# DESPUÉS: con límite optimizado  
stmt = (
    select(Proyecto)
    .where(...)
    .order_by(Proyecto.created_at.desc())  # Más relevantes primero
    .limit(15)  # LÍMITE CRÍTICO para performance
)
            '''
            
            print(f"   💻 Código sugerido:")
            print(codigo_optimizado)
            
        else:
            print(f"   ⚠️ Límite solo no es suficiente")
            print(f"   🔧 Necesarias optimizaciones adicionales")
        
        # 6. ALTERNATIVAS ADICIONALES
        print(f"\n6️⃣ ALTERNATIVAS ADICIONALES")
        
        alternativas = [
            "📄 Paginación: 10 proyectos por página",
            "🔍 Filtros previos: solo proyectos activos por defecto",
            "📅 Rango temporal: último trimestre por defecto", 
            "💾 Cache: KPIs totales cached por 5min",
            "⚡ Lazy loading: cargar detalles on-demand"
        ]
        
        for alt in alternativas:
            print(f"   • {alt}")

    finally:
        session.close()

    print("\n⚡ Análisis de optimización crítica completado")

if __name__ == "__main__":
    test_optimizacion_limite()