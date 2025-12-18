"""Test manual del endpoint responder"""
import requests

url = "http://localhost:8000/crm/mensajes/1/responder"
payload = {
    "texto": "Gracias por tu consulta. Te responderemos pronto."
}

print(f"🧪 Probando {url}")
print(f"📤 Payload: {payload}")

try:
    response = requests.post(url, json=payload)
    print(f"\n📊 Status: {response.status_code}")
    print(f"📄 Response:")
    print(response.json())
except Exception as e:
    print(f"❌ Error: {e}")
    if hasattr(e, 'response'):
        print(f"Response text: {e.response.text}")
