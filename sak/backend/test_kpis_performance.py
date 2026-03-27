#!/usr/bin/env python3
"""
Test de rendimiento y funcionalidad de KPIs Dashboard Proyectos
Mide tiempo de ejecución y verifica resultado con relación oportunidad_id.
"""

import sys
import time
from datetime import date
from decimal import Decimal

# Agregar el directorio backend al path para importar módulos
sys.path.append(".")

from sqlmodel import Session, select
from app.db import engine
from app.models.proyecto import Proyecto
from app.models.compras import PoOrder
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.proyecto_avance import ProyectoAvance
from app.services.proyectos_dashboard import (
    _get_periods_by_type,
    _calculate_presupuestado_kpis,
    _calculate_real_kpis,
    _calculate_presupuesto_total_kpis,
    _calculate_real_total_kpis,
    build_proyectos_dashboard_payload,
    fetch_proyectos_for_dashboard,
    TIPO_COSTO_MAP
)


def measure_time(func, *args, **kwargs):
    """Mide tiempo de ejecución de una función"""
    start_time = time.time()
    result = func(*args, **kwargs)
    end_time = time.time()
    execution_time = end_time - start_time
    return result, execution_time


def test_data_availability():
    """Verifica disponibilidad de datos para testing"""
    print("=== VERIFICACIÓN DE DATOS ===")
    
    with Session(engine) as session:
        # Contar proyectos con oportunidad_id
        proyectos_count = session.exec(
            select(Proyecto).where(Proyecto.oportunidad_id.is_not(None))
        ).all()
        print(f"📊 Proyectos con oportunidad_id: {len(proyectos_count)}")
        
        # Contar po_orders
        po_orders_count = session.exec(select(PoOrder)).all()
        print(f"📦 PO Orders total: {len(po_orders_count)}")
        
        # Contar registros presupuesto
        presupuesto_count = session.exec(select(ProyPresupuesto)).all()
        print(f"💰 Registros proy_presupuesto: {len(presupuesto_count)}")
        
        # Contar avances
        avances_count = session.exec(select(ProyectoAvance)).all() 
        print(f"📈 Registros proyecto_avance: {len(avances_count)}")
        
        # Verificar relación oportunidad_id
        if len(proyectos_count) > 0:
            proyecto_muestra = proyectos_count[0]
            po_relacionadas = session.exec(
                select(PoOrder).where(
                    PoOrder.oportunidad_id == proyecto_muestra.oportunidad_id
                )
            ).all()
            print(f"🔗 Ejemplo proyecto {proyecto_muestra.id} -> oportunidad {proyecto_muestra.oportunidad_id} -> {len(po_relacionadas)} PO orders")
        
        return len(proyectos_count) > 0 and len(po_orders_count) > 0


def test_kpis_performance():
    """Test de rendimiento de funciones KPI individuales"""
    print("\n=== TEST DE RENDIMIENTO KPIs ===")
    
    with Session(engine) as session:
        # Seleccionar proyectos para test 
        proyectos = session.exec(
            select(Proyecto).where(
                Proyecto.oportunidad_id.is_not(None)
            ).limit(20)
        ).all()
        
        if not proyectos:
            print("❌ No hay proyectos con oportunidad_id para testear")
            return
        
        proyectos_ids = [p.id for p in proyectos]
        end_date = date(2024, 12, 31)
        periods = _get_periods_by_type(end_date, "mensual")
        
        print(f"🎯 Testing con {len(proyectos)} proyectos")
        print(f"📅 Períodos: {len(periods)} (mensual)")
        
        # Test 1: KPIs Presupuestados
        kpis_presup, time_presup = measure_time(
            _calculate_presupuestado_kpis, session, proyectos_ids, periods, "mensual"
        )
        print(f"\n1️⃣ KPIs Presupuestados:")
        print(f"   ⏱️  Tiempo: {time_presup:.3f}s")
        print(f"   💰 Importe: ${kpis_presup['importe']:,.0f}")
        print(f"   📦 Materiales: ${kpis_presup['materiales']:,.0f}")
        print(f"   👷 MO Propia: ${kpis_presup['mo_propia']:,.0f}")
        print(f"   🔧 MO Terceros: ${kpis_presup['mo_terceros']:,.0f}")
        
        # Test 2: KPIs Real
        kpis_real, time_real = measure_time(
            _calculate_real_kpis, session, proyectos_ids, periods, "mensual"
        )
        print(f"\n2️⃣ KPIs Real (relación oportunidad_id):")  
        print(f"   ⏱️  Tiempo: {time_real:.3f}s")
        print(f"   💰 Importe: ${kpis_real['importe']:,.0f} (proyecto_avance)")
        print(f"   📦 Materiales: ${kpis_real['materiales']:,.0f} (po_orders)")
        print(f"   👷 MO Propia: ${kpis_real['mo_propia']:,.0f} (po_orders)")
        print(f"   🔧 MO Terceros: ${kpis_real['mo_terceros']:,.0f} (po_orders)")
        
        # Test 3: KPIs Presupuesto Total
        kpis_presup_total, time_presup_total = measure_time(
            _calculate_presupuesto_total_kpis, session, proyectos_ids
        )
        print(f"\n3️⃣ KPIs Presupuesto Total (sin filtro fecha):")
        print(f"   ⏱️  Tiempo: {time_presup_total:.3f}s")
        print(f"   💰 Importe: ${kpis_presup_total['importe']:,.0f}")
        print(f"   📦 Materiales: ${kpis_presup_total['materiales']:,.0f}")
        print(f"   👷 MO Propia: ${kpis_presup_total['mo_propia']:,.0f}")
        print(f"   🔧 MO Terceros: ${kpis_presup_total['mo_terceros']:,.0f}")
        
        # Test 4: KPIs Real Total  
        kpis_real_total, time_real_total = measure_time(
            _calculate_real_total_kpis, session, proyectos_ids, end_date
        )
        print(f"\n4️⃣ KPIs Real Total (hasta fecha límite):")
        print(f"   ⏱️  Tiempo: {time_real_total:.3f}s")
        print(f"   💰 Importe: ${kpis_real_total['importe']:,.0f}")
        print(f"   📦 Materiales: ${kpis_real_total['materiales']:,.0f}")
        print(f"   👷 MO Propia: ${kpis_real_total['mo_propia']:,.0f}")
        print(f"   🔧 MO Terceros: ${kpis_real_total['mo_terceros']:,.0f}")
        
        # Resumen de rendimiento
        total_time = time_presup + time_real + time_presup_total + time_real_total
        print(f"\n⏱️  RESUMEN RENDIMIENTO:")
        print(f"   Total KPIs: {total_time:.3f}s")
        print(f"   Promedio por KPI: {total_time/4:.3f}s")
        
        # Análisis de resultados
        print(f"\n📊 ANÁLISIS:")
        if kpis_real['materiales'] > 0 or kpis_real['mo_propia'] > 0:
            print("✅ Relación oportunidad_id funcionando - po_orders devuelve datos")
        else:
            print("⚠️ po_orders devuelve $0 - verificar datos o relación")
            
        if kpis_presup_total['importe'] >= kpis_presup['importe']:
            print("✅ Presupuesto Total >= Presupuesto Períodos (lógico)")
        else:
            print("⚠️ Presupuesto Total < Presupuesto Períodos (verificar)")


def test_dashboard_completo_performance():
    """Test de rendimiento del dashboard completo"""
    print("\n=== TEST DASHBOARD COMPLETO ===")
    
    with Session(engine) as session:
        # Parámetros de prueba
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        # Test fetch_proyectos_for_dashboard
        items, time_fetch = measure_time(
            fetch_proyectos_for_dashboard,
            session, start_date, end_date
        )
        print(f"📋 Fetch proyectos: {time_fetch:.3f}s ({len(items)} proyectos)")
        
        if not items:
            print("❌ No hay proyectos para el dashboard")
            return
        
        # Test build_proyectos_dashboard_payload completo
        payload, time_payload = measure_time(
            build_proyectos_dashboard_payload,
            items, start_date, end_date, 5, {}, session, "mensual"
        )
        
        print(f"🏗️  Build dashboard payload: {time_payload:.3f}s")
        print(f"📊 Total dashboard: {time_fetch + time_payload:.3f}s")
        
        # Mostrar resultados del payload
        if 'kpis' in payload:
            kpis = payload['kpis']
            print(f"\n📈 KPIs Dashboard:")
            for kpi_type, kpi_data in kpis.items():
                if isinstance(kpi_data, dict) and 'importe' in kpi_data:
                    print(f"   {kpi_type}: ${kpi_data['importe']:,.0f}")
        
        # Evaluar rendimiento
        total_time = time_fetch + time_payload
        if total_time < 2.0:
            print(f"🚀 Rendimiento EXCELENTE: {total_time:.3f}s")
        elif total_time < 5.0:
            print(f"✅ Rendimiento BUENO: {total_time:.3f}s")
        elif total_time < 10.0:
            print(f"⚠️ Rendimiento ACEPTABLE: {total_time:.3f}s")
        else:
            print(f"🐌 Rendimiento LENTO: {total_time:.3f}s - Optimizar")


if __name__ == "__main__":
    print("🔍 TEST: Rendimiento KPIs Dashboard Proyectos")
    print("=" * 60)
    
    try:
        # Verificar datos disponibles
        has_data = test_data_availability()
        
        if not has_data:
            print("\n❌ No hay suficientes datos para testing")
            exit(1)
        
        # Test rendimiento individual
        test_kpis_performance()
        
        # Test dashboard completo
        test_dashboard_completo_performance()
        
        print(f"\n✅ Tests de rendimiento completados")
        
    except Exception as e:
        print(f"\n❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()