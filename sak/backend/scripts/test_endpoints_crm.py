"""
Test de endpoints CRM - Prueba funcional completa
"""
import sys
import os
from pathlib import Path
import json
from datetime import datetime

# Agregar backend al path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
load_dotenv(BACKEND_ROOT / ".env")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_catalogos():
    """Probar endpoints de catálogos CRM"""
    print("\n" + "="*70)
    print("TEST 1: ENDPOINTS DE CATÁLOGOS CRM")
    print("="*70)
    
    catalogos = [
        ("tipos-operacion", "/crm/catalogos/tipos-operacion"),
        ("motivos-perdida", "/crm/catalogos/motivos-perdida"),
        ("condiciones-pago", "/crm/catalogos/condiciones-pago"),
        ("tipos-evento", "/crm/catalogos/tipos-evento"),
        ("motivos-evento", "/crm/catalogos/motivos-evento"),
        ("origenes-lead", "/crm/catalogos/origenes-lead"),
        ("monedas", "/crm/catalogos/monedas"),
    ]
    
    errores = []
    for nombre, endpoint in catalogos:
        try:
            response = client.get(endpoint)
            if response.status_code == 200:
                data = response.json()
                # Puede ser lista directa o formato {"items": [...]}
                if isinstance(data, list):
                    count = len(data)
                else:
                    count = len(data.get("items", []))
                print(f"   ✅ {nombre}: {count} registros")
            else:
                errores.append(f"{nombre}: HTTP {response.status_code}")
                print(f"   ❌ {nombre}: HTTP {response.status_code}")
        except Exception as e:
            errores.append(f"{nombre}: {str(e)}")
            print(f"   ❌ {nombre}: {str(e)}")
    
    return len(errores) == 0


def test_contactos():
    """Probar endpoints de contactos"""
    print("\n" + "="*70)
    print("TEST 2: ENDPOINTS DE CONTACTOS")
    print("="*70)
    
    errores = []
    
    # GET list
    try:
        response = client.get("/crm/contactos")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                count = len(data)
            else:
                count = len(data.get("items", []))
            print(f"   ✅ GET /crm/contactos: {count} contactos")
        else:
            errores.append(f"GET list: HTTP {response.status_code}")
            print(f"   ❌ GET /crm/contactos: HTTP {response.status_code}")
    except Exception as e:
        errores.append(f"GET list: {str(e)}")
        print(f"   ❌ GET /crm/contactos: {str(e)}")
    
    # GET detail
    try:
        response = client.get("/crm/contactos/1")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ GET /crm/contactos/1: {data.get('nombre_completo', 'N/A')}")
        else:
            errores.append(f"GET detail: HTTP {response.status_code}")
            print(f"   ❌ GET /crm/contactos/1: HTTP {response.status_code}")
    except Exception as e:
        errores.append(f"GET detail: {str(e)}")
        print(f"   ❌ GET /crm/contactos/1: {str(e)}")
    
    # POST create (contacto de prueba)
    try:
        nuevo_contacto = {
            "nombre_completo": "Test Deploy CRM",
            "telefonos": ["+541199998888"],
            "email": "test.deploy@crm.com",
            "responsable_id": 1,
            "notas": "Contacto de prueba post-deploy"
        }
        response = client.post("/crm/contactos", json=nuevo_contacto)
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"   ✅ POST /crm/contactos: Creado ID {data.get('id')}")
        else:
            # Puede devolver existente
            if response.status_code == 200:
                print(f"   ⚠️ POST /crm/contactos: Contacto ya existe (deduplicación)")
            else:
                errores.append(f"POST create: HTTP {response.status_code}")
                print(f"   ❌ POST /crm/contactos: HTTP {response.status_code}")
                print(f"      Response: {response.text[:200]}")
    except Exception as e:
        errores.append(f"POST create: {str(e)}")
        print(f"   ❌ POST /crm/contactos: {str(e)}")
    
    return len(errores) == 0


def test_oportunidades():
    """Probar endpoints de oportunidades"""
    print("\n" + "="*70)
    print("TEST 3: ENDPOINTS DE OPORTUNIDADES")
    print("="*70)
    
    errores = []
    
    # GET list
    try:
        response = client.get("/crm/oportunidades")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                count = len(data)
            else:
                count = len(data.get("items", []))
            print(f"   ✅ GET /crm/oportunidades: {count} oportunidades")
        else:
            errores.append(f"GET list: HTTP {response.status_code}")
            print(f"   ❌ GET /crm/oportunidades: HTTP {response.status_code}")
    except Exception as e:
        errores.append(f"GET list: {str(e)}")
        print(f"   ❌ GET /crm/oportunidades: {str(e)}")
    
    # GET detail
    try:
        response = client.get("/crm/oportunidades/1")
        if response.status_code == 200:
            data = response.json()
            estado = data.get('estado', 'N/A')
            print(f"   ✅ GET /crm/oportunidades/1: Estado {estado}")
        else:
            errores.append(f"GET detail: HTTP {response.status_code}")
            print(f"   ❌ GET /crm/oportunidades/1: HTTP {response.status_code}")
    except Exception as e:
        errores.append(f"GET detail: {str(e)}")
        print(f"   ❌ GET /crm/oportunidades/1: {str(e)}")
    
    # POST create (oportunidad de prueba)
    try:
        nueva_opp = {
            "contacto_id": 1,
            "tipo_operacion_id": 1,
            "propiedad_id": 2,
            "estado": "1-abierta",
            "responsable_id": 1,
            "descripcion_estado": "Oportunidad de prueba post-deploy CRM",
            "fecha_estado": datetime.now().isoformat()
        }
        response = client.post("/crm/oportunidades", json=nueva_opp)
        if response.status_code in [200, 201]:
            data = response.json()
            opp_id = data.get('id')
            print(f"   ✅ POST /crm/oportunidades: Creada ID {opp_id}")
            return opp_id  # Retornar para test de cambio de estado
        else:
            errores.append(f"POST create: HTTP {response.status_code}")
            print(f"   ❌ POST /crm/oportunidades: HTTP {response.status_code}")
            print(f"      Response: {response.text[:200]}")
    except Exception as e:
        errores.append(f"POST create: {str(e)}")
        print(f"   ❌ POST /crm/oportunidades: {str(e)}")
    
    return len(errores) == 0


def test_eventos():
    """Probar endpoints de eventos"""
    print("\n" + "="*70)
    print("TEST 4: ENDPOINTS DE EVENTOS")
    print("="*70)
    
    errores = []
    
    # GET list
    try:
        response = client.get("/crm/eventos")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                count = len(data)
            else:
                count = len(data.get("items", []))
            print(f"   ✅ GET /crm/eventos: {count} eventos")
        else:
            errores.append(f"GET list: HTTP {response.status_code}")
            print(f"   ❌ GET /crm/eventos: HTTP {response.status_code}")
    except Exception as e:
        errores.append(f"GET list: {str(e)}")
        print(f"   ❌ GET /crm/eventos: {str(e)}")
    
    # POST create
    try:
        nuevo_evento = {
            "contacto_id": 1,
            "tipo_id": 1,
            "motivo_id": 1,
            "fecha_evento": datetime.now().isoformat(),
            "descripcion": "Evento de prueba post-deploy",
            "asignado_a_id": 1,
            "estado_evento": "hecho"
        }
        response = client.post("/crm/eventos", json=nuevo_evento)
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"   ✅ POST /crm/eventos: Creado ID {data.get('id')}")
        else:
            errores.append(f"POST create: HTTP {response.status_code}")
            print(f"   ❌ POST /crm/eventos: HTTP {response.status_code}")
            print(f"      Response: {response.text[:200]}")
    except Exception as e:
        errores.append(f"POST create: {str(e)}")
        print(f"   ❌ POST /crm/eventos: {str(e)}")
    
    return len(errores) == 0


def main():
    print("\n" + "="*70)
    print("PRUEBA FUNCIONAL DE ENDPOINTS CRM")
    print("="*70)
    
    resultados = {
        "Catálogos": test_catalogos(),
        "Contactos": test_contactos(),
        "Oportunidades": test_oportunidades(),
        "Eventos": test_eventos(),
    }
    
    print("\n" + "="*70)
    print("RESUMEN DE PRUEBAS")
    print("="*70)
    
    total = len(resultados)
    exitosos = sum(1 for ok in resultados.values() if ok)
    
    for nombre, ok in resultados.items():
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"   {status} - {nombre}")
    
    print("\n" + "="*70)
    if exitosos == total:
        print(f"✅ TODOS LOS TESTS PASARON ({exitosos}/{total})")
        print("="*70)
        return 0
    else:
        print(f"⚠️ ALGUNOS TESTS FALLARON ({exitosos}/{total})")
        print("="*70)
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n❌ ERROR FATAL: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
