"""
Script simple para probar los endpoints sin iniciar servidor
"""
import sys
import os

# Agregar el directorio backend al path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("=" * 60)
print("PROBANDO ENDPOINTS DE META WHATSAPP")
print("=" * 60)

# Test 1: Verificar que el servidor responde
print("\n1. Test básico - Health check")
try:
    response = client.get("/")
    print(f"   Status: {response.status_code}")
    print(f"   [OK] Servidor responde correctamente")
except Exception as e:
    print(f"   [ERROR] Error: {e}")

# Test 2: Listar celulares
print("\n2. GET /crm/celulares - Listar celulares")
try:
    response = client.get("/crm/celulares")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Total celulares: {len(data)}")
        for celular in data:
            print(f"   - {celular.get('alias', 'Sin alias')}: {celular.get('numero_celular')}")
        print(f"   ✅ Endpoint funciona correctamente")
    else:
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Verificación de webhook (GET)
print("\n3. GET /api/webhooks/meta-whatsapp/ - Verificación de webhook")
try:
    os.environ["META_WEBHOOK_VERIFY_TOKEN"] = "test_token_123"
    response = client.get(
        "/api/webhooks/meta-whatsapp/",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "test_token_123",
            "hub.challenge": "challenge_test_12345"
        }
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Challenge devuelto: {data.get('challenge')}")
        print(f"   ✅ Verificación de webhook funciona correctamente")
    else:
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Webhook de mensaje entrante (POST)
print("\n4. POST /api/webhooks/meta-whatsapp/ - Mensaje entrante")
payload = {
    "object": "whatsapp_business_account",
    "entry": [
        {
            "id": "123456789",  # Este debe coincidir con meta_w_empresa_id
            "changes": [
                {
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "phone_number_id": "123456789012345",  # Coincide con el celular creado
                            "display_phone_number": "+59899123456"
                        },
                        "contacts": [
                            {
                                "profile": {"name": "Test Usuario"},
                                "wa_id": "59899999888"
                            }
                        ],
                        "messages": [
                            {
                                "from": "59899999888",
                                "id": "wamid.test123",
                                "timestamp": "2025-12-18T10:00:00Z",
                                "type": "text",
                                "text": {"body": "Hola, es una prueba"}
                            }
                        ]
                    },
                    "field": "messages"
                }
            ]
        }
    ]
}

try:
    response = client.post("/api/webhooks/meta-whatsapp/", json=payload)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Response: {data}")
        print(f"   ✅ Webhook procesado correctamente")
    else:
        print(f"   Response: {response.text}")
        print(f"   ⚠️  Puede fallar si meta_w_empresa_id no coincide con 123456789")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 60)
print("PRUEBAS COMPLETADAS")
print("=" * 60)

