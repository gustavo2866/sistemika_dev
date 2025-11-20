"""
Script Maestro para ejecutar todos los tests del módulo CRM
Ejecuta tests de servicios y endpoints en secuencia
"""
import sys
import os
import subprocess

# Cambiar al directorio del script
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Agregar backend al path
backend_path = os.path.abspath(os.path.join(script_dir, '../../backend'))
sys.path.insert(0, backend_path)

def run_test_file(filename, description):
    """Ejecutar un archivo de test y reportar resultado"""
    print(f"\n{'='*80}")
    print(f"EJECUTANDO: {description}")
    print(f"Archivo: {filename}")
    print('='*80 + '\n')
    
    try:
        # Ejecutar el script de test
        result = subprocess.run(
            [sys.executable, filename],
            cwd=script_dir,
            capture_output=False,
            text=True
        )
        
        if result.returncode == 0:
            print(f"\n✅ {description} - COMPLETADO")
            return True
        else:
            print(f"\n❌ {description} - FALLÓ")
            return False
    except Exception as e:
        print(f"\n❌ ERROR ejecutando {description}: {e}")
        return False


def main():
    """Ejecutar todos los tests"""
    print("\n" + "="*80)
    print("SUITE COMPLETA DE TESTS - MÓDULO CRM OPORTUNIDADES")
    print("="*80 + "\n")
    
    resultados = []
    
    # 1. Tests de Servicios
    print("\n📋 FASE 1: TESTS DE SERVICIOS")
    print("-" * 80)
    
    resultados.append(("CRM Contacto Service", run_test_file(
        "test_crm_contacto_service.py",
        "Tests CRM Contacto Service"
    )))
    
    resultados.append(("CRM Oportunidad Service", run_test_file(
        "test_crm_oportunidad_service.py",
        "Tests CRM Oportunidad Service"
    )))
    
    resultados.append(("Cotización Service", run_test_file(
        "test_cotizacion_service.py",
        "Tests Cotización Service"
    )))
    
    # 2. Tests de Endpoints
    print("\n📋 FASE 2: TESTS DE ENDPOINTS")
    print("-" * 80)
    
    resultados.append(("CRM Endpoints", run_test_file(
        "test_crm_endpoints.py",
        "Tests CRM Endpoints"
    )))
    
    # Resumen Final
    print("\n" + "="*80)
    print("RESUMEN DE EJECUCIÓN")
    print("="*80 + "\n")
    
    exitosos = sum(1 for _, resultado in resultados if resultado)
    total = len(resultados)
    
    print(f"Tests ejecutados: {total}")
    print(f"Exitosos: {exitosos}")
    print(f"Fallidos: {total - exitosos}\n")
    
    for nombre, resultado in resultados:
        simbolo = "✅" if resultado else "❌"
        print(f"  {simbolo} {nombre}")
    
    if exitosos == total:
        print("\n" + "="*80)
        print("🎉 ¡TODOS LOS TESTS PASARON EXITOSAMENTE!")
        print("="*80 + "\n")
        return 0
    else:
        print("\n" + "="*80)
        print(f"⚠️  {total - exitosos} SUITE(S) CON ERRORES")
        print("="*80 + "\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
