"""
Test manual para simular exactamente la llamada del frontend
"""
import requests
import json

BASE_URL = "http://localhost:8000"

# Usar el mensaje ID 44 que sabemos que existe y no tiene contacto
mensaje_id = 44

print(f"\n{'='*60}")
print(f"TEST: Responder mensaje {mensaje_id} SIN contacto")
print(f"{'='*60}\n")

# Payload exacto como lo enviaría el frontend
payload = {
    "asunto": "RE: Seguimiento de presupuesto",
    "contenido": "Esta es la respuesta de prueba, espero que salga bien",
    "contacto_nombre": "Juan perez 5"  # El valor que muestra la imagen
}

print("Payload enviado:")
print(json.dumps(payload, indent=2))
print(f"\n{'='*60}\n")

response = requests.post(
    f"{BASE_URL}/crm/mensajes/{mensaje_id}/responder",
    json=payload
)

print(f"Status Code: {response.status_code}")
print(f"\n{'='*60}")
print("Respuesta:")
print(f"{'='*60}\n")

if response.status_code == 200:
    resultado = response.json()
    print(json.dumps(resultado, indent=2, default=str))
    print(f"\n{'='*60}")
    print("✓ ÉXITO!")
    print(f"{'='*60}\n")
else:
    print(f"✗ ERROR:")
    try:
        error = response.json()
        print(json.dumps(error, indent=2))
    except:
        print(response.text)
    print(f"\n{'='*60}\n")
