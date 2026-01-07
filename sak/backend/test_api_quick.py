#!/usr/bin/env python3
"""
Test rápido de la API de calculadora financiera
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8001/api/calculadora"

def test_health():
    """Verificar que la API esté funcionando"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ API Health Check OK:", response.json())
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error conectando: {e}")
        return False

def test_sistema_frances():
    """Test sistema francés con datos del Excel"""
    payload = {
        "capital": 14700000,
        "plazo_meses": 36,
        "tna": 60.0,
        "sistema": "FRANCES"
    }
    
    response = requests.post(f"{BASE_URL}/calcular/resumen", json=payload)
    print(f"\n🇫🇷 Sistema Francés (Resumen): {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Capital: ${data['capital']:,.0f}")
        print(f"   TEM: {data['tem']}%")
        print(f"   Cuota fija: ${data['cuota_fija']:,.0f}")
        print(f"   Total intereses: ${data['total_intereses']:,.0f}")
    else:
        print(f"   Error: {response.text}")

def test_sistema_aleman():
    """Test sistema alemán con datos del Excel"""
    payload = {
        "capital": 4000000,
        "plazo_meses": 48,
        "tna": 21.0,
        "sistema": "ALEMAN"
    }
    
    response = requests.post(f"{BASE_URL}/calcular/resumen", json=payload)
    print(f"\n🇩🇪 Sistema Alemán (Resumen): {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Capital: ${data['capital']:,.0f}")
        print(f"   TEM: {data['tem']}%")
        print(f"   Primera cuota: ${data['primera_cuota']:,.0f}")
        print(f"   Última cuota: ${data['ultima_cuota']:,.0f}")
        print(f"   Total intereses: ${data['total_intereses']:,.0f}")
    else:
        print(f"   Error: {response.text}")

if __name__ == "__main__":
    print("🧮 Test rápido de Calculadora Financiera")
    print("=" * 50)
    
    if test_health():
        test_sistema_frances()
        test_sistema_aleman()
        print("\n✅ Tests completados")
    else:
        print("\n❌ No se pudo conectar al servidor")