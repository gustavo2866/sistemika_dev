#!/usr/bin/env python3
"""
Test de la NUEVA ESTRATEGIA OPTIMIZADA de 8 pasos
"""

import sys
import os
from pathlib import Path

# Configurar path correctamente
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Imports después de configurar el path
from sqlmodel import Session, create_engine
from app.services.proyectos_dashboard import fetch_proyectos_for_dashboard, build_proyectos_dashboard_payload
from datetime import datetime, timedelta
import time
from dotenv import load_dotenv

def get_database_session():
    """Crear sesión de base de datos"""
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")
    
    # Conectar a la base de datos
    engine = create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    
    return Session(engine)

async def test_nueva_estrategia_8_pasos():
    """Prueba la NUEVA ESTRATEGIA OPTIMIZADA de 8 pasos"""
    
    # Fecha range para el último mes
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")
    
    print(f"🚀 TEST NUEVA ESTRATEGIA OPTIMIZADA (8 PASOS)")
    print(f"📅 Rango: {start_date_str} a {end_date_str}")
    print(f"=" * 70)
    print(f"")
    print(f"📋 ESTRATEGIA IMPLEMENTADA:")
    print(f"   PASO 1: presupuesto_detalle (1 query + JOIN)")
    print(f"   PASO 2: presupuesto_periodo (procesamiento Python)")
    print(f"   PASO 3: presupuesto_total (reutiliza paso 1)")
    print(f"   PASO 4: real_costo_detalle (1 query vista optimizada)")
    print(f"   PASO 5: real_costo_periodo (procesamiento Python)")
    print(f"   PASO 6: real_costo_total (reutiliza paso 4)")
    print(f"   PASO 7: ingreso_periodo (1 query avances)")  
    print(f"   PASO 8: ingreso_total (reutiliza paso 7)")
    print(f"=" * 70)
    
    session = get_database_session()
    
    try:
        # Test completo con timing detallado
        print(f"\\n⏱️  FETCH PROYECTOS (CON LIMIT 15 Y BATCH QUERIES)")
        start_time = time.time()
        
        proyectos = fetch_proyectos_for_dashboard(
            session=session,
            start_date=start_date_str,
            end_date=end_date_str
        )
        
        fetch_time = time.time() - start_time
        print(f"   📊 Proyectos obtenidos: {len(proyectos)}")
        print(f"   ⏰ Tiempo fetch: {fetch_time:.3f}s")
        
        # Test del payload con NUEVA ESTRATEGIA
        print(f"\\n⏱️  PAYLOAD COMPLETO - NUEVA ESTRATEGIA 8 PASOS")
        start_time = time.time()
        
        payload = build_proyectos_dashboard_payload(
            items=proyectos,
            start_date=start_date_str,
            end_date=end_date_str,
            session=session
        )
        
        total_time = time.time() - start_time
        print(f"   📈 Payload keys: {list(payload.keys())}")
        print(f"   ⏰ Tiempo total: {total_time:.3f}s")
        
        # Análisis detallado de KPIs
        print(f"\\n📊 ANÁLISIS DE KPIs CALCULADOS")
        if 'kpis_nuevos' in payload:
            kpis_nuevos = payload['kpis_nuevos']
            
            print(f"   📈 PRESUPUESTADO:")
            if 'presupuestado' in kpis_nuevos:
                pres = kpis_nuevos['presupuestado']
                print(f"       - Total: ${pres.get('importe', 0):,.2f}")
                print(f"       - MO Propia: ${pres.get('mo_propia', 0):,.2f}")
                print(f"       - MO Terceros: ${pres.get('mo_terceros', 0):,.2f}")
                print(f"       - Materiales: ${pres.get('materiales', 0):,.2f}")
                print(f"       - Períodos: {len(pres.get('por_periodo', []))}")
            
            print(f"   📈 REAL:")
            if 'real' in kpis_nuevos:
                real = kpis_nuevos['real']
                print(f"       - Total: ${real.get('importe', 0):,.2f}")
                print(f"       - MO Propia: ${real.get('mo_propia', 0):,.2f}") 
                print(f"       - MO Terceros: ${real.get('mo_terceros', 0):,.2f}")
                print(f"       - Materiales: ${real.get('materiales', 0):,.2f}")
                print(f"       - Horas: {real.get('horas', 0):,.1f}")
                print(f"       - Períodos: {len(real.get('por_periodo', []))}")
            
            print(f"   📈 TOTALES:")
            if 'presupuesto_total' in kpis_nuevos:
                pres_total = kpis_nuevos['presupuesto_total']
                print(f"       - Presupuesto Total: ${pres_total.get('importe', 0):,.2f}")
            
            if 'real_total' in kpis_nuevos:
                real_total = kpis_nuevos['real_total']
                print(f"       - Real Total: ${real_total.get('importe', 0):,.2f}")
        
        # Comparación con versiones anteriores
        tiempo_original = 6.4  # Tiempo original sin optimizaciones
        tiempo_optimizado = 1.68  # Tiempo con optimizaciones básicas
        
        print(f"\\n🎯 COMPARACIÓN DE PERFORMANCE")
        print(f"   ⏰ Tiempo original (sin opt): ~{tiempo_original:.1f}s")
        print(f"   ⏰ Tiempo optimizado básico: ~{tiempo_optimizado:.1f}s") 
        print(f"   ⏰ Tiempo NUEVA ESTRATEGIA: {total_time:.3f}s")
        
        mejora_vs_original = ((tiempo_original - total_time) / tiempo_original) * 100
        mejora_vs_optimizado = ((tiempo_optimizado - total_time) / tiempo_optimizado) * 100
        
        print(f"   📈 Mejora vs original: {mejora_vs_original:.1f}%")
        print(f"   📈 Mejora vs optimizado: {mejora_vs_optimizado:.1f}%")
        
        if total_time < 0.5:
            print(f"   ✅ EXCELENTE: < 0.5 segundos!")
        elif total_time < 1.0:
            print(f"   ✅ MUY BUENO: < 1 segundo")
        elif total_time < 1.5:
            print(f"   ⚡ BUENO: < 1.5 segundos")
        else:
            print(f"   ⚠️  Aceptable pero mejorable")
        
        # Verificar integridad de datos
        print(f"\\n🔍 VERIFICACIÓN DE INTEGRIDAD")
        checks_passed = 0
        total_checks = 0
        
        # Check 1: KPIs nuevos existen
        total_checks += 1
        if 'kpis_nuevos' in payload:
            print(f"   ✅ KPIs nuevos presentes")
            checks_passed += 1
        else:
            print(f"   ❌ KPIs nuevos faltantes")
        
        # Check 2: Todos los KPIs requeridos
        if 'kpis_nuevos' in payload:
            kpis_requeridos = ['presupuestado', 'real', 'presupuesto_total', 'real_total']
            for kpi in kpis_requeridos:
                total_checks += 1
                if kpi in payload['kpis_nuevos']:
                    print(f"   ✅ KPI '{kpi}' presente")
                    checks_passed += 1
                else:
                    print(f"   ❌ KPI '{kpi}' faltante")
        
        # Check 3: Datos no vacíos
        total_checks += 1
        if len(proyectos) > 0:
            print(f"   ✅ Datos de proyectos obtenidos ({len(proyectos)} proyectos)")
            checks_passed += 1
        else:
            print(f"   ⚠️  Sin datos de proyectos")
        
        print(f"\\n📋 RESUMEN FINAL")
        print(f"   🎯 Performance: {total_time:.3f}s")
        print(f"   ✅ Verificaciones: {checks_passed}/{total_checks}")
        print(f"   📊 Proyectos: {len(proyectos)}")
        print(f"   🚀 Estrategia: 8 pasos optimizados")
        
        if checks_passed == total_checks and total_time < 1.0:
            print(f"\\n🎉 IMPLEMENTACIÓN EXITOSA - NUEVA ESTRATEGIA FUNCIONANDO PERFECTAMENTE!")
        elif checks_passed == total_checks:
            print(f"\\n✅ IMPLEMENTACIÓN CORRECTA - Performance aceptable")
        else:
            print(f"\\n⚠️  IMPLEMENTACIÓN PARCIAL - Revisar verificaciones fallidas")
            
    except Exception as e:
        print(f"❌ Error en prueba: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_nueva_estrategia_8_pasos())