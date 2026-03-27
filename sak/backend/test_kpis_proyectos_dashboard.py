#!/usr/bin/env python3

from datetime import date, timedelta
from app.db import get_session
from app.services.proyectos_dashboard import (
    _calculate_presupuestado_kpis,
    _calculate_real_kpis,
    _calculate_presupuesto_total_kpis,
    _calculate_real_total_kpis,
    _get_last_4_periods,
    _to_date
)

def test_nuevos_kpis():
    """Probador de los nuevos KPIs implementados"""
    
    with next(get_session()) as db:
        print("=== TESTING NUEVOS KPIs DEL DASHBOARD DE PROYECTOS ===\n")
        
        # Parámetros de prueba
        end_date = date(2025, 12, 31)  # Usar una fecha que cubra datos generados
        proyectos_ids = [14, 15, 16, 17]  # Los proyectos con datos
        
        print(f"🎯 Proyectos: {proyectos_ids}")
        print(f"📅 Fecha límite: {end_date}")
        
        # Obtener períodos
        periods = _get_last_4_periods(end_date)
        print(f"\n📋 Períodos analizados:")
        for i, (start, end) in enumerate(periods):
            print(f"   {i+1}. {start} a {end}")
        
        # 1. KPIs Presupuestados (últimos 4 períodos)
        print("\n=== 1. PRESUPUESTADO (Últimos 4 períodos) ===")
        try:
            kpis_presupuestado = _calculate_presupuestado_kpis(db, proyectos_ids, periods)
            print("✅ Presupuestado:")
            print(f"   💰 Materiales: ${kpis_presupuestado['materiales']:,.2f}")
            print(f"   🔧 MO Propia: ${kpis_presupuestado['mo_propia']:,.2f}")
            print(f"   ⚙️  MO Terceros: ${kpis_presupuestado['mo_terceros']:,.2f}")
            print(f"   💵 Importe: ${kpis_presupuestado['importe']:,.2f}")
            print(f"   ⏰ Horas: {kpis_presupuestado['horas']:,.1f}")
            print(f"   📏 Metros: {kpis_presupuestado['metros']:,.1f}")
        except Exception as e:
            print(f"❌ Error en presupuestado: {e}")
        
        # 2. KPIs Real (últimos 4 períodos)
        print("\n=== 2. REAL (Últimos 4 períodos) ===")
        try:
            kpis_real = _calculate_real_kpis(db, proyectos_ids, periods)
            print("✅ Real:")
            print(f"   💰 Materiales: ${kpis_real['materiales']:,.2f}")
            print(f"   🔧 MO Propia: ${kpis_real['mo_propia']:,.2f}")
            print(f"   ⚙️  MO Terceros: ${kpis_real['mo_terceros']:,.2f}")
            print(f"   💵 Importe: ${kpis_real['importe']:,.2f}")
            print(f"   ⏰ Horas: {kpis_real['horas']:,.1f}")
            print(f"   📐 Superficie: {kpis_real['superficie']:,.2f}")
        except Exception as e:
            print(f"❌ Error en real: {e}")
        
        # 3. Presupuesto Total (desde inicio hasta fecha límite)
        print("\n=== 3. PRESUPUESTO TOTAL ===")
        try:
            kpis_presupuesto_total = _calculate_presupuesto_total_kpis(db, proyectos_ids, end_date)
            print("✅ Presupuesto Total:")
            print(f"   💰 Materiales: ${kpis_presupuesto_total['materiales']:,.2f}")
            print(f"   🔧 MO Propia: ${kpis_presupuesto_total['mo_propia']:,.2f}")
            print(f"   ⚙️  MO Terceros: ${kpis_presupuesto_total['mo_terceros']:,.2f}")
            print(f"   💵 Importe: ${kpis_presupuesto_total['importe']:,.2f}")
            print(f"   ⏰ Horas: {kpis_presupuesto_total['horas']:,.1f}")
            print(f"   📏 Metros: ${kpis_presupuesto_total['metros']:,.1f}")
        except Exception as e:
            print(f"❌ Error en presupuesto total: {e}")
        
        # 4. Real Total (desde inicio hasta fecha límite)
        print("\n=== 4. REAL TOTAL ===")
        try:
            kpis_real_total = _calculate_real_total_kpis(db, proyectos_ids, end_date)
            print("✅ Real Total:")
            print(f"   💰 Materiales: ${kpis_real_total['materiales']:,.2f}")
            print(f"   🔧 MO Propia: ${kpis_real_total['mo_propia']:,.2f}")
            print(f"   ⚙️  MO Terceros: ${kpis_real_total['mo_terceros']:,.2f}")
            print(f"   💵 Importe: ${kpis_real_total['importe']:,.2f}")
            print(f"   ⏰ Horas: {kpis_real_total['horas']:,.1f}")
            print(f"   📐 Superficie: {kpis_real_total['superficie']:,.2f}")
        except Exception as e:
            print(f"❌ Error en real total: {e}")
        
        print("\n🎉 TESTING COMPLETADO")

if __name__ == "__main__":
    test_nuevos_kpis()