"""
Test de endpoints CRM en GCP Production
"""
import requests
import json
from datetime import datetime

# URL del backend en GCP
BASE_URL = "https://sak-backend-94464199991.us-central1.run.app"

def test_health():
    """Probar endpoint de health"""
    print("\n" + "="*70)
    print("TEST: HEALTH CHECK")
    print("="*70)
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"✅ Backend activo: {response.json()}")
        else:
            print(f"❌ Error: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        return False

def test_catalogos_crm():
    """Probar endpoints de catálogos CRM"""
    print("\n" + "="*70)
    print("TEST: ENDPOINTS DE CATÁLOGOS CRM")
    print("="*70)
    
    catalogos = [
        ("Tipos de Operación", "/crm/catalogos/tipos-operacion"),
        ("Motivos de Pérdida", "/crm/catalogos/motivos-perdida"),
        ("Condiciones de Pago", "/crm/catalogos/condiciones-pago"),
        ("Tipos de Evento", "/crm/catalogos/tipos-evento"),
        ("Motivos de Evento", "/crm/catalogos/motivos-evento"),
        ("Orígenes de Lead", "/crm/catalogos/origenes-lead"),
        ("Monedas", "/crm/catalogos/monedas"),
    ]
    
    resultados = []
    for nombre, endpoint in catalogos:
        try:
            url = f"{BASE_URL}{endpoint}"
            print(f"\n🔍 Probando: {nombre}")
            print(f"   URL: {url}")
            
            response = requests.get(url, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                # Puede ser lista directa o formato {"items": [...]}
                if isinstance(data, list):
                    count = len(data)
                    items = data
                elif isinstance(data, dict) and "items" in data:
                    count = len(data.get("items", []))
                    items = data.get("items", [])
                else:
                    count = 0
                    items = []
                
                print(f"   ✅ {count} registros")
                if count > 0 and items:
                    print(f"   Ejemplo: {items[0]}")
                resultados.append((nombre, True, count))
            elif response.status_code == 404:
                print(f"   ❌ Endpoint no encontrado (404)")
                resultados.append((nombre, False, "404 Not Found"))
            else:
                print(f"   ❌ Error {response.status_code}: {response.text[:200]}")
                resultados.append((nombre, False, f"Error {response.status_code}"))
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
            resultados.append((nombre, False, str(e)))
    
    return resultados

def test_contactos_crm():
    """Probar endpoints de contactos CRM"""
    print("\n" + "="*70)
    print("TEST: ENDPOINTS DE CONTACTOS CRM")
    print("="*70)
    
    try:
        url = f"{BASE_URL}/crm/contactos"
        print(f"\n🔍 GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict):
                count = len(data.get("items", []))
            else:
                count = 0
            print(f"✅ {count} contactos encontrados")
            return True
        elif response.status_code == 404:
            print(f"❌ Endpoint no encontrado (404)")
            return False
        else:
            print(f"❌ Error {response.status_code}: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_oportunidades_crm():
    """Probar endpoints de oportunidades CRM"""
    print("\n" + "="*70)
    print("TEST: ENDPOINTS DE OPORTUNIDADES CRM")
    print("="*70)
    
    try:
        url = f"{BASE_URL}/crm/oportunidades"
        print(f"\n🔍 GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict):
                count = len(data.get("items", []))
            else:
                count = 0
            print(f"✅ {count} oportunidades encontradas")
            return True
        elif response.status_code == 404:
            print(f"❌ Endpoint no encontrado (404)")
            return False
        else:
            print(f"❌ Error {response.status_code}: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_emprendimientos():
    """Probar endpoints de emprendimientos"""
    print("\n" + "="*70)
    print("TEST: ENDPOINTS DE EMPRENDIMIENTOS")
    print("="*70)
    
    try:
        url = f"{BASE_URL}/emprendimientos"
        print(f"\n🔍 GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict):
                count = len(data.get("items", []))
            else:
                count = 0
            print(f"✅ {count} emprendimientos encontrados")
            return True
        elif response.status_code == 404:
            print(f"❌ Endpoint no encontrado (404)")
            return False
        else:
            print(f"❌ Error {response.status_code}: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def resumen_final(resultados):
    """Mostrar resumen final de pruebas"""
    print("\n" + "="*70)
    print("RESUMEN FINAL")
    print("="*70)
    
    exitosos = sum(1 for _, ok, _ in resultados if ok)
    fallidos = len(resultados) - exitosos
    
    print(f"\n✅ Exitosos: {exitosos}")
    print(f"❌ Fallidos: {fallidos}")
    
    if fallidos > 0:
        print("\nEndpoints con problemas:")
        for nombre, ok, info in resultados:
            if not ok:
                print(f"  - {nombre}: {info}")

def main():
    print("="*70)
    print("PRUEBA DE ENDPOINTS CRM - BACKEND GCP PRODUCCIÓN")
    print("="*70)
    print(f"URL Base: {BASE_URL}")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. Health check
    if not test_health():
        print("\n❌ Backend no está disponible. Abortando pruebas.")
        return
    
    # 2. Catálogos CRM
    resultados = test_catalogos_crm()
    
    # 3. Contactos
    contactos_ok = test_contactos_crm()
    resultados.append(("Contactos CRM", contactos_ok, ""))
    
    # 4. Oportunidades
    oportunidades_ok = test_oportunidades_crm()
    resultados.append(("Oportunidades CRM", oportunidades_ok, ""))
    
    # 5. Emprendimientos
    emprendimientos_ok = test_emprendimientos()
    resultados.append(("Emprendimientos", emprendimientos_ok, ""))
    
    # Resumen
    resumen_final(resultados)

if __name__ == "__main__":
    main()
