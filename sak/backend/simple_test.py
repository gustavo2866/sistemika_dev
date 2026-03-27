#!/usr/bin/env python3
"""
Simple test para el endpoint principal
"""

import requests
import sys

try:
    print("🔍 Testing main dashboard endpoint...")
    response = requests.get(
        'http://localhost:8000/api/dashboard/proyectos', 
        params={'startDate': '2025-12-01', 'endDate': '2026-01-31'},
        timeout=10
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ SUCCESS - Response keys: {list(data.keys())}")
        alertas = data.get('alerts', {})
        print(f"📊 Alertas: {alertas}")
    else:
        print(f"❌ ERROR - Response: {response.text}")
        
except Exception as e:
    print(f"💥 Exception: {e}")
    sys.exit(1)