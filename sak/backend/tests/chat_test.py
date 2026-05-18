"""
Chat de prueba para el agente pedido_obra usando el mismo webhook que Meta.

Uso:
  python backend/tests/chat_test.py

Variables opcionales:
  CHAT_TEST_BASE_URL=http://localhost:8000
  CHAT_TEST_FROM_PHONE=5491156384310
  CHAT_TEST_FROM_NAME=Encargado Test
  CHAT_TEST_TO_PHONE=+5493815550000
  CHAT_TEST_CELULAR_ID=11111111-1111-1111-1111-111111111111

Importante:
  El telefono de prueba debe tener una oportunidad activa de proyecto/obra.
  Si el webhook crea un contacto nuevo sin oportunidad de proyecto, pedido_obra
  no se activa.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

BASE_URL = os.environ.get("CHAT_TEST_BASE_URL", "http://localhost:8000").rstrip("/")
FROM_PHONE = os.environ.get("CHAT_TEST_FROM_PHONE", "5491156384310")
FROM_NAME = os.environ.get("CHAT_TEST_FROM_NAME", "Encargado Test")
TO_PHONE = os.environ.get("CHAT_TEST_TO_PHONE", "+5493815550000")
CELULAR_ID = os.environ.get("CHAT_TEST_CELULAR_ID", "11111111-1111-1111-1111-111111111111")
CELULAR_ALIAS = os.environ.get("CHAT_TEST_CELULAR_ALIAS", "Linea test obra")
POLL_TIMEOUT_SECONDS = float(os.environ.get("CHAT_TEST_TIMEOUT", "30"))


def _request_json(method: str, path: str, payload: dict | None = None, params: dict | None = None) -> dict:
    url = f"{BASE_URL}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"

    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


def _build_webhook_payload(texto: str, meta_message_id: str) -> dict:
    now = datetime.now(UTC).isoformat()
    return {
        "event_type": "message.received",
        "timestamp": now,
        "mensaje": {
            "id": str(uuid4()),
            "meta_message_id": meta_message_id,
            "from_phone": FROM_PHONE,
            "from_name": FROM_NAME,
            "to_phone": TO_PHONE,
            "direccion": "in",
            "tipo": "text",
            "texto": texto,
            "media_id": None,
            "caption": None,
            "filename": None,
            "mime_type": None,
            "status": "received",
            "meta_timestamp": now,
            "created_at": now,
            "celular": {
                "id": CELULAR_ID,
                "alias": CELULAR_ALIAS,
                "phone_number": TO_PHONE,
            },
        },
    }


def enviar_webhook(texto: str) -> str:
    meta_message_id = f"wamid.chat-test.{uuid4().hex}"
    payload = _build_webhook_payload(texto, meta_message_id)
    _request_json("POST", "/api/webhooks/meta-whatsapp/", payload)
    return meta_message_id


def _listar_mensajes() -> list[dict]:
    response = _request_json(
        "GET",
        "/crm/mensajes/acciones/cursor",
        params={
            "contacto_referencia": FROM_PHONE,
            "canal": "whatsapp",
            "limit": 20,
        },
    )
    return response.get("data") or []


def _metadata(mensaje: dict) -> dict:
    raw = mensaje.get("metadata_json")
    if raw is None:
        raw = mensaje.get("metadata")
    return raw if isinstance(raw, dict) else {}


def esperar_resultado(meta_message_id: str) -> tuple[dict | None, dict | None, dict | None]:
    deadline = time.time() + POLL_TIMEOUT_SECONDS
    inbound = None

    while time.time() < deadline:
        mensajes = _listar_mensajes()
        inbound = next((m for m in mensajes if m.get("origen_externo_id") == meta_message_id), None)
        if inbound:
            agent_meta = _metadata(inbound).get("agent_v2") or {}
            result = agent_meta.get("result")
            if isinstance(result, dict):
                outbound_id = agent_meta.get("outbound_message_id") or (agent_meta.get("delivery") or {}).get("outbound_message_id")
                outbound = next((m for m in mensajes if m.get("id") == outbound_id), None)
                return inbound, result, outbound
        time.sleep(0.8)

    return inbound, None, None


def _reply_text(result: dict | None, outbound: dict | None) -> str:
    if outbound and outbound.get("contenido"):
        return str(outbound["contenido"])
    if result:
        for key in ("respuesta", "reply_to_user", "reply", "mensaje", "texto"):
            value = result.get(key)
            if value:
                return str(value)
    return "(sin respuesta)"


def _mostrar_estado(result: dict | None, inbound: dict | None, outbound: dict | None) -> None:
    agent_meta = (_metadata(inbound or {}).get("agent_v2") or {}) if inbound else {}
    if result:
        process_name = result.get("process_name") or agent_meta.get("process_name")
        if process_name:
            print(f"[Proceso: {process_name}]")
        if result.get("type") == "no_process":
            print(f"[Sin proceso: {result.get('reason') or 'no disponible'}]")
        items = result.get("items") or []
        if items:
            print("[Items]")
            for item in items:
                cant = item.get("cantidad")
                unidad = item.get("unidad") or ""
                desc = item.get("descripcion") or "?"
                if cant is None:
                    print(f"  - {desc} (sin cantidad)")
                else:
                    cantidad = _format_quantity(cant)
                    parts = [cantidad, unidad, desc]
                    print("  - " + " ".join(part for part in parts if part).strip())

    delivery = agent_meta.get("delivery") or {}
    if delivery:
        status = delivery.get("status")
        error = delivery.get("error_message")
        print(f"[Delivery: {status}{f' - {error}' if error else ''}]")
    elif outbound:
        print(f"[Salida CRM: {outbound.get('estado') or '?'}]")


def _format_quantity(value: Any) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return str(value)
    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:.2f}".rstrip("0").rstrip(".")


def main() -> None:
    print("=== Chat webhook pedido_obra ===")
    print(f"Webhook: {BASE_URL}/api/webhooks/meta-whatsapp/")
    print(f"Contacto hardcodeado: {FROM_NAME} <{FROM_PHONE}>")
    print("Nota: ese contacto debe tener una oportunidad activa de proyecto/obra.")
    print("Comandos: 'limpiar' envia cancelar, 'items' envia mostrar, 'salir' termina.\n")

    while True:
        try:
            texto = input("Vos: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nChau.")
            break

        if not texto:
            continue
        if texto.lower() == "salir":
            print("Chau.")
            break
        if texto.lower() == "limpiar":
            texto = "limpiar el pedido"
        elif texto.lower() in {"items", "item", "lista", "listar"}:
            texto = "mostrar"

        t_inicio = time.time()
        hora_envio = datetime.now().strftime("%H:%M:%S")
        try:
            meta_message_id = enviar_webhook(texto)
            inbound, result, outbound = esperar_resultado(meta_message_id)
        except urllib.error.URLError as exc:
            print(f"[Error] No se pudo conectar al servidor: {exc.reason}")
            continue
        except Exception as exc:
            print(f"[Error] {exc}")
            continue

        t_total = time.time() - t_inicio
        hora_respuesta = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{hora_envio} -> {hora_respuesta} | {t_total:.1f}s]")

        if result is None:
            if inbound is None:
                print("No encontre el mensaje entrante creado por el webhook.")
            else:
                print("El webhook guardo el mensaje, pero aun no hay resultado del agente.")
            continue

        print(f"Agente: {_reply_text(result, outbound)}\n")
        _mostrar_estado(result, inbound, outbound)
        print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
