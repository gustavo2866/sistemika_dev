import argparse
import json
from typing import Any, Dict

import requests


DEFAULT_URL = "http://127.0.0.1:8000/api/webhooks/meta-whatsapp/"

# Payload tomado del requerimiento para simular un mensaje entrante
PAYLOAD: Dict[str, Any] = {
    "event_type": "message.received",
    "timestamp": "2025-12-19T22:05:15.951743Z",
    "mensaje": {
        "id": "99c82c2b-0878-41bb-be74-385ce55d273d",
        "meta_message_id": "wamid.HBgNNTQ5MTE1NjM4NDMxMBUCABIYFDNBQUE2N0I3NjU5QTFENEQ4MTU3AA==",
        "from_phone": "5491156384310",
        "from_name": "Gustavo",
        "to_phone": "+15551676015",
        "direccion": "in",
        "tipo": "text",
        "texto": "Si me interesa podemos agendar una visita? Cuando ?",
        "media_id": None,
        "caption": None,
        "filename": None,
        "mime_type": None,
        "status": "queued",
        "meta_timestamp": "2025-12-19T07:59:23",
        "created_at": "2025-12-19T10:59:24.475858",
        "celular": {
            "id": "14b530aa-ff61-44be-af48-957dabde4f28",
            "alias": "WhatsApp Business",
            "phone_number": "+15551676015",
        },
    },
}


def send_payload(url: str, payload: Dict[str, Any]) -> None:
    response = requests.post(url, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    try:
        data = response.json()
        print("Response JSON:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except ValueError:
        print("Response text:")
        print(response.text)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Simula la recepcion de un mensaje entrante desde Meta WhatsApp."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help="URL del endpoint /webhooks/meta-whatsapp/ (por defecto usa localhost).",
    )
    args = parser.parse_args()
    send_payload(args.url, PAYLOAD)


if __name__ == "__main__":
    main()
