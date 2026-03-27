#!/usr/bin/env python3
"""
Análisis del estado del patrón CRM-Dashboard para /api/dashboard/proyectos
"""

import requests
import json
from datetime import date, timedelta

BASE_URL = "http://localhost:8000/api/dashboard/proyectos"

def test_endpoint(path, params=None, description=""):
    """Test individual de un endpoint"""
    try:
        url = f"{BASE_URL}{path}"
        response = requests.get(url, params=params or {}, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict):
                if 'data' in data and 'total' in data:
                    # Formato paginado
                    return f"✅ OK ({data['total']} items paginados)"
                elif 'alerts' in data or 'kpis_nuevos' in data:
                    # Dashboard principal
                    return f"✅ OK (Dashboard con {len(data.keys())} secciones)"
                else:
                    # Altro formato
                    return f"✅ OK ({len(data.keys())} claves)"
            elif isinstance(data, list):
                return f"✅ OK (Lista con {len(data)} items)"
            else:
                return f"✅ OK (Respuesta: {type(data).__name__})"
        else:
            return f"❌ Error {response.status_code}"
    except Exception as e:
        return f"💥 Exception: {str(e)[:50]}"

def main():
    print("📊 ANÁLISIS PATRÓN CRM-DASHBOARD - /api/dashboard/proyectos")
    print("=" * 80)
    
    # Parámetros comunes para los tests
    end_date = date.today()
    start_date = end_date - timedelta(days=90)
    
    common_params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat()
    }
    
    # Definir estructura del patrón
    print("\n🎯 PATRÓN CRM-DASHBOARD ESTÁNDAR:")
    print("-" * 80)
    
    pattern_endpoints = [
        {
            'path': '',
            'name': 'Dashboard Principal',
            'pattern': 'GET /',
            'description': 'KPIs, summary y alertas principales',
            'required': True
        },
        {
            'path': '/detalle',
            'name': 'Detalle General',  
            'pattern': 'GET /detalle',
            'description': 'Lista paginada con filtros y ordenamiento',
            'required': True,
            'extra_params': {'kpiKey': 'activos', 'perPage': 5}
        },
        {
            'path': '/detalle-alerta',
            'name': 'Detalle de Alertas',
            'pattern': 'GET /detalle-alerta', 
            'description': 'Lista paginada de items con alerta específica',
            'required': True,
            'extra_params': {'alertKey': 'eventos', 'perPage': 5}
        },
        {
            'path': '/alerta-item',
            'name': 'Verificar Alerta',
            'pattern': 'GET /alerta-item',
            'description': 'Verificar si item específico tiene alerta active',
            'required': True,
            'extra_params': {'id': 15, 'alertKey': 'eventos'}
        },
        {
            'path': '/selectors',
            'name': 'Selectores',
            'pattern': 'GET /selectors',
            'description': 'Opciones para filtros (responsable, estado, etc)',
            'required': True
        }
    ]
    
    # Test de endpoints del patrón
    for endpoint in pattern_endpoints:
        test_params = {**common_params}
        if 'extra_params' in endpoint:
            test_params.update(endpoint['extra_params'])
            
        status = test_endpoint(endpoint['path'], test_params, endpoint['description'])
        required_mark = "🔴 REQUERIDO" if endpoint['required'] else "🟡 OPCIONAL"
        
        print(f"{endpoint['pattern']:20} | {status:25} | {required_mark}")
        print(f"{'':20} | {endpoint['name']:25} | {endpoint['description']}")
        print("-" * 80)
    
    # Endpoints adicionales específicos del dominio
    print("\n🔧 ENDPOINTS ADICIONALES ESPECÍFICOS DEL DOMINIO:")
    print("-" * 80)
    
    additional_endpoints = [
        {
            'path': '/metricas-avance',
            'name': 'Métricas de Avance',
            'description': 'KPIs específicos de progreso de proyectos'
        },
        {
            'path': '/alertas', 
            'name': 'Resumen de Alertas',
            'description': 'Vista consolidada de todas las alertas active'
        }
    ]
    
    for endpoint in additional_endpoints:
        status = test_endpoint(endpoint['path'], common_params)
        print(f"{endpoint['path']:20} | {status:25} | 🟡 ESPECÍFICO")
        print(f"{'':20} | {endpoint['name']:25} | {endpoint['description']}")
        print("-" * 80)
    
    print("\n📈 RESUMEN DE ESTADO:")
    print("✅ = Implementado y funcionando")
    print("❌ = Error o no implementado")
    print("🔴 = Requerido para patrón CRM-Dashboard")
    print("🟡 = Opcional o específico del dominio")
    print("💥 = Error de conexión/servidor")

if __name__ == "__main__":
    main()