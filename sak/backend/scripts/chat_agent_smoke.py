"""
Chat de prueba para el agente de obra simulando el webhook de Meta.

Uso:
  python backend/scripts/chat_agent_smoke.py              # backend local con agente v3
  python backend/scripts/chat_agent_smoke.py --gcp        # GCP test
  python backend/scripts/chat_agent_smoke.py --prod --allow-prod
  python backend/scripts/chat_agent_smoke.py --url https://mi-backend.run.app
  python backend/scripts/chat_agent_smoke.py --debug      # mostrar diagnostico tecnico
  python backend/scripts/chat_agent_smoke.py --timing     # mostrar timings

Variables opcionales (sobreescritas por args de linea de comandos):
  CHAT_TEST_BASE_URL=http://127.0.0.1:8000
  CHAT_TEST_QUEUE=smoke            # cola enviada al webhook
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
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, UTC
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
    return parser.parse_args()


_args = (
    _parse_args()
    if __name__ == "__main__"
    else argparse.Namespace(
        url=None,
        prod=False,
        gcp=False,
        allow_prod=False,
        timing=False,
        debug=False,
    )
)

# CLI args always take precedence over env vars
if _args.url:
    BASE_URL = _args.url.rstrip("/")
elif _args.prod:
    BASE_URL = _GCP_PROD_URL
elif _args.gcp:
    BASE_URL = _GCP_TEST_URL
else:
    BASE_URL = os.environ.get("CHAT_TEST_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

if BASE_URL == _GCP_PROD_URL and not _args.allow_prod:
    raise SystemExit("Para ejecutar contra produccion agrega --allow-prod.")

_queue_default = "smoke"
QUEUE_NAME = os.environ.get("CHAT_TEST_QUEUE", _queue_default).strip().lower() or _queue_default

FROM_PHONE = os.environ.get("CHAT_TEST_FROM_PHONE", "5491156384310")
FROM_NAME = os.environ.get("CHAT_TEST_FROM_NAME", "Encargado Test")
TO_PHONE = os.environ.get("CHAT_TEST_TO_PHONE", "5493816259343")
META_PHONE_NUMBER_ID = os.environ.get("CHAT_TEST_META_PHONE_NUMBER_ID", "1046006975257973")
META_WABA_ID = os.environ.get("CHAT_TEST_META_WABA_ID", "1516474752918083")
POLL_TIMEOUT_SECONDS = float(os.environ.get("CHAT_TEST_TIMEOUT", "30"))
POLL_INTERVAL_SECONDS = float(os.environ.get("CHAT_TEST_POLL_INTERVAL", "0.2"))
POLL_SETTLE_SECONDS = float(os.environ.get("CHAT_TEST_SETTLE_SECONDS", "0.8"))
SHOW_TYPING_INDICATOR = os.environ.get("CHAT_TEST_TYPING_INDICATOR", "1").strip().lower() not in {
    "0",
    "false",
    "no",
}
SHOW_TIMING = _args.timing or os.environ.get("CHAT_TEST_SHOW_TIMING", "").strip().lower() in {"1", "true", "yes", "si", "sí"}
SHOW_DEBUG = _args.debug or os.environ.get("CHAT_TEST_SHOW_DEBUG", "").strip().lower() in {"1", "true", "yes", "si", "sí"}


def _clear_screen() -> None:
    command = "cls" if os.name == "nt" else "clear"
    try:
        subprocess.run([command], check=False)
    except Exception:
        print("\033c", end="")


def _request_json(
    method: str,
    path: str,
    payload: dict | None = None,
    params: dict | None = None,
    *,
    timeout: float = 30,
) -> dict:
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
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


def _webhook_path() -> str:
    return "/api/agente/v3/channel/meta"


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
    params = {"queue": QUEUE_NAME}
    response = _request_json("POST", _webhook_path(), payload, params=params)
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


def _metadata(mensaje: dict) -> dict:
    raw = mensaje.get("metadata_json")
    if raw is None:
        raw = mensaje.get("metadata")
    return raw if isinstance(raw, dict) else {}


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


def _format_runtime_error(exc: Exception) -> str:
    if _is_db_operational_error(exc):
        reason = getattr(exc, "orig", exc)
        return (
            "[Error] No se pudo leer channel_events por DB.\n"
            f"        DB configurada: {_database_label()}\n"
            f"        Detalle: {reason}"
        )
    return f"[Error] {exc}"


def _is_db_operational_error(exc: Exception) -> bool:
    try:
        from sqlalchemy.exc import OperationalError
    except Exception:
        return False
    return isinstance(exc, OperationalError)


def _database_label() -> str:
    try:
        from sqlalchemy.engine import make_url

        from app.db import DATABASE_URL

        url = make_url(DATABASE_URL)
    except Exception:
        return "no disponible"

    database = f"/{url.database}" if url.database else ""
    return f"{url.drivername}://{url.host or '(sin host)'}{database}"


def esperar_resultado(meta_message_id: str) -> tuple[dict | None, dict | None, list[dict]]:
    return esperar_resultado_v3(meta_message_id)


def esperar_resultado_v3(meta_message_id: str) -> tuple[dict | None, dict | None, list[dict]]:
    deadline = time.time() + POLL_TIMEOUT_SECONDS
    frame = 0
    sent_after = datetime.now(UTC) - timedelta(seconds=5)
    outbounds: list[dict] = []
    last_count = 0
    last_change_at: float | None = None
    expected_outbound_count: int | None = None

    while time.time() < deadline:
        _print_typing(frame)
        frame += 1

        expected_outbound_count = (
            _expected_outbound_count_from_inbox_status(meta_message_id)
            or expected_outbound_count
        )
        current_outbounds = _find_channel_outbounds_db(
            sent_after=sent_after,
            source_external_message_id=meta_message_id,
        )
        current_outbounds = _merge_observed_outbound_lists(
            current_outbounds,
            _sent_outbounds_from_outbox_status(meta_message_id),
        )
        if current_outbounds:
            outbounds = current_outbounds
            if len(outbounds) != last_count:
                last_count = len(outbounds)
                last_change_at = time.time()
            if expected_outbound_count and len(outbounds) >= expected_outbound_count:
                break
            if expected_outbound_count and len(outbounds) < expected_outbound_count:
                time.sleep(POLL_INTERVAL_SECONDS)
                continue
            elif last_change_at is not None and time.time() - last_change_at >= POLL_SETTLE_SECONDS:
                break
            if POLL_SETTLE_SECONDS <= 0:
                break
        time.sleep(POLL_INTERVAL_SECONDS)

    if outbounds:
        _clear_typing()
        last_outbound = outbounds[-1]
        inbound = {
            "id": None,
            "tipo": "entrada",
            "canal": "whatsapp",
            "contenido": None,
            "contacto_referencia": FROM_PHONE,
            "origen_externo_id": meta_message_id,
            "metadata_json": {
                "agent_v3": {
                    "observed_channel_outbound": last_outbound,
                    "observed_channel_outbounds": outbounds,
                }
            },
        }
        text = _channel_outbound_text(last_outbound)
        result = {
            "type": "v3_ok",
            "respuesta": text or "(sin texto)",
            "status": last_outbound.get("status"),
            "_timing": {},
            "agent_v3": {
                "observed_channel_outbound": last_outbound,
                "observed_channel_outbounds": outbounds,
            },
        }
        return inbound, result, [_outbound_message_from_event(outbound) for outbound in outbounds]

    _clear_typing()
    return None, None, []


def _expected_outbound_count_from_inbox_status(meta_message_id: str) -> int | None:
    try:
        status = _request_json(
            "GET",
            "/api/agente/v3/inbox/status",
            params={"queue": QUEUE_NAME},
            timeout=2,
        )
    except Exception:
        return None

    last_processed = status.get("last_processed") if isinstance(status, dict) else None
    if not isinstance(last_processed, dict):
        return None
    if last_processed.get("external_message_id") != meta_message_id:
        return None

    orchestrator = last_processed.get("orchestrator")
    metadata = orchestrator.get("metadata") if isinstance(orchestrator, dict) else None
    if isinstance(metadata, dict):
        outbound_ids = metadata.get("outbound_message_ids")
        if isinstance(outbound_ids, list) and outbound_ids:
            return len(outbound_ids)

    outbox = last_processed.get("outbox")
    if isinstance(outbox, dict) and outbox.get("message_id"):
        return 1
    return None


def _sent_outbounds_from_outbox_status(meta_message_id: str) -> list[dict]:
    try:
        status = _request_json(
            "GET",
            "/api/agente/v3/outbox/status",
            params={"queue": QUEUE_NAME},
            timeout=2,
        )
    except Exception:
        return []

    sent = status.get("sent") if isinstance(status, dict) else None
    if not isinstance(sent, list):
        last_sent = status.get("last_sent") if isinstance(status, dict) else None
        sent = [last_sent] if isinstance(last_sent, dict) else []
    return [
        _outbox_status_to_observed_outbound(item)
        for item in sent
        if isinstance(item, dict) and item.get("source_external_message_id") == meta_message_id
    ]


def _outbox_status_to_observed_outbound(message: dict) -> dict:
    request: dict[str, Any] = {}
    interactive = message.get("interactive")
    if message.get("payload_type") == "interactive" and isinstance(interactive, dict):
        request["interactive"] = interactive
    elif message.get("text"):
        request["text"] = {"body": str(message["text"])}

    normalized_payload = {
        "request": request,
        "agent_v3": {
            "outbound_message_id": message.get("message_id"),
            "source_message_id": message.get("source_message_id"),
            "source_external_message_id": message.get("source_external_message_id"),
            "queue": message.get("queue"),
        },
    }
    return {
        "id": f"outbox:{message.get('message_id')}",
        "external_message_id": message.get("external_message_id"),
        "status": message.get("status"),
        "from_address": None,
        "to_address": message.get("to_address"),
        "created_at": message.get("sent_at"),
        "occurred_at": message.get("sent_at"),
        "raw_payload": message.get("raw_response") or {},
        "normalized_payload": normalized_payload,
    }


def _merge_observed_outbound_lists(outbounds: list[dict], fallbacks: list[dict]) -> list[dict]:
    merged = list(outbounds)
    observed_ids = {
        outbound_id
        for item in merged
        if (outbound_id := _observed_outbound_message_id(item))
    }
    observed_external_ids = {
        str(external_id)
        for item in merged
        if (external_id := item.get("external_message_id"))
    }
    for fallback in fallbacks:
        fallback_id = _observed_outbound_message_id(fallback)
        fallback_external_id = fallback.get("external_message_id")
        if fallback_id and fallback_id in observed_ids:
            continue
        if fallback_external_id and str(fallback_external_id) in observed_external_ids:
            continue
        merged.append(fallback)
        if fallback_id:
            observed_ids.add(fallback_id)
        if fallback_external_id:
            observed_external_ids.add(str(fallback_external_id))
    return merged


def _observed_outbound_message_id(outbound: dict) -> str | None:
    normalized = outbound.get("normalized_payload")
    agent_v3 = normalized.get("agent_v3") if isinstance(normalized, dict) else None
    outbound_id = agent_v3.get("outbound_message_id") if isinstance(agent_v3, dict) else None
    return str(outbound_id) if outbound_id else None


def _find_channel_outbound_db(
    *,
    sent_after: datetime,
    source_external_message_id: str | None = None,
) -> dict | None:
    outbounds = _find_channel_outbounds_db(
        sent_after=sent_after,
        source_external_message_id=source_external_message_id,
    )
    return outbounds[-1] if outbounds else None


def _find_channel_outbounds_db(
    *,
    sent_after: datetime,
    source_external_message_id: str | None = None,
) -> list[dict]:
    from sqlmodel import Session, select

    from app.db import engine
    from app.modules.channels.persistence import ChannelEvent

    with Session(engine) as session:
        rows = session.exec(
            select(ChannelEvent)
            .where(ChannelEvent.deleted_at.is_(None))
            .where(ChannelEvent.provider == "meta")
            .where(ChannelEvent.channel_type == "whatsapp")
            .where(ChannelEvent.direction == "outbound")
            .where(ChannelEvent.to_address == FROM_PHONE)
            .where(ChannelEvent.created_at >= sent_after)
            .order_by(ChannelEvent.created_at.desc(), ChannelEvent.id.desc())
            .limit(50)
        ).all()
        if not rows:
            return []

        if source_external_message_id:
            rows = _find_v3_outbounds_with_text(rows, source_external_message_id)
        else:
            rows = [rows[0]]
        return [_channel_event_to_dict(row) for row in sorted(rows, key=_channel_event_sort_key)]


def _channel_event_to_dict(row: Any) -> dict:
    return {
        "id": row.id,
        "external_message_id": row.external_message_id,
        "status": row.status,
        "from_address": row.from_address,
        "to_address": row.to_address,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "occurred_at": row.occurred_at.isoformat() if row.occurred_at else None,
        "raw_payload": row.raw_payload or {},
        "normalized_payload": row.normalized_payload or {},
    }


def _channel_event_sort_key(row: Any) -> tuple[datetime, int]:
    created_at = row.created_at or datetime.min
    row_id = int(row.id or 0)
    return created_at, row_id


def _matches_v3_outbound(row: Any, source_external_message_id: str) -> bool:
    agent_v3 = ((row.normalized_payload or {}).get("agent_v3") or {})
    if agent_v3.get("source_external_message_id") != source_external_message_id:
        return False
    event_queue = str(agent_v3.get("queue") or "").strip().lower()
    return not event_queue or event_queue == QUEUE_NAME


def _find_v3_outbound_with_text(rows: list[Any], source_external_message_id: str) -> Any | None:
    outbounds = _find_v3_outbounds_with_text(rows, source_external_message_id)
    return outbounds[-1] if outbounds else None


def _find_v3_outbounds_with_text(rows: list[Any], source_external_message_id: str) -> list[Any]:
    matched = [row for row in rows if _matches_v3_outbound(row, source_external_message_id)]
    candidates = [row for row in matched if _channel_event_text(row)]

    # Some Meta status callbacks share the outbound external_message_id but do
    # not carry request.text.body. Older backends could annotate that callback
    # instead of the original request row, so recover the sibling request event.
    matched_external_ids = {
        row.external_message_id
        for row in matched
        if getattr(row, "external_message_id", None)
    }
    for row in rows:
        if row.external_message_id in matched_external_ids and _channel_event_text(row):
            candidates.append(row)

    unique: dict[Any, Any] = {}
    for row in candidates:
        unique[row.id] = row
    return sorted(unique.values(), key=_channel_event_sort_key)


def _outbound_message_from_event(outbound: dict) -> dict:
    return {
        "id": outbound.get("id"),
        "tipo": "salida",
        "canal": "whatsapp",
        "estado": outbound.get("status"),
        "contenido": _channel_outbound_text(outbound),
        "contacto_referencia": outbound.get("to_address"),
        "origen_externo_id": outbound.get("external_message_id"),
        "metadata_json": outbound.get("normalized_payload") or {},
    }


def _channel_event_text(row: Any) -> str | None:
    normalized = row.normalized_payload or {}
    raw = row.raw_payload or {}
    return _extract_channel_text(normalized, raw)


def _channel_outbound_text(event: dict) -> str | None:
    normalized = event.get("normalized_payload") if isinstance(event, dict) else {}
    raw = event.get("raw_payload") if isinstance(event, dict) else {}
    return _extract_channel_text(normalized, raw)


def _extract_channel_text(normalized: Any, raw: Any) -> str | None:
    request = normalized.get("request") if isinstance(normalized, dict) else {}
    if isinstance(request, dict):
        text = request.get("text")
        if isinstance(text, dict) and text.get("body"):
            return str(text["body"])
        interactive = request.get("interactive")
        if isinstance(interactive, dict):
            return _format_interactive_text(interactive)
        template = request.get("template")
        components = template.get("components") if isinstance(template, dict) else []
        for component in components or []:
            for parameter in component.get("parameters") or []:
                if parameter.get("type") == "text" and parameter.get("text"):
                    return str(parameter["text"])
    if isinstance(raw, dict):
        text = raw.get("text")
        if isinstance(text, dict) and text.get("body"):
            return str(text["body"])
    return None


def _format_interactive_text(interactive: dict) -> str | None:
    lines: list[str] = []
    header = interactive.get("header")
    if isinstance(header, dict) and header.get("text"):
        lines.append(str(header["text"]))

    body = interactive.get("body")
    if isinstance(body, dict) and body.get("text"):
        lines.append(str(body["text"]))

    action = interactive.get("action")
    if isinstance(action, dict):
        button_label = action.get("button")
        if interactive.get("type") == "list" and button_label:
            lines.append(f"[Menu: {button_label}]")

        rows: list[dict] = []
        for section in action.get("sections") or []:
            if isinstance(section, dict):
                rows.extend([row for row in section.get("rows") or [] if isinstance(row, dict)])
        if rows:
            if interactive.get("type") == "list":
                lines.append("Opciones del menu:")
            lines.extend(
                _format_interactive_row(index, row)
                for index, row in enumerate(rows, start=1)
                if row.get("title") or row.get("id")
            )

        buttons = [button for button in action.get("buttons") or [] if isinstance(button, dict)]
        for index, button in enumerate(buttons, start=1):
            reply = button.get("reply") if isinstance(button.get("reply"), dict) else {}
            label = reply.get("title") or reply.get("id")
            if label:
                lines.append(f"{index}: {label}")

    footer = interactive.get("footer")
    if isinstance(footer, dict) and footer.get("text"):
        lines.append(str(footer["text"]))

    return "\n".join(lines) if lines else None


def _format_interactive_row(index: int, row: dict) -> str:
    label = row.get("title") or row.get("id")
    description = row.get("description")
    if description:
        return f"{index}: {label} ({description})"
    return f"{index}: {label}"


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
    agent_v3 = (result or {}).get("agent_v3") or (_metadata(inbound or {}).get("agent_v3") or {})
    if agent_v3:
        print("[Agente: v3]")
        print(f"[Resultado: {(result or {}).get('type') or 'v3'}]")
        timings = agent_v3.get("timings_ms") or {}
        if timings:
            print(
                "[Timing v3] "
                f"queued={timings.get('queued')}ms "
                f"orquesador={timings.get('orquesador')}ms "
                f"channel_send={timings.get('channel_send')}ms "
                f"total={timings.get('total')}ms"
            )
    elif inbound:
        print("[Agente: v3 pendiente]")


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
    print("Agente: v3")
    print(f"Webhook: {BASE_URL}{_webhook_path()}")
    print("Lectura: channel_events outbound")
    print(f"Cola agente: {QUEUE_NAME}")
    print(f"Contacto hardcodeado: {FROM_NAME} <{FROM_PHONE}>")
    print(f"Canal Meta simulado: phone_number_id={META_PHONE_NUMBER_ID}, display={TO_PHONE}")
    print("Comandos locales: 'cls' limpia la pantalla, '/salir' termina el chat.")
    print()

    while True:
        try:
            texto = input("Vos: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nChau.")
            break

        if not texto:
            continue
        if texto.lower() == "cls":
            _clear_screen()
            continue
        if texto.lower() == "/salir":
            print("Chau.")
            break

        t_inicio = time.time()
        hora_envio = datetime.now().strftime("%H:%M:%S")
        try:
            meta_message_id, webhook_response, t_post = enviar_webhook_con_typing(texto)
            inbound, result, outbounds = esperar_resultado(meta_message_id)
        except urllib.error.URLError as exc:
            _clear_typing()
            print(f"[Error] No se pudo conectar al servidor: {exc.reason}")
            continue
        except Exception as exc:
            _clear_typing()
            print(_format_runtime_error(exc))
            continue

        t_total = time.time() - t_inicio
        hora_respuesta = datetime.now().strftime("%H:%M:%S")
        print()
        if SHOW_DEBUG or SHOW_TIMING:
            print(f"[{hora_envio} -> {hora_respuesta} | {t_total:.1f}s]")

        if result is None and not outbounds:
            if inbound is None:
                print("No encontre el mensaje entrante creado por el webhook.")
            else:
                print("El webhook guardo el mensaje, pero aun no hay resultado del agente.")
            continue

        if outbounds:
            for outbound in outbounds:
                print(f"Agente: {_reply_text(None, outbound)}")
            print()
        else:
            print(f"Agente: {_reply_text(result, None)}\n")

        if SHOW_DEBUG:
            _mostrar_estado(result, inbound, outbounds[-1] if outbounds else None)
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
                print(
                    "[Timing v3] "
                    f"queued={timing.get('queued')}ms "
                    f"orquesador={timing.get('orquesador')}ms "
                    f"channel_send={timing.get('channel_send')}ms "
                    f"total={timing.get('total')}ms"
                )
            elif isinstance(timing, dict):
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
