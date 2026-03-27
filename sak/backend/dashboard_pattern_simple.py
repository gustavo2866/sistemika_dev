"""
Análisis simplificado del patrón CRM-Dashboard para /api/dashboard/proyectos
Compatible con codificación de consola Windows
"""
import requests
from datetime import date, timedelta

BASE_URL = "http://localhost:8000/api/dashboard/proyectos"

def test_endpoint_simple(path, params=None):
    """Test endpoint y devuelve estado simple"""
    try:
        url = f"{BASE_URL}{path}"
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            return "OK"
        else:
            return f"ERROR-{response.status_code}"
    except requests.exceptions.RequestException as e:
        return "CONNECTION-ERROR"
    except Exception as e:
        return "UNKNOWN-ERROR"

def main():
    print("ANALISIS PATRON CRM-DASHBOARD - /api/dashboard/proyectos")
    print("=" * 70)
    
    # Parámetros de test
    end_date = date.today()
    start_date = end_date - timedelta(days=90)
    
    common_params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat()
    }
    
    print("\nESTADO DE ENDPOINTS - PATRON CRM-DASHBOARD:")
    print("-" * 70)
    print(f"{'ENDPOINT':<25} | {'STATUS':<15} | {'PATRON'}")
    print("-" * 70)
    
    # Endpoints requeridos del patrón
    endpoints_requeridos = [
        ('', 'Dashboard Principal', 'REQUERIDO'),
        ('/detalle', 'Detalle General', 'REQUERIDO'),
        ('/detalle-alerta', 'Detalle Alertas', 'REQUERIDO'), 
        ('/alerta-item', 'Verificar Alerta', 'REQUERIDO'),
        ('/selectors', 'Selectores', 'REQUERIDO')
    ]
    
    for path, name, pattern in endpoints_requeridos:
        params = common_params.copy()
        
        # Parámetros específicos por endpoint
        if path == '/detalle':
            params.update({'kpiKey': 'activos', 'perPage': 5})
        elif path == '/detalle-alerta':
            params.update({'alertKey': 'eventos', 'perPage': 5})
        elif path == '/alerta-item':
            params.update({'id': 15, 'alertKey': 'eventos'})
            
        status = test_endpoint_simple(path, params)
        status_display = "SI" if status == "OK" else "NO"
        print(f"{name:<25} | {status_display:<15} | {pattern}")
    
    print("-" * 70)
    print("\nENDPOINTS ESPECÍFICOS DEL DOMINIO:")
    print("-" * 70)
    print(f"{'ENDPOINT':<25} | {'STATUS':<15} | {'PATRON'}")
    print("-" * 70)
    
    # Endpoints adicionales específicos
    endpoints_especificos = [
        ('/metricas-avance', 'Métricas Avance', 'ESPECÍFICO'),
        ('/alertas', 'Resumen Alertas', 'ESPECÍFICO')
    ]
    
    for path, name, pattern in endpoints_especificos:
        status = test_endpoint_simple(path, common_params)
        status_display = "SI" if status == "OK" else "NO"
        print(f"{name:<25} | {status_display:<15} | {pattern}")
    
    print("-" * 70)
    print("\nRESUMEN:")
    print("SI = Implementado y funcionando")
    print("NO = Error o no implementado")
    print("REQUERIDO = Necesario para patron CRM-Dashboard")
    print("ESPECÍFICO = Adicional para el dominio de proyectos")

if __name__ == "__main__":
    main()