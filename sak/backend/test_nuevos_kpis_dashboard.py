#!/usr/bin/env python3

from datetime import date, datetime, timedelta
from app.db import get_session
from app.services.proyectos_dashboard import (
    fetch_proyectos_for_dashboard,
    build_proyectos_dashboard_payload,
    _get_last_4_periods
)

def test_nuevos_kpis_dashboard():
    """Prueba los nuevos KPIs del dashboard de proyectos"""
    
    with next(get_session()) as session:
        print("=== TESTING NUEVOS KPIs DASHBOARD PROYECTOS ===\n")
        
        # Fechas de prueba
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=365)  # Último año
        
        print(f"📅 Período: {start_date} a {end_date}")
        
        # Probar períodos
        periods = _get_last_4_periods(end_date)
        print(f"\n📊 PERÍODOS CALCULADOS:")
        for i, (period_start, period_end) in enumerate(periods):
            print(f"  {i+1}. {period_start} a {period_end}")
        
        # Obtener datos de proyectos
        print(f"\n🔄 Obteniendo datos de proyectos...")
        items = fetch_proyectos_for_dashboard(
            session=session,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
        )
        
        print(f"📋 Proyectos encontrados: {len(items)}")
        
        if not items:
            print("❌ No se encontraron proyectos para procesar")
            return
        
        # Construir payload con nuevos KPIs
        print(f"\n🔄 Calculando KPIs...")
        payload = build_proyectos_dashboard_payload(
            items=items,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            limit_top=3,
            session=session
        )
        
        # Mostrar resultados
        print(f"\n✅ KPIs BÁSICOS (compatibilidad):")
        kpis_basicos = payload["kpis"]
        for key, value in kpis_basicos.items():
            print(f"  - {key}: {value}")
        
        print(f"\n🆕 NUEVOS KPIs SOLICITADOS:")
        kpis_nuevos = payload["kpis_nuevos"]
        
        print(f"\n1. 📊 PRESUPUESTADO (últimos 4 períodos):")
        presup = kpis_nuevos["presupuestado"]
        print(f"   - Materiales: ${presup['materiales']:,.2f}")
        print(f"   - MO Propia: ${presup['mo_propia']:,.2f}")
        print(f"   - MO Terceros: ${presup['mo_terceros']:,.2f}")
        print(f"   - Importe: ${presup['importe']:,.2f}")
        print(f"   - Horas: {presup['horas']:,.2f}")
        print(f"   - Metros: {presup['metros']:,.2f}")
        
        print(f"\n   📅 Por período:")
        for periodo_data in presup["por_periodo"]:
            print(f"     {periodo_data['periodo']}: Importe ${periodo_data['importe']:,.2f}")
        
        print(f"\n2. 💼 REAL (últimos 4 períodos):")
        real = kpis_nuevos["real"]
        print(f"   - Materiales: ${real['materiales']:,.2f}")
        print(f"   - MO Propia: ${real['mo_propia']:,.2f}")
        print(f"   - MO Terceros: ${real['mo_terceros']:,.2f}")
        print(f"   - Importe: ${real['importe']:,.2f}")
        print(f"   - Horas: {real['horas']:,.2f}")
        print(f"   - Superficie: {real['superficie']:,.2f}")
        
        print(f"\n   📅 Por período:")
        for periodo_data in real["por_periodo"]:
            print(f"     {periodo_data['periodo']}: Importe ${periodo_data['importe']:,.2f}")
        
        print(f"\n3. 🎯 PRESUPUESTO TOTAL (todos los períodos):")
        total = kpis_nuevos["presupuesto_total"]
        print(f"   - Materiales: ${total['materiales']:,.2f}")
        print(f"   - MO Propia: ${total['mo_propia']:,.2f}")
        print(f"   - MO Terceros: ${total['mo_terceros']:,.2f}")
        print(f"   - Importe: ${total['importe']:,.2f}")
        print(f"   - Horas: {total['horas']:,.2f}")
        print(f"   - Metros: {total['metros']:,.2f}")
        
        print(f"\n🎉 TEST COMPLETADO EXITOSAMENTE")

if __name__ == "__main__":
    test_nuevos_kpis_dashboard()