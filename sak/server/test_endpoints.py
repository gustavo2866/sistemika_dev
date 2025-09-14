import requests
import json

def test_endpoints():
    """Probar los endpoints de facturas"""
    base_url = "http://localhost:8000"
    
    try:
        # Test 1: Endpoint de test
        print("🧪 Testing /test-pdf/ endpoint...")
        response = requests.post(f"{base_url}/api/v1/facturas/test-pdf/")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Test endpoint: {data.get('message', 'OK')}")
            print(f"OpenAI configured: {data.get('openai_configured', False)}")
        else:
            print(f"❌ Error: {response.text}")
        print()
        
        # Test 2: Listar archivos de facturas
        print("📂 Testing /files/ endpoint...")
        response = requests.get(f"{base_url}/api/v1/facturas/files/")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Files endpoint: {data.get('total', 0)} archivos encontrados")
        else:
            print(f"❌ Error: {response.text}")
        print()
        
        # Test 3: Verificar documentación
        print("📖 Testing /docs endpoint...")
        response = requests.get(f"{base_url}/docs")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Documentation available")
        else:
            print(f"❌ Error accessing docs")
        
    except requests.exceptions.ConnectionError:
        print("❌ No se puede conectar al servidor en localhost:8000")
        print("Verificar que el servidor esté ejecutándose")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("=== Test de Endpoints de Facturas ===\n")
    test_endpoints()
    print("\n=== Test Completado ===")
