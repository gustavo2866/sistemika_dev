"""
Chat de prueba para el agente de obra simulando el webhook de Meta.

Uso:
  python backend/scripts/chat_agent_smoke.py              # backend local
  python backend/scripts/chat_agent_smoke.py --gcp        # GCP test
  python backend/scripts/chat_agent_smoke.py --prod --allow-prod
  python backend/scripts/chat_agent_smoke.py --url https://mi-backend.run.app
  python backend/scripts/chat_agent_smoke.py --debug      # mostrar diagnostico tecnico
  python backend/scripts/chat_agent_smoke.py --timing     # mostrar timings
  python backend/scripts/chat_agent_smoke.py --read-mode api

Variables opcionales (sobreescritas por args de linea de comandos):
  CHAT_TEST_BASE_URL=http://localhost:8000
  CHAT_TEST_READ_MODE=auto         # auto | db | api
  CHAT_TEST_TYPING_INDICATOR=1
  CHAT_TEST_FROM_PHONE=5491156384310
  CHAT_TEST_FROM_NAME=Encargado Test
  CHAT_TEST_TO_PHONE=5493816259343
  CHAT_TEST_META_PHONE_NUMBER_ID=1046006975257973

Importante:
  El telefono de prueba debe tener una oportunidad activa de proyecto/obra.
  Si el webhook crea un contacto nuevo sin oportunidad de proyecto, los
  subprocesos del agente de obra no se activan.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

_GCP_TEST_URL = "https://sak-backend-test-94464199991.southamerica-east1.run.app"
_GCP_PROD_URL = "https://sak-backend-3urfgqrzea-rj.a.run.app"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chat de prueba para el agente de obra")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--gcp", action="store_true", help="Usar backend GCP test")
    group.add_argument("--prod", action="store_true", help="Usar backend GCP prod")
    group.add_argument("--url", default=None, help="URL base del backend custom")
    parser.add_argument(
        "--allow-prod",
        action="store_true",
        help="Confirmar explicitamente el uso del backend productivo",
    )
    parser.add_argument("--timing", action="store_true", help="Mostrar timings detallados")
    parser.add_argument("--debug", action="store_true", help="Mostrar diagnostico tecnico debajo de cada respuesta")
    parser.add_argument(
        "--read-mode",
        dest="read_mode",
        choices=["auto", "db", "api"],
        default=None,
        help="Modo de lectura de mensajes (default: auto)",
    )
    return parser.parse_args()


_args = (
    _parse_args()
    if __name__ == "__main__"
    else argparse.Namespace(url=None, prod=False, gcp=False, allow_prod=False, timing=False, debug=False, read_mode=None)
)

# CLI args always take precedence over env vars
if _args.url:
    BASE_URL = _args.url.rstrip("/")
elif _args.prod:
    BASE_URL = _GCP_PROD_URL
elif _args.gcp:
    BASE_URL = _GCP_TEST_URL
else:
    BASE_URL = os.environ.get("CHAT_TEST_BASE_URL", "http://localhost:8000").rstrip("/")

if BASE_URL == _GCP_PROD_URL and not _args.allow_prod:
    raise SystemExit("Para ejecutar contra produccion agrega --allow-prod.")

_read_mode_default = "api" if (BASE_URL != "http://localhost:8000" and not BASE_URL.startswith("http://127.")) else "auto"
READ_MODE = (_args.read_mode or os.environ.get("CHAT_TEST_READ_MODE", _read_mode_default)).strip().lower()

FROM_PHONE = os.environ.get("CHAT_TEST_FROM_PHONE", "5491156384310")
FROM_NAME = os.environ.get("CHAT_TEST_FROM_NAME", "Encargado Test")
TO_PHONE = os.environ.get("CHAT_TEST_TO_PHONE", "5493816259343")
META_PHONE_NUMBER_ID = os.environ.get("CHAT_TEST_META_PHONE_NUMBER_ID", "1046006975257973")
META_WABA_ID = os.environ.get("CHAT_TEST_META_WABA_ID", "1516474752918083")
POLL_TIMEOUT_SECONDS = float(os.environ.get("CHAT_TEST_TIMEOUT", "30"))
POLL_INTERVAL_SECONDS = float(os.environ.get("CHAT_TEST_POLL_INTERVAL", "0.2"))
SHOW_TYPING_INDICATOR = os.environ.get("CHAT_TEST_TYPING_INDICATOR", "1").strip().lower() not in {
    "0",
    "false",
    "no",
}
SHOW_TIMING = _args.timing or os.environ.get("CHAT_TEST_SHOW_TIMING", "").strip().lower() in {"1", "true", "yes", "si", "sí"}
SHOW_DEBUG = _args.debug or os.environ.get("CHAT_TEST_SHOW_DEBUG", "").strip().lower() in {"1", "true", "yes", "si", "sí"}


_DB_READ_FAILED = False


def _is_local_base_url() -> bool:
    return BASE_URL.startswith("http://localhost") or BASE_URL.startswith("http://127.0.0.1")


def _use_db_read_mode() -> bool:
    if READ_MODE == "db":
        return True
    if READ_MODE == "api":
        return False
    if READ_MODE == "auto":
        return _is_local_base_url()
    raise ValueError("CHAT_TEST_READ_MODE debe ser 'auto', 'db' o 'api'")


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


def _webhook_path() -> str:
    return "/api/channel-webhooks/meta/"


def _build_raw_meta_payload(texto: str, meta_message_id: str) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": META_WABA_ID,
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "metadata": {
                                "display_phone_number": TO_PHONE,
                                "phone_number_id": META_PHONE_NUMBER_ID,
                            },
                            "contacts": [
                                {
                                    "wa_id": FROM_PHONE,
                                    "profile": {"name": FROM_NAME},
                                }
                            ],
                            "messages": [
                                {
                                    "from": FROM_PHONE,
                                    "id": meta_message_id,
                                    "timestamp": str(int(time.time())),
                                    "type": "text",
                                    "text": {"body": texto},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }


def enviar_webhook(texto: str) -> tuple[str, dict, float]:
    meta_message_id = f"wamid.chat-test.{uuid4().hex}"
    payload = _build_raw_meta_payload(texto, meta_message_id)
    started = time.time()
    response = _request_json("POST", _webhook_path(), payload)
    return meta_message_id, response, time.time() - started


def enviar_webhook_con_typing(texto: str) -> tuple[str, dict, float]:
    frame = 0
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(enviar_webhook, texto)
        while not future.done():
            _print_typing(frame)
            frame += 1
            time.sleep(POLL_INTERVAL_SECONDS)
        return future.result()


def _serialize_datetime(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _row_to_message_dict(row: Any) -> dict:
    return {
        "id": row.id,
        "tipo": row.tipo,
        "canal": row.canal,
        "estado": row.estado,
        "contenido": row.contenido,
        "contacto_referencia": row.contacto_referencia,
        "origen_externo_id": row.origen_externo_id,
        "fecha_mensaje": _serialize_datetime(row.fecha_mensaje),
        "created_at": _serialize_datetime(row.created_at),
        "metadata_json": row.metadata_json or {},
    }


def _listar_mensajes_db() -> list[dict]:
    from sqlmodel import Session, select

    from app.db import engine
    from app.models import CRMMensaje

    with Session(engine) as session:
        rows = session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.contacto_referencia == FROM_PHONE)
            .where(CRMMensaje.canal == "whatsapp")
            .order_by(CRMMensaje.fecha_mensaje.desc(), CRMMensaje.id.desc())
            .limit(20)
        ).all()
        return [_row_to_message_dict(row) for row in rows]


def _listar_mensajes_api() -> list[dict]:
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


def _listar_mensajes() -> list[dict]:
    global _DB_READ_FAILED
    if _use_db_read_mode() and not _DB_READ_FAILED:
        try:
            return _listar_mensajes_db()
        except Exception:
            if READ_MODE == "db":
                raise
            _DB_READ_FAILED = True
    return _listar_mensajes_api()


def _metadata(mensaje: dict) -> dict:
    raw = mensaje.get("metadata_json")
    if raw is None:
        raw = mensaje.get("metadata")
    return raw if isinstance(raw, dict) else {}


def _same_id(value: Any, expected: Any) -> bool:
    if value is None or expected is None:
        return False
    try:
        return int(value) == int(expected)
    except (TypeError, ValueError):
        return str(value) == str(expected)


def _find_outbound_for_inbound(mensajes: list[dict], inbound: dict) -> dict | None:
    inbound_id = inbound.get("id")
    for mensaje in mensajes:
        if mensaje.get("tipo") != "salida":
            continue
        if _same_id(_metadata(mensaje).get("source_message_id"), inbound_id):
            return mensaje
    inbound_time = inbound.get("fecha_mensaje") or inbound.get("created_at")
    if not inbound_time:
        return None
    candidates = [
        mensaje
        for mensaje in mensajes
        if mensaje.get("tipo") == "salida"
        and (mensaje.get("fecha_mensaje") or mensaje.get("created_at") or "") >= inbound_time
    ]
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda item: (item.get("fecha_mensaje") or item.get("created_at") or "", item.get("id") or 0),
    )[0]


def _typing_text(frame: int) -> str:
    dots = "." * ((frame % 3) + 1)
    return f"Agente: {dots:<3}"


def _print_typing(frame: int) -> None:
    if not SHOW_TYPING_INDICATOR:
        return
    print(f"\r{_typing_text(frame)}", end="", flush=True)


def _clear_typing() -> None:
    if not SHOW_TYPING_INDICATOR:
        return
    print("\r" + (" " * 80) + "\r", end="", flush=True)


def esperar_resultado(meta_message_id: str) -> tuple[dict | None, dict | None, dict | None]:
    deadline = time.time() + POLL_TIMEOUT_SECONDS
    inbound = None
    latest_result = None
    latest_outbound = None
    frame = 0

    while time.time() < deadline:
        _print_typing(frame)
        frame += 1
        mensajes = _listar_mensajes()
        inbound = next((m for m in mensajes if m.get("origen_externo_id") == meta_message_id), None)
        if inbound:
            outbound = _find_outbound_for_inbound(mensajes, inbound)
            if outbound:
                latest_outbound = outbound

            agent_meta = _metadata(inbound).get("agent_v2") or {}
            result = agent_meta.get("result")
            if isinstance(result, dict):
                latest_result = result
                outbound_id = agent_meta.get("outbound_message_id") or (agent_meta.get("delivery") or {}).get("outbound_message_id")
                if outbound_id is not None:
                    latest_outbound = next((m for m in mensajes if m.get("id") == outbound_id), None) or latest_outbound
                if not SHOW_TIMING or isinstance(result.get("_timing"), dict):
                    _clear_typing()
                    return inbound, result, latest_outbound

            if latest_outbound is not None and not SHOW_TIMING:
                _clear_typing()
                return inbound, latest_result, latest_outbound
        time.sleep(POLL_INTERVAL_SECONDS)

    _clear_typing()
    return inbound, latest_result, latest_outbound


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
        result_type = result.get("type")
        if result_type:
            print(f"[Resultado: {result_type}]")
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
        novedades = result.get("novedades") or []
        if novedades:
            print(f"[Parte diario: {result.get('fecha') or 'sin fecha'}]")
            for novedad in novedades:
                parts = [
                    str(novedad.get("nombre") or "?"),
                    str(novedad.get("estado_codigo") or "sin estado"),
                ]
                if novedad.get("horas") is not None:
                    parts.append(f"{_format_quantity(novedad['horas'])}h")
                if novedad.get("fuera_de_proyecto"):
                    parts.append("externo")
                print("  - " + " | ".join(parts))
        conflictos = result.get("conflictos_novedad") or []
        if conflictos:
            print(f"[Conflictos de novedades: {len(conflictos)}]")
        if result.get("cancelado"):
            print("[Operacion cancelada]")
        if result.get("close_after_materialization"):
            print("[Materializacion solicitada]")

    pedido_id = agent_meta.get("pedido_obra_id")
    parte_id = agent_meta.get("parte_diario_id")
    if pedido_id is not None:
        print(f"[Pedido materializado: {pedido_id}]")
    if parte_id is not None:
        print(f"[Parte diario materializado: {parte_id}]")

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
    print("=== Chat webhook agente de obra ===")
    print(f"Webhook: {BASE_URL}{_webhook_path()}")
    print(f"Lectura: {'db' if _use_db_read_mode() else 'api'} [{READ_MODE}]")
    print(f"Contacto hardcodeado: {FROM_NAME} <{FROM_PHONE}>")
    print(f"Canal Meta simulado: phone_number_id={META_PHONE_NUMBER_ID}, display={TO_PHONE}")
    print("Nota: ese contacto debe tener una oportunidad activa de proyecto/obra.")
    print("Comando local: 'salir' termina el chat.")
    print("Envia CONFIRMAR o CANCELAR completos cuando corresponda.\n")

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

        t_inicio = time.time()
        hora_envio = datetime.now().strftime("%H:%M:%S")
        try:
            meta_message_id, webhook_response, t_post = enviar_webhook_con_typing(texto)
            inbound, result, outbound = esperar_resultado(meta_message_id)
        except urllib.error.URLError as exc:
            _clear_typing()
            print(f"[Error] No se pudo conectar al servidor: {exc.reason}")
            continue
        except Exception as exc:
            _clear_typing()
            print(f"[Error] {exc}")
            continue

        t_total = time.time() - t_inicio
        hora_respuesta = datetime.now().strftime("%H:%M:%S")
        print()
        if SHOW_DEBUG or SHOW_TIMING:
            print(f"[{hora_envio} -> {hora_respuesta} | {t_total:.1f}s]")

        if result is None and outbound is None:
            if inbound is None:
                print("No encontre el mensaje entrante creado por el webhook.")
            else:
                print("El webhook guardo el mensaje, pero aun no hay resultado del agente.")
            continue

        print(f"Agente: {_reply_text(result, outbound)}\n")
        if SHOW_DEBUG:
            _mostrar_estado(result, inbound, outbound)
            print()
        if SHOW_TIMING:
            timing = result.get("_timing") if isinstance(result, dict) else None
            process_timing = (
                (result.get("pedido_obra") or result.get("parte_diario") or {})
                if isinstance(result, dict)
                else {}
            )
            webhook_timing = webhook_response.get("_timing") if isinstance(webhook_response, dict) else None
            print(f"[Timing] post={t_post:.1f}s total={t_total:.1f}s")
            if isinstance(timing, dict):
                print(f"[Timing] webhook-agent={timing.get('agent_ms')}ms delivery={timing.get('delivery_ms')}ms")
                pre_agent = timing.get("pre_agent")
                if isinstance(pre_agent, dict) and pre_agent:
                    print(
                        "[Timing pre-agent] "
                        f"find={pre_agent.get('find_existing_ms')}ms "
                        f"contacto={pre_agent.get('contacto_ms')}ms "
                        f"oportunidad={pre_agent.get('oportunidad_ms')}ms "
                        f"normalize={pre_agent.get('normalize_ms')}ms "
                        f"crm_create={pre_agent.get('crm_create_crud_ms')}ms "
                        f"commit={pre_agent.get('extra_commit_ms')}ms "
                        f"refresh={pre_agent.get('refresh_ms')}ms "
                        f"ready={pre_agent.get('message_ready_ms')}ms"
                    )
            if isinstance(process_timing, dict) and process_timing:
                print(f"[Timing] llm={process_timing.get('llm_ms')}ms executor={process_timing.get('executor_ms')}ms process={process_timing.get('process_ms')}ms")
            if isinstance(webhook_timing, dict):
                print(f"[Timing] webhook-total={webhook_timing.get('total_ms')}ms")
            print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
