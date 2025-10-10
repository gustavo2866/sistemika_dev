#!/usr/bin/env python3
"""
Test para verificar acceso a PDF en Cloudinary
"""

import requests

print("=" * 60)
print("🧪 TEST DE ACCESO A PDF EN CLOUDINARY")
print("=" * 60)

# Sube una factura desde el frontend primero, luego copia la URL aquí
test_url = input("\n📎 Pega la URL del PDF de Cloudinary aquí: ").strip()

if not test_url:
    print("\n❌ No se proporcionó URL")
    exit(1)

print(f"\n🔍 Verificando acceso a: {test_url}")

try:
    response = requests.get(test_url, timeout=10)
    
    print(f"\n📊 Resultado:")
    print(f"   Status Code: {response.status_code}")
    print(f"   Content-Type: {response.headers.get('Content-Type', 'N/A')}")
    print(f"   Content-Length: {response.headers.get('Content-Length', 'N/A')} bytes")
    
    if response.status_code == 200:
        print(f"\n✅ ¡ACCESO EXITOSO!")
        print(f"   El PDF es público y accesible")
    elif response.status_code == 401:
        print(f"\n❌ ERROR 401: No autorizado")
        print(f"   El archivo sigue siendo privado")
        print(f"\n💡 Solución:")
        print(f"   1. Ve a https://console.cloudinary.com/settings/security")
        print(f"   2. Busca 'Resource access control' o similar")
        print(f"   3. Asegúrate de que archivos 'upload' sean públicos")
    else:
        print(f"\n⚠️ Respuesta inesperada: {response.status_code}")
        
except requests.exceptions.RequestException as e:
    print(f"\n❌ Error de conexión: {e}")
