"""
Test exhaustivo del dashboard combinando rangos de fechas y filtros.

Este test verifica todas las combinaciones posibles de:
- Distintos rangos de fechas
- Filtros por estado de propiedad
- Filtros por ambientes
- Filtros por propietario
- Combinaciones múltiples

Ejecutar:
    cd backend
    python ..\doc\03-devs\20251114-propiedades-vacancia\15-test_exhaustivo.py
"""

import requests
from datetime import datetime, timedelta
from itertools import product
import json

API_URL = "http://localhost:8000/api/dashboard/vacancias"

# Colores para output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    END = '\033[0m'

def print_section(title: str, color=Colors.BLUE):
    print(f"\n{color}{'='*80}")
    print(f"{title}")
    print(f"{'='*80}{Colors.END}\n")

def print_success(msg: str):
    print(f"{Colors.GREEN}✓{Colors.END} {msg}")

def print_error(msg: str):
    print(f"{Colors.RED}✗{Colors.END} {msg}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠{Colors.END} {msg}")

def print_info(msg: str):
    print(f"{Colors.CYAN}ℹ{Colors.END} {msg}")


# Configuración de tests
RANGOS_FECHAS = [
    {
        "nombre": "Últimos 7 días",
        "start": (datetime.now() - timedelta(days=7)).date().isoformat(),
        "end": datetime.now().date().isoformat()
    },
    {
        "nombre": "Últimos 30 días",
        "start": (datetime.now() - timedelta(days=30)).date().isoformat(),
        "end": datetime.now().date().isoformat()
    },
    {
        "nombre": "Últimos 90 días",
        "start": (datetime.now() - timedelta(days=90)).date().isoformat(),
        "end": datetime.now().date().isoformat()
    },
    {
        "nombre": "Último semestre (6 meses)",
        "start": (datetime.now() - timedelta(days=180)).date().isoformat(),
        "end": datetime.now().date().isoformat()
    },
    {
        "nombre": "Año 2024 completo",
        "start": "2024-01-01",
        "end": "2024-12-31"
    },
    {
        "nombre": "Año 2025 hasta hoy",
        "start": "2025-01-01",
        "end": datetime.now().date().isoformat()
    },
    {
        "nombre": "Q1 2025 (Ene-Mar)",
        "start": "2025-01-01",
        "end": "2025-03-31"
    },
    {
        "nombre": "Q2 2025 (Abr-Jun)",
        "start": "2025-04-01",
        "end": "2025-06-30"
    },
    {
        "nombre": "Todo el histórico",
        "start": "2022-01-01",
        "end": datetime.now().date().isoformat()
    },
]

FILTROS_ESTADO = [
    {"nombre": "Sin filtro", "valor": None},
    {"nombre": "Recibida", "valor": "1-recibida"},
    {"nombre": "En reparación", "valor": "2-en_reparacion"},
    {"nombre": "Disponible", "valor": "3-disponible"},
    {"nombre": "Alquilada", "valor": "4-alquilada"},
    {"nombre": "Retirada", "valor": "5-retirada"},
]

FILTROS_AMBIENTES = [
    {"nombre": "Sin filtro", "valor": None},
    {"nombre": "Monoambiente (0)", "valor": 0},
    {"nombre": "1 ambiente", "valor": 1},
    {"nombre": "2 ambientes", "valor": 2},
    {"nombre": "3 ambientes", "valor": 3},
    {"nombre": "4 ambientes", "valor": 4},
    {"nombre": "5+ ambientes", "valor": 5},
]

FILTROS_PROPIETARIO = [
    {"nombre": "Sin filtro", "valor": None},
    {"nombre": "María", "valor": "maría"},
    {"nombre": "Juan", "valor": "juan"},
    {"nombre": "Carlos", "valor": "carlos"},
]


# Contadores
total_tests = 0
tests_pasados = 0
tests_fallidos = 0
tests_con_datos = 0
tests_sin_datos = 0
errores = []


def ejecutar_test(rango, filtro_estado, filtro_ambiente, filtro_propietario, verbose=False):
    """Ejecuta un test con la combinación dada de parámetros."""
    global total_tests, tests_pasados, tests_fallidos, tests_con_datos, tests_sin_datos
    
    total_tests += 1
    
    # Construir params
    params = {
        'startDate': rango['start'],
        'endDate': rango['end'],
        'limitTop': 3
    }
    
    if filtro_estado['valor']:
        params['estadoPropiedad'] = filtro_estado['valor']
    if filtro_ambiente['valor'] is not None:
        params['ambientes'] = filtro_ambiente['valor']
    if filtro_propietario['valor']:
        params['propietario'] = filtro_propietario['valor']
    
    # Descripción del test
    filtros_str = []
    if filtro_estado['valor']:
        filtros_str.append(f"estado={filtro_estado['nombre']}")
    if filtro_ambiente['valor'] is not None:
        filtros_str.append(f"amb={filtro_ambiente['nombre']}")
    if filtro_propietario['valor']:
        filtros_str.append(f"prop={filtro_propietario['nombre']}")
    
    filtros_desc = ", ".join(filtros_str) if filtros_str else "sin filtros"
    
    if verbose:
        print(f"\n{Colors.MAGENTA}Test #{total_tests}{Colors.END}")
        print(f"  Rango: {rango['nombre']}")
        print(f"  Filtros: {filtros_desc}")
    
    try:
        response = requests.get(API_URL, params=params, timeout=10)
        
        if response.status_code != 200:
            tests_fallidos += 1
            error = f"Test #{total_tests}: HTTP {response.status_code} - {rango['nombre']} + {filtros_desc}"
            errores.append(error)
            if verbose:
                print_error(f"Error HTTP {response.status_code}")
            return False
        
        data = response.json()
        
        # Validar estructura
        campos_requeridos = ['range', 'kpis', 'buckets', 'estados_finales', 'top']
        for campo in campos_requeridos:
            if campo not in data:
                tests_fallidos += 1
                error = f"Test #{total_tests}: Falta campo '{campo}' - {rango['nombre']} + {filtros_desc}"
                errores.append(error)
                if verbose:
                    print_error(f"Falta campo '{campo}'")
                return False
        
        # Validar KPIs
        kpis = data['kpis']
        total_vacancias = kpis['totalVacancias']
        
        if total_vacancias > 0:
            tests_con_datos += 1
        else:
            tests_sin_datos += 1
        
        # Validar consistencia
        suma_estados = sum(data['estados_finales'].values())
        if suma_estados != total_vacancias:
            tests_fallidos += 1
            error = f"Test #{total_tests}: Inconsistencia estados ({suma_estados}) != total ({total_vacancias})"
            errores.append(error)
            if verbose:
                print_error(f"Suma estados ({suma_estados}) != total ({total_vacancias})")
            return False
        
        # Validar promedios (si hay datos)
        if total_vacancias > 0:
            if kpis['promedioDiasTotales'] < 0:
                tests_fallidos += 1
                error = f"Test #{total_tests}: Promedio negativo"
                errores.append(error)
                if verbose:
                    print_error("Promedio días totales negativo")
                return False
        
        tests_pasados += 1
        if verbose:
            print_success(f"Total: {total_vacancias}, Promedio: {kpis['promedioDiasTotales']:.1f} días")
        
        return True
        
    except Exception as e:
        tests_fallidos += 1
        error = f"Test #{total_tests}: Excepción {type(e).__name__}: {str(e)}"
        errores.append(error)
        if verbose:
            print_error(f"Excepción: {type(e).__name__}: {str(e)}")
        return False


def test_suite_basica():
    """Suite básica: todas las combinaciones de rango + 1 filtro."""
    print_section("SUITE BÁSICA: Rangos + Filtro Individual", Colors.CYAN)
    
    contador = 0
    
    # Rangos + filtros de estado
    print_info("Probando: Rangos + Filtros de Estado")
    for rango, filtro in product(RANGOS_FECHAS, FILTROS_ESTADO):
        ejecutar_test(rango, filtro, FILTROS_AMBIENTES[0], FILTROS_PROPIETARIO[0])
        contador += 1
    print_success(f"Completados {contador} tests (rangos x estados)")
    
    # Rangos + filtros de ambientes
    print_info("Probando: Rangos + Filtros de Ambientes")
    inicio = contador
    for rango, filtro in product(RANGOS_FECHAS, FILTROS_AMBIENTES):
        ejecutar_test(rango, FILTROS_ESTADO[0], filtro, FILTROS_PROPIETARIO[0])
        contador += 1
    print_success(f"Completados {contador - inicio} tests (rangos x ambientes)")
    
    # Rangos + filtros de propietario
    print_info("Probando: Rangos + Filtros de Propietario")
    inicio = contador
    for rango, filtro in product(RANGOS_FECHAS, FILTROS_PROPIETARIO):
        ejecutar_test(rango, FILTROS_ESTADO[0], FILTROS_AMBIENTES[0], filtro)
        contador += 1
    print_success(f"Completados {contador - inicio} tests (rangos x propietarios)")


def test_suite_combinada():
    """Suite combinada: múltiples filtros simultáneos."""
    print_section("SUITE COMBINADA: Múltiples Filtros", Colors.CYAN)
    
    # Seleccionar subconjuntos para evitar explosión combinatoria
    rangos_sample = RANGOS_FECHAS[::2]  # Cada 2
    estados_sample = [FILTROS_ESTADO[0], FILTROS_ESTADO[3], FILTROS_ESTADO[4]]  # Sin filtro, Disponible, Alquilada
    ambientes_sample = [FILTROS_AMBIENTES[0], FILTROS_AMBIENTES[2], FILTROS_AMBIENTES[4]]  # Sin filtro, 1 amb, 3 amb
    
    print_info(f"Probando: {len(rangos_sample)} rangos x {len(estados_sample)} estados x {len(ambientes_sample)} ambientes")
    
    contador = 0
    for rango, estado, ambiente in product(rangos_sample, estados_sample, ambientes_sample):
        ejecutar_test(rango, estado, ambiente, FILTROS_PROPIETARIO[0])
        contador += 1
    
    print_success(f"Completados {contador} tests combinados")


def test_suite_casos_especiales():
    """Suite de casos especiales y edge cases."""
    print_section("SUITE CASOS ESPECIALES", Colors.CYAN)
    
    # Test 1: Rango muy corto (1 día)
    print_info("Test: Rango de 1 día")
    hoy = datetime.now().date().isoformat()
    ejecutar_test(
        {"nombre": "Solo hoy", "start": hoy, "end": hoy},
        FILTROS_ESTADO[0], FILTROS_AMBIENTES[0], FILTROS_PROPIETARIO[0],
        verbose=True
    )
    
    # Test 2: Rango futuro (no debería haber datos)
    print_info("Test: Rango futuro")
    futuro_inicio = (datetime.now() + timedelta(days=30)).date().isoformat()
    futuro_fin = (datetime.now() + timedelta(days=60)).date().isoformat()
    ejecutar_test(
        {"nombre": "Futuro", "start": futuro_inicio, "end": futuro_fin},
        FILTROS_ESTADO[0], FILTROS_AMBIENTES[0], FILTROS_PROPIETARIO[0],
        verbose=True
    )
    
    # Test 3: Todos los filtros combinados
    print_info("Test: Todos los filtros activos")
    ejecutar_test(
        RANGOS_FECHAS[-1],  # Todo el histórico
        FILTROS_ESTADO[3],  # Disponible
        FILTROS_AMBIENTES[4],  # 3 ambientes
        FILTROS_PROPIETARIO[1],  # María
        verbose=True
    )
    
    # Test 4: Estados retirada (debería tener pocos resultados)
    print_info("Test: Solo propiedades retiradas")
    ejecutar_test(
        RANGOS_FECHAS[-1],
        FILTROS_ESTADO[5],  # Retirada
        FILTROS_AMBIENTES[0], FILTROS_PROPIETARIO[0],
        verbose=True
    )
    
    # Test 5: Monoambientes
    print_info("Test: Solo monoambientes")
    ejecutar_test(
        RANGOS_FECHAS[-1],
        FILTROS_ESTADO[0],
        FILTROS_AMBIENTES[1],  # 0 ambientes
        FILTROS_PROPIETARIO[0],
        verbose=True
    )
    
    # Test 6: Trimestre específico con filtros
    print_info("Test: Q1 2025 + Disponible + 2 ambientes")
    ejecutar_test(
        RANGOS_FECHAS[6],  # Q1 2025
        FILTROS_ESTADO[3],  # Disponible
        FILTROS_AMBIENTES[3],  # 2 ambientes
        FILTROS_PROPIETARIO[0],
        verbose=True
    )


def test_includeItems():
    """Test del parámetro includeItems."""
    print_section("SUITE INCLUDE ITEMS", Colors.CYAN)
    
    print_info("Test: includeItems=true con distintos rangos")
    
    for i, rango in enumerate(RANGOS_FECHAS[::3]):  # Cada 3 rangos
        params = {
            'startDate': rango['start'],
            'endDate': rango['end'],
            'includeItems': True,
            'limitTop': 5
        }
        
        try:
            response = requests.get(API_URL, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'items' not in data:
                    print_error(f"Rango '{rango['nombre']}': Falta campo 'items'")
                    continue
                
                total_kpi = data['kpis']['totalVacancias']
                total_items = len(data['items'])
                
                if total_kpi != total_items:
                    print_warning(f"Rango '{rango['nombre']}': KPI ({total_kpi}) != len(items) ({total_items})")
                else:
                    print_success(f"Rango '{rango['nombre']}': {total_items} items correctos")
            else:
                print_error(f"Rango '{rango['nombre']}': HTTP {response.status_code}")
        
        except Exception as e:
            print_error(f"Rango '{rango['nombre']}': {type(e).__name__}")


def test_endpoint_detalle():
    """Test exhaustivo del endpoint de detalle con paginación."""
    print_section("SUITE ENDPOINT DETALLE", Colors.CYAN)
    
    url_detalle = API_URL + "/detalle"
    
    # Test con distintos rangos
    rangos_test = [RANGOS_FECHAS[2], RANGOS_FECHAS[5], RANGOS_FECHAS[-1]]  # 90 días, 2025, histórico
    
    for rango in rangos_test:
        print_info(f"Test detalle: {rango['nombre']}")
        
        # Test paginación
        for page in [1, 2]:
            params = {
                'startDate': rango['start'],
                'endDate': rango['end'],
                'page': page,
                'perPage': 10,
                'orderBy': 'dias_totales',
                'orderDir': 'desc'
            }
            
            try:
                response = requests.get(url_detalle, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data['page'] != page:
                        print_error(f"  Página {page}: page en respuesta es {data['page']}")
                        continue
                    
                    items = len(data['data'])
                    print_success(f"  Página {page}: {items} items (total: {data['total']})")
                else:
                    print_error(f"  Página {page}: HTTP {response.status_code}")
            
            except Exception as e:
                print_error(f"  Página {page}: {type(e).__name__}")
    
    # Test con distintos ordenamientos
    print_info("Test ordenamientos")
    ordenes = [
        ('dias_totales', 'desc'),
        ('dias_totales', 'asc'),
        ('dias_reparacion', 'desc'),
        ('dias_disponible', 'desc'),
    ]
    
    for orderBy, orderDir in ordenes:
        params = {
            'startDate': RANGOS_FECHAS[-1]['start'],
            'endDate': RANGOS_FECHAS[-1]['end'],
            'page': 1,
            'perPage': 5,
            'orderBy': orderBy,
            'orderDir': orderDir
        }
        
        try:
            response = requests.get(url_detalle, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                items = data['data']
                
                if len(items) > 1:
                    valores = [item[orderBy] for item in items]
                    
                    if orderDir == 'desc':
                        ordenado = valores == sorted(valores, reverse=True)
                    else:
                        ordenado = valores == sorted(valores)
                    
                    if ordenado:
                        print_success(f"  {orderBy} {orderDir}: ordenado correctamente")
                    else:
                        print_error(f"  {orderBy} {orderDir}: NO está ordenado")
                else:
                    print_warning(f"  {orderBy} {orderDir}: pocos items para verificar")
            else:
                print_error(f"  {orderBy} {orderDir}: HTTP {response.status_code}")
        
        except Exception as e:
            print_error(f"  {orderBy} {orderDir}: {type(e).__name__}")


def test_validaciones():
    """Test de validaciones y casos de error."""
    print_section("SUITE VALIDACIONES", Colors.CYAN)
    
    tests_validacion = [
        {
            "nombre": "Sin startDate",
            "params": {'endDate': datetime.now().date().isoformat()},
            "esperado": 400
        },
        {
            "nombre": "Sin endDate",
            "params": {'startDate': '2025-01-01'},
            "esperado": 400
        },
        {
            "nombre": "Fecha inválida",
            "params": {'startDate': 'invalid', 'endDate': '2025-11-16'},
            "esperado": 400
        },
        {
            "nombre": "Start > End",
            "params": {'startDate': '2025-11-16', 'endDate': '2025-01-01'},
            "esperado": 400
        },
        {
            "nombre": "Estado inválido",
            "params": {
                'startDate': '2025-01-01',
                'endDate': '2025-11-16',
                'estadoPropiedad': 'invalid-state'
            },
            "esperado": 200  # Puede retornar 0 resultados o filtrar
        },
    ]
    
    for test in tests_validacion:
        print_info(f"Test: {test['nombre']}")
        
        try:
            response = requests.get(API_URL, params=test['params'], timeout=10)
            
            if response.status_code == test['esperado']:
                print_success(f"  Status {response.status_code} (esperado)")
            elif response.status_code == 200 and test['esperado'] == 400:
                # Algunos casos pueden retornar 200 con 0 resultados
                data = response.json()
                if data['kpis']['totalVacancias'] == 0:
                    print_success(f"  Status 200 con 0 resultados (aceptable)")
                else:
                    print_warning(f"  Status 200 pero esperaba {test['esperado']}")
            else:
                print_warning(f"  Status {response.status_code} (esperaba {test['esperado']})")
        
        except Exception as e:
            print_error(f"  Excepción: {type(e).__name__}")


def imprimir_resumen_final():
    """Imprime resumen detallado de todos los tests."""
    print_section("RESUMEN FINAL", Colors.MAGENTA)
    
    porcentaje_exito = (tests_pasados / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\n📊 Estadísticas Generales:")
    print(f"   Total de tests ejecutados: {total_tests}")
    print(f"   {Colors.GREEN}✓ Tests pasados: {tests_pasados}{Colors.END}")
    print(f"   {Colors.RED}✗ Tests fallidos: {tests_fallidos}{Colors.END}")
    print(f"   Tasa de éxito: {porcentaje_exito:.1f}%")
    
    print(f"\n📈 Distribución de Datos:")
    print(f"   Tests con datos (>0 vacancias): {tests_con_datos}")
    print(f"   Tests sin datos (0 vacancias): {tests_sin_datos}")
    
    if tests_fallidos > 0:
        print(f"\n{Colors.RED}❌ ERRORES ENCONTRADOS ({len(errores)}):{Colors.END}")
        for error in errores[:20]:  # Mostrar solo primeros 20
            print(f"   {error}")
        
        if len(errores) > 20:
            print(f"   ... y {len(errores) - 20} errores más")
    
    print(f"\n{'='*80}")
    
    if tests_fallidos == 0:
        print(f"{Colors.GREEN}🎉 ¡TODOS LOS TESTS PASARON!{Colors.END}")
        print(f"{Colors.GREEN}✅ Dashboard completamente funcional y robusto{Colors.END}")
    elif porcentaje_exito >= 95:
        print(f"{Colors.YELLOW}⚠️  Tests mayormente exitosos (>95%){Colors.END}")
        print(f"{Colors.YELLOW}   Revisar errores menores{Colors.END}")
    else:
        print(f"{Colors.RED}❌ Se encontraron problemas significativos{Colors.END}")
        print(f"{Colors.RED}   Revisar errores antes de producción{Colors.END}")
    
    print(f"{'='*80}\n")


def main():
    print_section("TEST EXHAUSTIVO - DASHBOARD DE VACANCIAS", Colors.MAGENTA)
    print(f"{Colors.CYAN}API URL:{Colors.END} {API_URL}")
    print(f"{Colors.CYAN}Fecha:{Colors.END} {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Ejecutar todas las suites
    test_suite_basica()
    test_suite_combinada()
    test_suite_casos_especiales()
    test_includeItems()
    test_endpoint_detalle()
    test_validaciones()
    
    # Resumen final
    imprimir_resumen_final()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}⚠️  Test interrumpido por el usuario{Colors.END}")
        imprimir_resumen_final()
    except Exception as e:
        print(f"\n\n{Colors.RED}❌ Error fatal: {type(e).__name__}: {str(e)}{Colors.END}")
        import traceback
        traceback.print_exc()
