#!/usr/bin/env python3
"""
Probar dashboard completo con período específico después de corrección
"""
import sys
from pathlib import Path

# Agregar directorio app al path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

from app.services.proyectos_dashboard import (
    build_proyectos_dashboard_payload,
    fetch_proyectos_for_dashboard,
)
from app.db import get_session
import time
from datetime import datetime

def test_dashboard_completo():
    """Test del dashboard completo con período específico con datos"""
    
    print("🔍 TEST: Dashboard Completo Post-Corrección")
    print("=" * 55)
    
    session = next(get_session())
    
    try:
        
        # 1. Test con período donde sabemos que hay datos (2026-03)
        print("1️⃣ TEST PERÍODO MARZO 2026 (donde hay más datos)")
        
        start_time = time.time()
        
        try:
            # Usar período específico de marzo 2026
            start_date = "2026-03-01"
            end_date = "2026-03-31"
            
            # Fetch proyectos usando la misma función del router
            items = fetch_proyectos_for_dashboard(
                session=session,
                start_date=start_date,
                end_date=end_date,
            )
            
            fetch_time = time.time()
            print(f"   ⏱️  Fetch proyectos: {fetch_time - start_time:.3f}s")
            print(f"   📊 Proyectos encontrados: {len(items)}")
            
            # Construir dashboard payload
            payload = build_proyectos_dashboard_payload(
                items,
                start_date=start_date,
                end_date=end_date,
                limit_top=5,
                filters={},
                session=session,
                periodo_tipo="mensual",
            )
            
            total_time = time.time() - start_time
            print(f"   ⏱️  Tiempo total: {total_time:.3f}s")
            
            # Verificar KPIs presentes
            kpis = payload.get('kpis', {})
            print(f"   📈 KPIs disponibles:")
            
            # Presupuestado
            presupuestado = kpis.get('presupuestado', {})
            print(f"      💰 Presupuestado: ${presupuestado.get('importe', 0):,.0f}")
            print(f"      📦 Materiales: ${presupuestado.get('materiales', 0):,.0f}")
            print(f"      👷 MO Propia: ${presupuestado.get('mo_propia', 0):,.0f}")
            print(f"      🔧 MO Terceros: ${presupuestado.get('mo_terceros', 0):,.0f}")
            
            # Real
            real = kpis.get('real', {})
            print(f"      💸 Real Importe: ${real.get('importe', 0):,.0f}")
            print(f"      📦 Real Materiales: ${real.get('materiales', 0):,.0f}")
            print(f"      👷 Real MO Propia: ${real.get('mo_propia', 0):,.0f}")
            print(f"      🔧 Real MO Terceros: ${real.get('mo_terceros', 0):,.0f}")
            
            # Totales
            presupuesto_total = kpis.get('presupuesto_total', {})
            real_total = kpis.get('real_total', {})
            print(f"      📊 Presupuesto Total: ${presupuesto_total.get('importe', 0):,.0f}")
            print(f"      📊 Real Total: ${real_total.get('importe', 0):,.0f}")
            
            # Verificar detalle de proyectos
            proyectos = payload.get('proyectos', [])
            if proyectos:
                print(f"   📋 Detalle proyectos (primeros 3):")
                for i, proyecto in enumerate(proyectos[:3]):
                    print(f"      P{proyecto.get('id')}: {proyecto.get('nombre', '')[:30]}...")
            
            # Evaluar resultados
            total_presupuestado = presupuestado.get('importe', 0)
            total_real_valores = [
                real.get('importe', 0),
                real.get('materiales', 0), 
                real.get('mo_propia', 0),
                real.get('mo_terceros', 0)
            ]
            total_real = sum(total_real_valores)
            
            print(f"   📈 Evaluación:")
            if total_presupuestado > 0:
                print(f"      ✅ Presupuestado funcionando: ${total_presupuestado:,.0f}")
            else:
                print(f"      ⚠️ Presupuestado en $0")
                
            if total_real > 0:
                print(f"      ✅ Real funcionando: ${total_real:,.0f}")
                # Verificar si refleja la corrección de >$600M en MO Propia
                mo_propia_real = real.get('mo_propia', 0)
                if mo_propia_real > 100_000_000:  # >$100M indica corrección exitosa
                    print(f"      🎉 ¡CORRECCIÓN EXITOSA! MO Propia: ${mo_propia_real:,.0f}")
                    print(f"      📊 Corrección de órdenes reflejada en dashboard")
            else:
                print(f"      ⚠️ Real en $0")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
            import traceback
            traceback.print_exc()
        
        # 2. Test período completo rango que sabemos tiene datos
        print(f"\n2️⃣ TEST RANGO COMPLETO 2025-12 a 2026-03")
        
        start_time = time.time()
        
        try:
            # Período que sabemos tiene datos según test de precisión
            start_date_full = "2025-12-01"
            end_date_full = "2026-03-31"
            
            items_full = fetch_proyectos_for_dashboard(
                session=session,
                start_date=start_date_full,
                end_date=end_date_full,
            )
            
            payload_full = build_proyectos_dashboard_payload(
                items_full,
                start_date=start_date_full,
                end_date=end_date_full,
                limit_top=5,
                filters={},
                session=session,
                periodo_tipo="mensual",
            )
            
            full_time = time.time() - start_time
            print(f"   ⏱️  Tiempo rango completo: {full_time:.3f}s")
            
            full_kpis = payload_full.get('kpis', {})
            full_real = full_kpis.get('real', {})
            full_total_real = sum([
                full_real.get('materiales', 0),
                full_real.get('mo_propia', 0), 
                full_real.get('mo_terceros', 0)
            ])
            
            print(f"   💰 Real Total Rango: ${full_total_real:,.0f}")
            print(f"   📊 Proyectos: {len(payload_full.get('proyectos', []))}")
            
            # Verificar los valores esperados del test de precisión
            expected_mo_propia = 640_556_922  # De test de precisión
            expected_materiales = 32_315_208
            expected_mo_terceros = 21_194_013
            
            actual_mo_propia = full_real.get('mo_propia', 0)
            actual_materiales = full_real.get('materiales', 0)
            actual_mo_terceros = full_real.get('mo_terceros', 0)
            
            print(f"   📊 Comparación con test precisión:")
            print(f"      MO Propia: ${actual_mo_propia:,.0f} (esperado: ${expected_mo_propia:,.0f})")
            print(f"      Materiales: ${actual_materiales:,.0f} (esperado: ${expected_materiales:,.0f})")
            print(f"      MO Terceros: ${actual_mo_terceros:,.0f} (esperado: ${expected_mo_terceros:,.0f})")
            
            if actual_mo_propia > 600_000_000:  # 600M+ confirma corrección
                print(f"   🎉 ¡PERFECTO! Dashboard refleja corrección masiva de datos")
            
        except Exception as e:
            print(f"   ❌ Error rango completo: {e}")

    finally:
        session.close()

    print("\n✅ Test dashboard completo terminado")

if __name__ == "__main__":
    test_dashboard_completo()