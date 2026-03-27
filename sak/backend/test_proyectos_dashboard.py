#!/usr/bin/env python3

import requests
import json
from datetime import datetime, timedelta

# URL base de la API
BASE_URL = "http://localhost:8000"

def test_proyectos_dashboard():
    """Prueba los endpoints del dashboard de proyectos"""
    
    print("=== TESTING PROYECTOS DASHBOARD ENDPOINTS ===\n")
    
    # Fechas de prueba
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=365)  # Último año
    
    endpoints = [
        {
            "name": "Dashboard Principal",
            "url": f"{BASE_URL}/api/dashboard/proyectos",
            "params": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "limitTop": 3
            }
        },
        {
            "name": "Selectores",
            "url": f"{BASE_URL}/api/dashboard/proyectos/selectors",
            "params": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat()
            }
        },
        {
            "name": "Métricas de Avance",
            "url": f"{BASE_URL}/api/dashboard/proyectos/metricas-avance",
            "params": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat()
            }
        },
        {
            "name": "Alertas",
            "url": f"{BASE_URL}/api/dashboard/proyectos/alertas",
            "params": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat()
            }
        },
        {
            "name": "Detalle General",
            "url": f"{BASE_URL}/api/dashboard/proyectos/detalle",
            "params": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "kpiKey": "activos",
                "page": 1,
                "perPage": 5
            }
        }
    ]
    
    for endpoint in endpoints:
        print(f"🔍 Testing: {endpoint['name']}")
        print(f"   URL: {endpoint['url']}")
        
        try:
            response = requests.get(endpoint['url'], params=endpoint['params'], timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Status: {response.status_code}")
                print(f"   📄 Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                
                # Mostrar información específica según el endpoint
                if "dashboard/proyectos" == endpoint['url'].split('/')[-1]:
                    # Dashboard principal
                    kpis = data.get("kpis", {})
                    print(f"   📊 KPIs: {kpis.get('total_proyectos', 0)} proyectos, {kpis.get('proyectos_activos', 0)} activos")
                
                elif "selectors" in endpoint['url']:
                    # Selectores
                    print(f"   🎯 Total proyectos: {data.get('total', 0)}")
                    estados = data.get('por_estado', {})
                    print(f"   📋 Estados: {len(estados)} diferentes")
                
                elif "metricas-avance" in endpoint['url']:
                    # Métricas de avance
                    resumen = data.get("resumen", {})
                    print(f"   📈 Avance prom. ponderado: {resumen.get('avance_promedio_ponderado', 0)}%")
                    print(f"   🏁 Completados: {resumen.get('completados', 0)}")
                
                elif "alertas" in endpoint['url']:
                    # Alertas
                    totales = data.get("totales", {})
                    print(f"   ⚠️  Total alertas: {totales.get('total_alertas', 0)}")
                
                elif "detalle" in endpoint['url']:
                    # Detalle
                    total = data.get("total", 0)
                    page_data = data.get("data", [])
                    print(f"   📝 Total registros: {total}, en esta página: {len(page_data)}")
                    
            else:
                print(f"   ❌ Status: {response.status_code}")
                print(f"   🚨 Error: {response.text[:200]}...")
                
        except requests.exceptions.RequestException as e:
            print(f"   💥 Connection Error: {e}")
        except Exception as e:
            print(f"   💥 Unexpected Error: {e}")
            
        print()

if __name__ == "__main__":
    print("Asegúrate de que el servidor esté corriendo en http://localhost:8000")
    print("Ejecuta: uvicorn app.main:app --reload\n")
    
    test_proyectos_dashboard()