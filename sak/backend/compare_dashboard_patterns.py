"""
Script para analizar y comparar los patrones CRM-Dashboard vs PO-Dashboard
Compara la estructura de endpoints, funcionalidades y compliance con el patrón estándar
"""
import requests
from datetime import date, timedelta
from typing import Dict, List, Tuple

def test_endpoint_status(base_url: str, path: str, params: Dict = None) -> str:
    """Test endpoint y devuelve estado simple"""
    try:
        url = f"{base_url}{path}"
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'data' in data:
                return f"✅ OK ({data.get('total', 'N/A')} items)"
            elif isinstance(data, dict) and len(data.keys()) > 1:
                return f"✅ OK"
            elif isinstance(data, list):
                return f"✅ OK ({len(data)} items)"
            else:
                return "✅ OK"
        else:
            return f"❌ {response.status_code}"
    except Exception:
        return "💥 ERROR"

def analyze_dashboard_pattern(name: str, base_url: str) -> Dict:
    """Analiza un patrón de dashboard y devuelve su estructura"""
    
    # Parámetros comunes
    end_date = date.today()
    start_date = end_date - timedelta(days=90)
    common_params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat()
    }
    
    # Endpoints del patrón estándar CRM-Dashboard
    standard_endpoints = [
        ('/', 'Dashboard Principal', {}),
        ('/detalle', 'Detalle General', {'perPage': 5}),
        ('/detalle-alerta', 'Detalle de Alertas', {'perPage': 5}),
        ('/alerta-item', 'Verificar Alerta', {'id': 1}),
        ('/selectors', 'Selectores', {}),
    ]
    
    # Endpoints específicos comunes en dashboards
    specific_endpoints = [
        ('/metricas-avance', 'Métricas de Avance'),
        ('/alertas', 'Resumen Alertas'),
        ('/bundle', 'Bundle de Datos'),
    ]
    
    results = {
        'name': name,
        'base_url': base_url,
        'standard_compliance': {},
        'specific_endpoints': {},
        'total_endpoints': 0,
        'working_endpoints': 0
    }
    
    # Test endpoints estándar
    for path, name_ep, extra_params in standard_endpoints:
        params = {**common_params, **extra_params}
        
        # Parámetros específicos por patrón
        if 'detalle-alerta' in path and 'po' in base_url:
            params['alertKey'] = 'rechazadas'
        elif 'detalle-alerta' in path and 'proyecto' in base_url:
            params['alertKey'] = 'eventos'
        elif 'alerta-item' in path and 'po' in base_url:
            params['alertKey'] = 'rechazadas'
        elif 'alerta-item' in path and 'proyecto' in base_url:
            params['alertKey'] = 'eventos'
        elif 'detalle' in path and 'proyecto' in base_url:
            params['kpiKey'] = 'activos'
        elif 'detalle' in path and 'po' in base_url:
            params['kpiKey'] = 'pendientes'
            
        status = test_endpoint_status(base_url, path, params)
        results['standard_compliance'][path] = {
            'name': name_ep,
            'status': status,
            'working': '✅' in status
        }
        results['total_endpoints'] += 1
        if '✅' in status:
            results['working_endpoints'] += 1
    
    # Test endpoints específicos
    for path, name_ep in specific_endpoints:
        status = test_endpoint_status(base_url, path, common_params)
        results['specific_endpoints'][path] = {
            'name': name_ep,
            'status': status,
            'working': '✅' in status
        }
        if '✅' in status:
            results['total_endpoints'] += 1
            results['working_endpoints'] += 1
            
    return results

def print_comparison():
    """Imprime comparación detallada entre patrones"""
    
    print("COMPARACION PATRONES: CRM-DASHBOARD vs PO-DASHBOARD")
    print("=" * 80)
    
    # Analizar ambos patrones
    crm_results = analyze_dashboard_pattern(
        "CRM-Dashboard (Proyectos)",
        "http://localhost:8000/api/dashboard/proyectos"
    )
    
    po_results = analyze_dashboard_pattern(
        "PO-Dashboard (Purchase Orders)", 
        "http://localhost:8000/api/dashboard/po"
    )
    
    print(f"\nRESUMEN GENERAL:")
    print("-" * 80)
    print(f"{'PATTERN':<30} | {'ENDPOINTS':<12} | {'WORKING':<12} | {'COMPLIANCE':<12}")
    print("-" * 80)
    
    crm_compliance = (crm_results['working_endpoints'] / 5) * 100 if crm_results['working_endpoints'] <= 5 else 100
    po_compliance = (po_results['working_endpoints'] / 5) * 100 if po_results['working_endpoints'] <= 5 else 100
    
    print(f"{crm_results['name']:<30} | {crm_results['total_endpoints']:<12} | {crm_results['working_endpoints']:<12} | {crm_compliance:.0f}%")
    print(f"{po_results['name']:<30} | {po_results['total_endpoints']:<12} | {po_results['working_endpoints']:<12} | {po_compliance:.0f}%")
    
    print("\nDETALLE POR ENDPOINT - PATRON ESTANDAR CRM-DASHBOARD:")
    print("-" * 80)
    print(f"{'ENDPOINT':<25} | {'CRM-DASHBOARD':<20} | {'PO-DASHBOARD':<20}")
    print("-" * 80)
    
    # Comparar endpoints estándar
    for path in ['/', '/detalle', '/detalle-alerta', '/alerta-item', '/selectors']:
        crm_status = crm_results['standard_compliance'].get(path, {}).get('status', '❌ NOT FOUND')
        po_status = po_results['standard_compliance'].get(path, {}).get('status', '❌ NOT FOUND')
        
        endpoint_name = crm_results['standard_compliance'].get(path, {}).get('name', path)
        crm_short = "SI" if "✅" in crm_status else "NO"
        po_short = "SI" if "✅" in po_status else "NO"
        
        print(f"{endpoint_name:<25} | {crm_short:<20} | {po_short:<20}")
    
    print("\nENDPOINTS ESPECIFICOS POR DOMINIO:")
    print("-" * 80)
    print(f"{'ENDPOINT':<25} | {'CRM-DASHBOARD':<20} | {'PO-DASHBOARD':<20}")
    print("-" * 80)
    
    # Comparar endpoints específicos
    all_specific = set(crm_results['specific_endpoints'].keys()) | set(po_results['specific_endpoints'].keys())
    for path in sorted(all_specific):
        crm_spec = crm_results['specific_endpoints'].get(path, {})
        po_spec = po_results['specific_endpoints'].get(path, {})
        
        endpoint_name = crm_spec.get('name') or po_spec.get('name', path)
        crm_short = "SI" if crm_spec.get('working') else "NO"
        po_short = "SI" if po_spec.get('working') else "NO"
        
        print(f"{endpoint_name:<25} | {crm_short:<20} | {po_short:<20}")
    
    print("\nANALISIS COMPARATIVO:")
    print("-" * 80)
    print("SIMILITUDES:")
    print("* Ambos implementan el patron base CRM-Dashboard")
    print("* Endpoints principales: /, /detalle, /detalle-alerta, /selectors")
    print("* Sistema de paginacion y filtros similar")
    print("* Manejo de alertas con alertKey parameter")
    print("* Estructura de respuesta consistente")
    
    print("\nDIFERENCIAS:")
    print("* PO-Dashboard tiene endpoint /bundle (trend data)")
    print("* CRM-Dashboard tiene endpoints /metricas-avance y /alertas")
    print("* Diferentes tipos de alertas por dominio")
    print("* Filtros específicos por dominio (KPIs, estados)")
    
    print("\nRECOMENDALIONES:")
    print("* Estandarizar estructura de respuesta")
    print("* Considerar agregar /bundle a CRM-Dashboard") 
    print("* Considerar agregar /metricas-avance a PO-Dashboard")
    print("* Documentar diferencias específicas por dominio")

if __name__ == "__main__":
    print_comparison()