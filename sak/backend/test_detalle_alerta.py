#!/usr/bin/env python3
"""
Test para el endpoint detalle-alerta que estaba fallando
"""

import requests
import sys

try:
    print("🔍 Testing detalle-alerta endpoint...")
    response = requests.get(
        'http://localhost:8000/api/dashboard/proyectos/detalle-alerta', 
        params={
            'startDate': '2025-12-01', 
            'endDate': '2026-01-31',
            'alertKey': 'eventos',
            'perPage': 1
        },
        timeout=10
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ SUCCESS - Total: {data.get('total', 0)}")
        if data.get('data'):
            first_item = data['data'][0]
            print(f"💰 Costo ejecutado: ${first_item.get('costo_ejecutado', 0):,.2f}")
            print(f"📊 Importe ejecutado: ${first_item.get('importe_ejecutado', 0):,.2f}")
    else:
        print(f"❌ ERROR {response.status_code} - Response: {response.text}")
        
except Exception as e:
    print(f"💥 Exception: {e}")
    sys.exit(1)