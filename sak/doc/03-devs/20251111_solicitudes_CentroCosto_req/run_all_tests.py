"""
Script maestro para ejecutar todos los tests de Centro de Costo

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/run_all_tests.py
Ejecución: python doc/03-devs/20251111_solicitudes_CentroCosto_req/run_all_tests.py
"""
import sys
import subprocess
from pathlib import Path

# Colores para output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text: str):
    """Imprimir encabezado"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}{text.center(70)}{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")


def run_test_file(test_file: str, description: str) -> bool:
    """Ejecutar un archivo de tests"""
    print(f"\n{YELLOW}▶ {description}{RESET}")
    print(f"   Archivo: {test_file}\n")
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", test_file, "-v", "--tb=short"],
            capture_output=False,
            cwd=Path(__file__).parent.parent.parent.parent
        )
        
        if result.returncode == 0:
            print(f"\n{GREEN}✅ {description} - PASSED{RESET}")
            return True
        else:
            print(f"\n{RED}❌ {description} - FAILED{RESET}")
            return False
    except Exception as e:
        print(f"\n{RED}❌ Error ejecutando {description}: {e}{RESET}")
        return False


def main():
    """Ejecutar todos los tests"""
    print_header("🧪 TESTS DE CENTRO DE COSTO - SUITE COMPLETA")
    
    base_path = "doc/03-devs/20251111_solicitudes_CentroCosto_req"
    
    tests = [
        (f"{base_path}/test_centro_costo_models.py", "Tests de Modelo CentroCosto"),
        (f"{base_path}/test_solicitud_detalle_precio.py", "Tests de SolicitudDetalle (precio/importe)"),
        (f"{base_path}/test_centro_costo_endpoints.py", "Tests de Endpoints CentroCosto (requiere servidor)"),
        (f"{base_path}/test_solicitud_centro_costo.py", "Tests de Integración Solicitud + CentroCosto (requiere servidor)"),
    ]
    
    results = []
    
    for test_file, description in tests:
        if "endpoints" in test_file or "solicitud_centro_costo" in test_file:
            print(f"\n{YELLOW}⚠️  NOTA: Este test requiere que el servidor esté corriendo en http://localhost:8000{RESET}")
            response = input(f"¿Ejecutar '{description}'? (s/n): ").lower()
            if response != 's':
                print(f"{YELLOW}⏭️  Test omitido{RESET}")
                results.append((description, None))
                continue
        
        success = run_test_file(test_file, description)
        results.append((description, success))
    
    # Resumen final
    print_header("📊 RESUMEN DE TESTS")
    
    passed = sum(1 for _, result in results if result is True)
    failed = sum(1 for _, result in results if result is False)
    skipped = sum(1 for _, result in results if result is None)
    total = len(results)
    
    for description, result in results:
        if result is True:
            print(f"{GREEN}✅ {description}{RESET}")
        elif result is False:
            print(f"{RED}❌ {description}{RESET}")
        else:
            print(f"{YELLOW}⏭️  {description} (omitido){RESET}")
    
    print(f"\n{BLUE}Total:{RESET} {total}")
    print(f"{GREEN}Passed:{RESET} {passed}")
    print(f"{RED}Failed:{RESET} {failed}")
    print(f"{YELLOW}Skipped:{RESET} {skipped}")
    
    if failed > 0:
        print(f"\n{RED}❌ Algunos tests fallaron{RESET}")
        return 1
    elif skipped == total:
        print(f"\n{YELLOW}⚠️  Todos los tests fueron omitidos{RESET}")
        return 0
    else:
        print(f"\n{GREEN}✅ Todos los tests ejecutados pasaron correctamente{RESET}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
