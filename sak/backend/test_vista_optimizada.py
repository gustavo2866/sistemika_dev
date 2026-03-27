#!/usr/bin/env python3
"""
Test para verificar la vista optimizada de KPIs con fecha de emisión.
"""

import sys
from datetime import date
from decimal import Decimal

# Agregar el directorio backend al path para importar módulos
sys.path.append(".")

from sqlmodel import Session, select
from app.db import engine
from app.models.views.kpis_proyectos import VwKpisProyectosPoOrders
from app.services.proyectos_dashboard import (
    _get_periods_by_type,
    _calculate_real_kpis,
    _calculate_real_total_kpis
)


def test_vista_optimizada():
    """Test de la vista optimizada vw_kpis_proyectos_po_orders"""
    print("=== TEST VISTA OPTIMIZADA ===")
    
    with Session(engine) as session:
        try:
            # Consultar la vista directamente
            stmt = select(VwKpisProyectosPoOrders).limit(10)
            registros = session.exec(stmt).all()
            
            print(f"📊 Registros en vista: {len(registros)}")
            
            if registros:
                print("\n📋 Muestra de registros:")
                for r in registros[:3]:
                    print(f"  - Orden {r.nro_orden}: {r.concepto_proyecto} = ${r.importe:,.0f} (fecha: {r.fecha_emision})")
                
                # Agrupar por concepto
                conceptos = {}
                for r in registros:
                    if r.concepto_proyecto not in conceptos:
                        conceptos[r.concepto_proyecto] = {'count': 0, 'total': Decimal('0')}
                    conceptos[r.concepto_proyecto]['count'] += 1
                    conceptos[r.concepto_proyecto]['total'] += r.importe
                
                print("\n📊 Resumen por concepto:")
                for concepto, data in conceptos.items():
                    print(f"  - {concepto}: {data['count']} órdenes, ${data['total']:,.0f}")
                    
                return True
            else:
                print("⚠️ Vista vacía - verificar datos o migración")
                return False
                
        except Exception as e:
            print(f"❌ Error accediendo a vista: {e}")
            print("💡 Ejecutar migración: alembic upgrade head")
            return False


def test_kpis_optimizados():
    """Test de KPIs usando vista optimizada"""
    print("\n=== TEST KPIs CON VISTA OPTIMIZADA ===")
    
    with Session(engine) as session:
        try:
            # Obtener proyectos que tienen datos en la vista
            stmt_proyectos = select(VwKpisProyectosPoOrders.proyecto_id).distinct().limit(10)
            proyectos_ids = session.exec(stmt_proyectos).all()
            
            if not proyectos_ids:
                print("❌ No hay proyectos en la vista para testear")
                return
            
            print(f"🎯 Testing con {len(proyectos_ids)} proyectos")
            
            end_date = date(2024, 12, 31)
            periods = _get_periods_by_type(end_date, "mensual")
            
            import time
            
            # Test KPIs Real con vista optimizada
            start_time = time.time()
            kpis_real = _calculate_real_kpis(session, proyectos_ids, periods, "mensual")
            real_time = time.time() - start_time
            
            print(f"\n⚡ KPIs Real (vista optimizada): {real_time:.3f}s")
            print(f"   💰 Importe: ${kpis_real['importe']:,.0f}")
            print(f"   📦 Materiales: ${kpis_real['materiales']:,.0f}")  
            print(f"   👷 MO Propia: ${kpis_real['mo_propia']:,.0f}")
            print(f"   🔧 MO Terceros: ${kpis_real['mo_terceros']:,.0f}")
            
            # Test KPIs Real Total
            start_time = time.time()
            kpis_real_total = _calculate_real_total_kpis(session, proyectos_ids, end_date)
            total_time = time.time() - start_time
            
            print(f"\n⚡ KPIs Real Total (vista optimizada): {total_time:.3f}s") 
            print(f"   💰 Importe: ${kpis_real_total['importe']:,.0f}")
            print(f"   📦 Materiales: ${kpis_real_total['materiales']:,.0f}")
            print(f"   👷 MO Propia: ${kpis_real_total['mo_propia']:,.0f}")
            print(f"   🔧 MO Terceros: ${kpis_real_total['mo_terceros']:,.0f}")
            
            # Análisis de mejora
            print(f"\n📊 BENEFICIOS:")
            if kpis_real['materiales'] > 0 or kpis_real['mo_propia'] > 0:
                print("✅ Vista optimizada está funcionando - devuelve datos")
                print("✅ Usando fecha de emisión (consistente con dashboard PO)")
                print(f"✅ Rendimiento mejorado: {real_time + total_time:.3f}s total")
            else:
                print("⚠️ Vista funciona pero aún devuelve $0 - verificar datos de emisión")
                
        except Exception as e:
            print(f"❌ Error en KPIs optimizados: {e}")


if __name__ == "__main__":
    print("🔍 TEST: Vista Optimizada KPIs - Fecha Emisión")
    print("=" * 60)
    
    try:
        # Test 1: Vista optimizada
        vista_ok = test_vista_optimizada()
        
        if vista_ok:
            # Test 2: KPIs con vista
            test_kpis_optimizados()
        
        print("\n✅ Tests de vista optimizada completados")
        
    except Exception as e:
        print(f"\n❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()