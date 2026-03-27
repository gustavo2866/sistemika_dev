#!/usr/bin/env python3
"""
Prueba los nuevos endpoints de alertas del dashboard de proyectos
"""

import requests
from datetime import date, timedelta

# Configuración
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api/dashboard/proyectos"

# Rango de fechas con datos
end_date = date.today()
start_date = end_date - timedelta(days=90)  # 3 meses

def test_dashboard_principal():
    """Prueba el endpoint principal que ya sabemos que funciona"""
    print("🔧 PROBANDO DASHBOARD PRINCIPAL...")
    
    url = f"{API_BASE}/"
    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        alerts = data.get("alerts", {})
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Alertas: {alerts}")
        
        return alerts
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def test_detalle_alerta(alert_key="eventos"):
    """Prueba el endpoint de detalle por alerta"""
    print(f"\n🔍 PROBANDO DETALLE ALERTA: {alert_key}...")
    
    url = f"{API_BASE}/detalle-alerta"
    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "alertKey": alert_key,
        "page": 1,
        "perPage": 5,
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📋 Total proyectos con alerta: {data.get('total', 0)}")
        print(f"   📄 Página: {data.get('page', 0)} de {data.get('perPage', 0)}")
        
        projects = data.get('data', [])
        if projects:
            print(f"   🔸 Ejemplos:")
            for i, proj in enumerate(projects[:3]):
                nombre = proj.get('proyecto', {}).get('nombre', 'N/A')
                print(f"      {i+1}. {nombre}")
        else:
            print(f"   ⚠️ No hay proyectos con alerta '{alert_key}'")
        
        return projects
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def test_alerta_item(proyecto_id, alert_key="eventos"):
    """Prueba el endpoint de verificación de alerta individual"""
    print(f"\n🎯 PROBANDO VERIFICACIÓN INDIVIDUAL: proyecto={proyecto_id}, alerta={alert_key}...")
    
    url = f"{API_BASE}/alerta-item"
    params = {
        "id": proyecto_id,
        "alertKey": alert_key,
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Status: {response.status_code}")
        print(f"   🔍 Resultado: {data}")
        
        has_alert = data.get("hasAlert", False)
        print(f"   {'🚨' if has_alert else '✅'} Proyecto {proyecto_id} {'SÍ TIENE' if has_alert else 'NO TIENE'} alerta '{alert_key}'")
        
        return has_alert
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def main():
    print("🚀 PROBANDO NUEVOS ENDPOINTS DE ALERTAS - PROYECTOS DASHBOARD")
    print("=" * 70)
    
    # 1. Obtener alertas actuales
    alerts = test_dashboard_principal()
    if not alerts:
        print("❌ No se pudieron obtener alertas, cancelando pruebas")
        return
    
    # 2. Probar cada tipo de alerta
    alert_types = ["mensajes", "eventos", "ordenes_rechazadas"]
    first_project_id = None
    
    for alert_type in alert_types:
        if alerts.get(alert_type, 0) > 0:
            print(f"\n   🔍 Alerta '{alert_type}' tiene {alerts[alert_type]} proyectos")
            projects = test_detalle_alerta(alert_type)
            
            if projects and not first_project_id:
                # Tomar el ID del primer proyecto para pruebas individuales
                first_project = projects[0]
                first_project_id = first_project.get('proyecto', {}).get('id')
                
                if first_project_id:
                    test_alerta_item(first_project_id, alert_type)
        else:
            print(f"\n   ⚠️ No hay proyectos con alerta '{alert_type}'")
    
    # 3. Probar con proyecto sin alerta (si tenemos ID)
    if first_project_id:
        # Probar con una alerta que probablemente no tenga
        for alert_type in alert_types:
            if alerts.get(alert_type, 0) == 0:
                test_alerta_item(first_project_id, alert_type)
                break
    
    print("\n" + "=" * 70)
    print("✅ PRUEBAS COMPLETADAS")

if __name__ == "__main__":
    main()