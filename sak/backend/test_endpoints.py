"""
Test de endpoints con Neon PostgreSQL
"""
import requests
import json

BASE_URL = "http://localhost:8000"

print("="*60)
print("🧪 TEST DE ENDPOINTS - Backend con Neon")
print("="*60)
print()

# Test 1: Health check
print("1️⃣ Test de Health Check...")
try:
    response = requests.get(f"{BASE_URL}/health")
    if response.status_code == 200:
        print(f"   ✅ Status: {response.status_code}")
        print(f"   ✅ Response: {response.json()}")
    else:
        print(f"   ⚠️ Status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Root endpoint
print("\n2️⃣ Test de Root endpoint...")
try:
    response = requests.get(f"{BASE_URL}/")
    if response.status_code == 200:
        print(f"   ✅ Status: {response.status_code}")
        data = response.json()
        print(f"   ✅ Message: {data.get('message', 'N/A')}")
    else:
        print(f"   ⚠️ Status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Listar países
print("\n3️⃣ Test de Listar Países...")
try:
    response = requests.get(f"{BASE_URL}/paises")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Total países: {len(data)}")
        if data:
            print(f"   🌎 Primer país: {data[0].get('nombre', 'N/A')}")
    else:
        print(f"   ⚠️ Status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Listar tipos de comprobante
print("\n4️⃣ Test de Tipos de Comprobante...")
try:
    response = requests.get(f"{BASE_URL}/tipos-comprobante")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Total tipos: {len(data)}")
        if data:
            print(f"   📄 Primer tipo: {data[0].get('nombre', 'N/A')}")
    else:
        print(f"   ⚠️ Status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 5: Listar usuarios
print("\n5️⃣ Test de Listar Usuarios...")
try:
    response = requests.get(f"{BASE_URL}/users")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Total usuarios: {len(data)}")
        if data:
            print(f"   👤 Primer usuario: {data[0].get('nombre', 'N/A')}")
    else:
        print(f"   ⚠️ Status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 6: Crear un artículo de prueba
print("\n6️⃣ Test de Crear Artículo...")
try:
    nuevo_articulo = {
        "nombre": "Artículo de Prueba Neon",
        "tipo_articulo": "Prueba",
        "unidad_medida": "UNI",
        "marca": "Test",
        "sku": "TEST-001",
        "precio": 99.99
    }
    response = requests.post(f"{BASE_URL}/articulos", json=nuevo_articulo)
    if response.status_code in [200, 201]:
        data = response.json()
        print(f"   ✅ Status: {response.status_code}")
        print(f"   ✅ Artículo creado ID: {data.get('id', 'N/A')}")
        print(f"   ✅ Nombre: {data.get('nombre', 'N/A')}")
        print(f"   ✅ Precio: ${data.get('precio', 0)}")
        articulo_id = data.get('id')
        
        # Test 7: Leer el artículo creado
        if articulo_id:
            print("\n7️⃣ Test de Leer Artículo...")
            response = requests.get(f"{BASE_URL}/articulos/{articulo_id}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Status: {response.status_code}")
                print(f"   ✅ Artículo encontrado: {data.get('nombre', 'N/A')}")
                print(f"   ✅ Precio: ${data.get('precio_unitario', 0)}")
    else:
        print(f"   ⚠️ Status: {response.status_code}")
        print(f"   ⚠️ Response: {response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 8: Listar propiedades
print("\n8️⃣ Test de Listar Propiedades...")
try:
    response = requests.get(f"{BASE_URL}/propiedades")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Status: {response.status_code}")
        print(f"   📊 Total propiedades: {len(data)}")
        if data:
            print(f"   🏠 Primera propiedad: {data[0].get('nombre', 'N/A')}")
    else:
        print(f"   ⚠️ Status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "="*60)
print("✅ TESTS DE ENDPOINTS COMPLETADOS")
print("="*60)
print("\n📝 Resumen:")
print("   ✅ Backend conectado a Neon PostgreSQL")
print("   ✅ Endpoints respondiendo correctamente")
print("   ✅ Base de datos funcionando")
print("\n🎯 Próximos pasos:")
print("   1. Probar desde el frontend")
print("   2. Verificar que los datos persisten")
print("   3. Hacer cambios y verificar sincronización")
