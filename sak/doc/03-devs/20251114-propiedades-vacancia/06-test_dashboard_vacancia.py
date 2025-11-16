"""
Script de prueba para verificar endpoints del dashboard de vacancia.

Este script realiza peticiones a los endpoints del dashboard y reporta
cualquier error o inconsistencia encontrada.

NO corrige errores, solo los identifica.

Ejecutar:
    cd backend
    python ..\doc\03-devs\20251114-propiedades-vacancia\06-test_dashboard_vacancia.py
"""

import sys
import os
from datetime import datetime, timedelta
import requests
import json

# Configuración
API_URL = os.getenv("API_URL", "http://localhost:8000")
DASHBOARD_URL = f"{API_URL}/api/dashboard/vacancias"

# Colores para output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_section(title: str):
    print(f"\n{Colors.BLUE}{'='*60}")
    print(f"{title}")
    print(f"{'='*60}{Colors.END}\n")

def print_success(msg: str):
    print(f"{Colors.GREEN}✓{Colors.END} {msg}")

def print_error(msg: str):
    print(f"{Colors.RED}✗{Colors.END} {msg}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠{Colors.END} {msg}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ{Colors.END} {msg}")


# Lista de errores encontrados
errores_encontrados = []

def registrar_error(endpoint: str, tipo: str, detalle: str):
    """Registra un error encontrado."""
    errores_encontrados.append({
        'endpoint': endpoint,
        'tipo': tipo,
        'detalle': detalle
    })
    print_error(f"[{tipo}] {detalle}")


def test_endpoint_principal():
    """Prueba el endpoint principal del dashboard."""
    print_section("TEST 1: Endpoint Principal GET /api/dashboard/vacancias")
    
    # Calcular rango de fechas (últimos 3 meses)
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)
    
    params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'limitTop': 5,
        'includeItems': False
    }
    
    print_info(f"Probando: {DASHBOARD_URL}")
    print_info(f"Rango: {start_date} a {end_date}")
    
    try:
        response = requests.get(DASHBOARD_URL, params=params, timeout=10)
        
        # Verificar status code
        if response.status_code != 200:
            registrar_error(
                "/api/dashboard/vacancias",
                "HTTP_ERROR",
                f"Status code esperado 200, recibido {response.status_code}: {response.text[:200]}"
            )
            return None
        
        print_success(f"Status code: {response.status_code}")
        
        # Parsear JSON
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            registrar_error(
                "/api/dashboard/vacancias",
                "JSON_ERROR",
                f"Respuesta no es JSON válido: {str(e)}"
            )
            return None
        
        print_success("Respuesta es JSON válido")
        
        # Verificar estructura esperada
        campos_requeridos = ['range', 'kpis', 'buckets', 'estados_finales', 'top']
        for campo in campos_requeridos:
            if campo not in data:
                registrar_error(
                    "/api/dashboard/vacancias",
                    "STRUCTURE_ERROR",
                    f"Falta campo requerido en respuesta: '{campo}'"
                )
            else:
                print_success(f"Campo '{campo}' presente")
        
        # Verificar KPIs
        if 'kpis' in data:
            kpis_esperados = [
                'totalVacancias',
                'promedioDiasTotales',
                'promedioDiasReparacion',
                'promedioDiasDisponible',
                'porcentajeRetiro'
            ]
            for kpi in kpis_esperados:
                if kpi not in data['kpis']:
                    registrar_error(
                        "/api/dashboard/vacancias",
                        "KPI_MISSING",
                        f"Falta KPI en respuesta: '{kpi}'"
                    )
                else:
                    valor = data['kpis'][kpi]
                    print_success(f"KPI '{kpi}': {valor}")
                    
                    # Validar que sean números
                    if not isinstance(valor, (int, float)):
                        registrar_error(
                            "/api/dashboard/vacancias",
                            "KPI_TYPE_ERROR",
                            f"KPI '{kpi}' no es numérico: {type(valor)}"
                        )
        
        # Verificar buckets
        if 'buckets' in data:
            buckets = data['buckets']
            if not isinstance(buckets, list):
                registrar_error(
                    "/api/dashboard/vacancias",
                    "BUCKETS_TYPE_ERROR",
                    f"'buckets' debe ser una lista, recibido: {type(buckets)}"
                )
            else:
                print_success(f"Buckets: {len(buckets)} encontrados")
                
                # Verificar estructura de cada bucket
                for i, bucket in enumerate(buckets[:3]):  # Solo primeros 3
                    campos_bucket = ['bucket', 'count', 'dias_totales', 'dias_reparacion', 'dias_disponible']
                    for campo in campos_bucket:
                        if campo not in bucket:
                            registrar_error(
                                "/api/dashboard/vacancias",
                                "BUCKET_FIELD_MISSING",
                                f"Bucket {i}: falta campo '{campo}'"
                            )
        
        # Verificar top
        if 'top' in data:
            top = data['top']
            if not isinstance(top, list):
                registrar_error(
                    "/api/dashboard/vacancias",
                    "TOP_TYPE_ERROR",
                    f"'top' debe ser una lista, recibido: {type(top)}"
                )
            else:
                print_success(f"Top: {len(top)} items")
                
                # Verificar que cada item tenga vacancia
                for i, item in enumerate(top):
                    if 'vacancia' not in item:
                        registrar_error(
                            "/api/dashboard/vacancias",
                            "TOP_ITEM_ERROR",
                            f"Top item {i}: falta campo 'vacancia'"
                        )
                    if 'dias_totales' not in item:
                        registrar_error(
                            "/api/dashboard/vacancias",
                            "TOP_ITEM_ERROR",
                            f"Top item {i}: falta campo 'dias_totales'"
                        )
        
        # Verificar estados_finales
        if 'estados_finales' in data:
            estados = data['estados_finales']
            estados_esperados = ['activo', 'alquilada', 'retirada']
            for estado in estados_esperados:
                if estado not in estados:
                    registrar_error(
                        "/api/dashboard/vacancias",
                        "ESTADO_MISSING",
                        f"Falta estado en 'estados_finales': '{estado}'"
                    )
                else:
                    print_success(f"Estado '{estado}': {estados[estado]}")
        
        return data
        
    except requests.exceptions.ConnectionError:
        registrar_error(
            "/api/dashboard/vacancias",
            "CONNECTION_ERROR",
            "No se pudo conectar al servidor. ¿Está corriendo el backend?"
        )
        return None
    except requests.exceptions.Timeout:
        registrar_error(
            "/api/dashboard/vacancias",
            "TIMEOUT_ERROR",
            "Timeout al hacer la petición (>10s)"
        )
        return None
    except Exception as e:
        registrar_error(
            "/api/dashboard/vacancias",
            "UNEXPECTED_ERROR",
            f"Error inesperado: {str(e)}"
        )
        return None


def test_endpoint_detalle():
    """Prueba el endpoint de detalle."""
    print_section("TEST 2: Endpoint Detalle GET /api/dashboard/vacancias/detalle")
    
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)
    
    params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'page': 1,
        'perPage': 10,
        'orderBy': 'dias_totales',
        'orderDir': 'desc'
    }
    
    url = f"{DASHBOARD_URL}/detalle"
    print_info(f"Probando: {url}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            registrar_error(
                "/api/dashboard/vacancias/detalle",
                "HTTP_ERROR",
                f"Status code esperado 200, recibido {response.status_code}"
            )
            return None
        
        print_success(f"Status code: {response.status_code}")
        
        data = response.json()
        print_success("Respuesta es JSON válido")
        
        # Verificar estructura de paginación
        campos_paginacion = ['data', 'total', 'page', 'perPage']
        for campo in campos_paginacion:
            if campo not in data:
                registrar_error(
                    "/api/dashboard/vacancias/detalle",
                    "PAGINATION_ERROR",
                    f"Falta campo de paginación: '{campo}'"
                )
            else:
                print_success(f"Campo '{campo}': {data[campo] if campo != 'data' else f'{len(data[campo])} items'}")
        
        # Verificar consistencia de paginación
        if 'data' in data and 'perPage' in data:
            if len(data['data']) > data['perPage']:
                registrar_error(
                    "/api/dashboard/vacancias/detalle",
                    "PAGINATION_LOGIC_ERROR",
                    f"Más items de lo esperado: {len(data['data'])} > {data['perPage']}"
                )
        
        # Verificar estructura de items
        if 'data' in data and len(data['data']) > 0:
            first_item = data['data'][0]
            campos_item = ['vacancia', 'dias_totales', 'dias_reparacion', 'dias_disponible', 'estado_corte', 'bucket']
            for campo in campos_item:
                if campo not in first_item:
                    registrar_error(
                        "/api/dashboard/vacancias/detalle",
                        "ITEM_FIELD_MISSING",
                        f"Item 0: falta campo '{campo}'"
                    )
        
        return data
        
    except Exception as e:
        registrar_error(
            "/api/dashboard/vacancias/detalle",
            "UNEXPECTED_ERROR",
            f"Error: {str(e)}"
        )
        return None


def test_filtros():
    """Prueba los filtros del dashboard."""
    print_section("TEST 3: Filtros del Dashboard")
    
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)
    
    # Test con filtro de estado
    print_info("Probando filtro: estadoPropiedad=3-disponible")
    params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'estadoPropiedad': '3-disponible',
        'limitTop': 3
    }
    
    try:
        response = requests.get(DASHBOARD_URL, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_success(f"Filtro estado funciona: {data['kpis']['totalVacancias']} vacancias")
        else:
            registrar_error(
                "/api/dashboard/vacancias (filtro estado)",
                "FILTER_ERROR",
                f"Error al filtrar por estado: {response.status_code}"
            )
    except Exception as e:
        registrar_error(
            "/api/dashboard/vacancias (filtro estado)",
            "FILTER_ERROR",
            f"Error: {str(e)}"
        )
    
    # Test con filtro de ambientes
    print_info("Probando filtro: ambientes=3")
    params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'ambientes': 3,
        'limitTop': 3
    }
    
    try:
        response = requests.get(DASHBOARD_URL, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_success(f"Filtro ambientes funciona: {data['kpis']['totalVacancias']} vacancias")
        else:
            registrar_error(
                "/api/dashboard/vacancias (filtro ambientes)",
                "FILTER_ERROR",
                f"Error al filtrar por ambientes: {response.status_code}"
            )
    except Exception as e:
        registrar_error(
            "/api/dashboard/vacancias (filtro ambientes)",
            "FILTER_ERROR",
            f"Error: {str(e)}"
        )


def test_includeItems():
    """Prueba el parámetro includeItems."""
    print_section("TEST 4: Parámetro includeItems")
    
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)
    
    params = {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'limitTop': 3,
        'includeItems': True
    }
    
    print_info("Probando con includeItems=true")
    
    try:
        response = requests.get(DASHBOARD_URL, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'items' in data:
                print_success(f"Campo 'items' presente con {len(data['items'])} elementos")
                
                # Verificar que items tenga estructura correcta
                if len(data['items']) > 0:
                    first_item = data['items'][0]
                    campos = ['vacancia', 'dias_totales', 'dias_reparacion', 'dias_disponible', 'estado_corte', 'bucket']
                    for campo in campos:
                        if campo not in first_item:
                            registrar_error(
                                "/api/dashboard/vacancias (includeItems)",
                                "ITEMS_FIELD_MISSING",
                                f"Item 0 en 'items': falta campo '{campo}'"
                            )
            else:
                registrar_error(
                    "/api/dashboard/vacancias (includeItems)",
                    "INCLUDE_ITEMS_ERROR",
                    "includeItems=true pero no hay campo 'items' en respuesta"
                )
        else:
            registrar_error(
                "/api/dashboard/vacancias (includeItems)",
                "HTTP_ERROR",
                f"Error: {response.status_code}"
            )
    except Exception as e:
        registrar_error(
            "/api/dashboard/vacancias (includeItems)",
            "UNEXPECTED_ERROR",
            f"Error: {str(e)}"
        )


def test_ordenamiento():
    """Prueba el ordenamiento en endpoint de detalle."""
    print_section("TEST 5: Ordenamiento en Detalle")
    
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)
    
    ordenes = [
        ('dias_totales', 'desc'),
        ('dias_totales', 'asc'),
        ('dias_reparacion', 'desc'),
        ('dias_disponible', 'desc'),
    ]
    
    url = f"{DASHBOARD_URL}/detalle"
    
    for orderBy, orderDir in ordenes:
        print_info(f"Probando ordenamiento: {orderBy} {orderDir}")
        
        params = {
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat(),
            'page': 1,
            'perPage': 5,
            'orderBy': orderBy,
            'orderDir': orderDir
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and len(data['data']) > 1:
                    # Verificar que esté ordenado correctamente
                    items = data['data']
                    valores = [item[orderBy] for item in items]
                    
                    if orderDir == 'desc':
                        ordenado = valores == sorted(valores, reverse=True)
                    else:
                        ordenado = valores == sorted(valores)
                    
                    if ordenado:
                        print_success(f"Ordenamiento correcto: {valores[:3]}...")
                    else:
                        registrar_error(
                            f"/api/dashboard/vacancias/detalle (order {orderBy} {orderDir})",
                            "SORT_ERROR",
                            f"Items no están ordenados correctamente: {valores}"
                        )
                else:
                    print_warning("Pocos items para verificar ordenamiento")
            else:
                registrar_error(
                    f"/api/dashboard/vacancias/detalle (order {orderBy} {orderDir})",
                    "HTTP_ERROR",
                    f"Error: {response.status_code}"
                )
        except Exception as e:
            registrar_error(
                f"/api/dashboard/vacancias/detalle (order {orderBy} {orderDir})",
                "UNEXPECTED_ERROR",
                f"Error: {str(e)}"
            )


def imprimir_resumen():
    """Imprime resumen de errores encontrados."""
    print_section("RESUMEN DE PRUEBAS")
    
    if not errores_encontrados:
        print_success("✅ Todas las pruebas pasaron exitosamente")
        print_success("No se encontraron errores en los endpoints del dashboard")
        return
    
    print_error(f"Se encontraron {len(errores_encontrados)} errores:\n")
    
    # Agrupar por endpoint
    errores_por_endpoint = {}
    for error in errores_encontrados:
        endpoint = error['endpoint']
        if endpoint not in errores_por_endpoint:
            errores_por_endpoint[endpoint] = []
        errores_por_endpoint[endpoint].append(error)
    
    for endpoint, errores in errores_por_endpoint.items():
        print(f"\n{Colors.YELLOW}Endpoint: {endpoint}{Colors.END}")
        for error in errores:
            print(f"  {Colors.RED}[{error['tipo']}]{Colors.END} {error['detalle']}")
    
    print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
    print(f"{Colors.YELLOW}Total de errores: {len(errores_encontrados)}{Colors.END}")
    print(f"{Colors.YELLOW}{'='*60}{Colors.END}\n")


def main():
    print_section("VERIFICACIÓN DE ENDPOINTS - DASHBOARD VACANCIA")
    print_info(f"API URL: {API_URL}")
    print_info(f"Dashboard URL: {DASHBOARD_URL}")
    print_info("Iniciando pruebas...\n")
    
    # Ejecutar pruebas
    test_endpoint_principal()
    test_endpoint_detalle()
    test_filtros()
    test_includeItems()
    test_ordenamiento()
    
    # Mostrar resumen
    imprimir_resumen()
    
    # Retornar código de salida
    sys.exit(1 if errores_encontrados else 0)


if __name__ == "__main__":
    main()
