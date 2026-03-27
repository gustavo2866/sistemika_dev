#!/usr/bin/env python3
"""
Mostrar estructura completa del dashboard principal
"""

import requests
import json

try:
    print("📊 DASHBOARD PRINCIPAL - Estructura de respuesta")
    print("=" * 60)
    
    response = requests.get(
        'http://localhost:8000/api/dashboard/proyectos', 
        params={'startDate': '2025-12-01', 'endDate': '2026-01-31'},
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        
        print("🎯 SECCIONES PRINCIPALES:")
        for key in data.keys():
            print(f"   📦 {key}")
        
        print(f"\n🗓️  PERÍODO:")
        periodo = data.get('periodo', {})
        print(f"   Inicio: {periodo.get('start')}")
        print(f"   Fin: {periodo.get('end')}")
        
        print(f"\n🔍 FILTROS APLICADOS:")
        filtros = data.get('filtros', {})
        for filtro, valor in filtros.items():
            print(f"   {filtro}: {valor}")
        
        print(f"\n📈 KPIs PRINCIPALES:")
        kpis = data.get('kpis_nuevos', {})
        
        if 'presupuestado' in kpis:
            pres = kpis['presupuestado']
            print(f"   💰 PRESUPUESTADO:")
            print(f"      - Importe: ${pres.get('importe', 0):,.2f}")
            print(f"      - Materiales: ${pres.get('materiales', 0):,.2f}")
            print(f"      - MO Propia: ${pres.get('mo_propia', 0):,.2f}")
            print(f"      - MO Terceros: ${pres.get('mo_terceros', 0):,.2f}")
        
        if 'real' in kpis:
            real = kpis['real']
            print(f"   ✅ REAL/EJECUTADO:")
            print(f"      - Importe: ${real.get('importe', 0):,.2f}")
            print(f"      - Materiales: ${real.get('materiales', 0):,.2f}")  
            print(f"      - MO Propia: ${real.get('mo_propia', 0):,.2f}")
            print(f"      - MO Terceros: ${real.get('mo_terceros', 0):,.2f}")
            print(f"      - Horas: {real.get('horas', 0):,.0f}h")
        
        print(f"\n🚨 ALERTAS:")
        alerts = data.get('alerts', {})
        for tipo_alerta, cantidad in alerts.items():
            emoji = "🔴" if cantidad > 0 else "🟢"
            print(f"   {emoji} {tipo_alerta}: {cantidad}")
            
        print(f"\n📊 TOTAL DE SECCIONES EN RESPUESTA: {len(data.keys())}")
        
    else:
        print(f"❌ ERROR {response.status_code}: {response.text}")
        
except Exception as e:
    print(f"💥 Error: {e}")