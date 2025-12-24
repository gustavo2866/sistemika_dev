import requests
import json

def test_evento_endpoint():
    url = "http://localhost:8000/crm/eventos"
    payload = {
        "fecha_evento": "2025-12-24T09:00",
        "estado_evento": "1-pendiente",
        "asignado_a_id": 1,
        "contacto_id": 74,
        "motivo_id": 1,
        "oportunidad_id": 133,
        "tipo_evento": "evento",
        "tipo_id": 1,
        "titulo": "Alquilar depto"
    }
    print("\n--- Probando endpoint /crm/eventos ---")
    print("Payload:", json.dumps(payload, indent=2, ensure_ascii=False))
    response = requests.post(url, json=payload)
    print("Status:", response.status_code)
    try:
        print("Response:", json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception:
        print("Response:", response.text)

if __name__ == "__main__":
    test_evento_endpoint()
