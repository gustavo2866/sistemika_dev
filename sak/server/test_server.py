import requests
import json

def test_server():
    """Probar que el servidor responde"""
    try:
        # Test endpoint básico
        print("Testing server status...")
        response = requests.get("http://localhost:8000/docs")
        print(f"Server status: {response.status_code}")
        
        # Test endpoint de test
        print("\nTesting /test-pdf/ endpoint...")
        response = requests.post("http://localhost:8000/api/facturas/test-pdf/")
        print(f"Test endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ No se puede conectar al servidor en localhost:8000")
        print("Verificar que el servidor esté ejecutándose con: uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_server()
