#!/usr/bin/env python3
"""
Prueba el nuevo campo costo_ejecutado en los endpoints de detalle
INCLUYENDO MEDICIÓN DE PERFORMANCE
"""

import requests
import time
from datetime import date, timedelta

# Configuración
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api/dashboard/proyectos"

# Rango de fechas con datos
end_date = date.today()
start_date = end_date - timedelta(days=90)  # 3 meses

def measure_endpoint_performance(name):
    """Decorator para medir performance de endpoints"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            print(f"⏱️  {name}...")
            start_time = time.time()
            result = func(*args, **kwargs)
            end_time = time.time()
            duration = end_time - start_time
            
            if duration < 0.5:
                print(f"   🔥 Tiempo: {duration*1000:.0f}ms (Excelente)")
            elif duration < 1.0:
                print(f"   ⚡ Tiempo: {duration*1000:.0f}ms (Bueno)")
            else:
                print(f"   🐌 Tiempo: {duration:.2f}s (Mejorable)")
                
            return result
        return wrapper
    return decorator

@measure_endpoint_performance("DASHBOARD PRINCIPAL")
def test_dashboard_principal():
    """Baseline - endpoint principal para comparar"""
    url = f"{API_BASE}/"
    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Status: {response.status_code}")
        alerts = data.get("alerts", {})
        print(f"   📊 Alertas: {sum(alerts.values())} total")
        
        return data
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

@measure_endpoint_performance("DETALLE CON COSTO EJECUTADO")  
def test_detalle_con_costo_ejecutado():
    """Prueba el endpoint de detalle general verificando que incluya costo_ejecutado"""
    
    url = f"{API_BASE}/detalle"
    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "kpiKey": "todos",  # Cambio a "todos" para obtener más proyectos
        "page": 1,
        "perPage": 10,  # Más proyectos para probar performance
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Total proyectos: {data.get('total', 0)}")
        
        projects = data.get('data', [])
        if projects:
            # Calcular estadísticas de costos
            total_importe = sum(p.get('importe_ejecutado', 0) for p in projects)
            total_costo = sum(p.get('costo_ejecutado', 0) for p in projects)
            proyectos_con_costo = len([p for p in projects if p.get('costo_ejecutado', 0) > 0])
            
            print(f"   💰 Total importe ejecutado: ${total_importe:,.2f}")
            print(f"   💸 Total costo ejecutado: ${total_costo:,.2f}")
            print(f"   🔗 Proyectos con órdenes: {proyectos_con_costo}/{len(projects)}")
            
        return projects
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

@measure_endpoint_performance("DETALLE ALERTA CON COSTO")
def test_detalle_alerta_con_costo():
    """Prueba el endpoint de detalle por alerta verificando performance"""
    
    url = f"{API_BASE}/detalle-alerta"
    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "alertKey": "eventos",
        "page": 1,
        "perPage": 10,
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Proyectos con alerta: {data.get('total', 0)}")
        
        projects = data.get('data', [])
        if projects:
            costos_calculados = len([p for p in projects if 'costo_ejecutado' in p])
            print(f"   🧮 Costos calculados: {costos_calculados}/{len(projects)}")
        
        return projects
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

@measure_endpoint_performance("ORDENAMIENTO POR COSTO")
def test_ordenamiento_por_costo():
    """Prueba el ordenamiento por costo_ejecutado y su performance"""
    
    url = f"{API_BASE}/detalle"
    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "kpiKey": "todos",
        "orderBy": "costo_ejecutado",
        "orderDir": "desc",
        "page": 1,
        "perPage": 20,  # Más items para probar performance de ordenamiento
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Total proyectos: {data.get('total', 0)}")
        
        projects = data.get('data', [])
        if len(projects) > 1:
            # Verificar que el ordenamiento funciona
            first_cost = projects[0].get('costo_ejecutado', 0)
            last_cost = projects[-1].get('costo_ejecutado', 0)
            print(f"   📈 Ordenamiento DESC: ${first_cost:,.2f} → ${last_cost:,.2f}")
        
        return projects
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

@measure_endpoint_performance("PAGINACIÓN GRANDE")
def test_paginacion_grande():
    """Prueba performance con paginación más grande"""
    
    url = f"{API_BASE}/detalle"
    params = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "kpiKey": "todos",
        "page": 1,
        "perPage": 50,  # Página grande para probar performance
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Proyectos obtenidos: {len(data.get('data', []))}/{data.get('total', 0)}")
        
        projects = data.get('data', [])
        queries_ejecutadas = len([p for p in projects if p.get('proyecto', {}).get('oportunidad_id')])
        print(f"   🔍 Queries de costo ejecutadas: ~{queries_ejecutadas}")
        
        return projects
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def main():
    print("🚀 ANÁLISIS DE PERFORMANCE - PROYECTOS DASHBOARD CON COSTO EJECUTADO")
    print("=" * 80)
    
    # BASELINE: Dashboard principal (sin costo_ejecutado)
    print("\n📊 BASELINE:")
    test_dashboard_principal()
    
    # PRUEBAS DE PERFORMANCE CON COSTO EJECUTADO
    print("\n🏃‍♂️ PRUEBAS DE PERFORMANCE:")
    
    # 1. Detalle básico
    test_detalle_con_costo_ejecutado()
    
    # 2. Detalle por alerta  
    test_detalle_alerta_con_costo()
    
    # 3. Ordenamiento (más complejo computacionalmente)
    test_ordenamiento_por_costo()
    
    # 4. Paginación grande (más queries de costo)
    test_paginacion_grande()
    
    print("\n" + "=" * 80)
    print("📈 ANÁLISIS DE PERFORMANCE COMPLETADO")
    print("\n💡 CONSIDERACIONES DE PERFORMANCE:")
    print("   🔥 <500ms : Excelente")
    print("   ⚡ 500ms-1s : Bueno") 
    print("   🐌 >1s : Mejorable - considerar optimizaciones")
    print("\n🔍 FACTORES QUE IMPACTAN PERFORMANCE:")
    print("   📊 Cantidad de proyectos en la respuesta")
    print("   🔗 Cantidad de proyectos con oportunidad_id (queries adicionales)")  
    print("   💾 Complejidad del ordenamiento y filtrado")
    print("   🏗️ Estado de la base de datos y índices")

if __name__ == "__main__":
    main()