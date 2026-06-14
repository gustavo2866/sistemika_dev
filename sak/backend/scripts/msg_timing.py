"""Mide tiempos del ultimo mensaje inbound procesado por el agente.

Uso:
    python backend/scripts/msg_timing.py
    python backend/scripts/msg_timing.py --message-id 3180
    python backend/scripts/msg_timing.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import engine  # noqa: E402
from app.models import CRMMensaje  # noqa: E402
from app.modules.channels.persistence import ChannelEvent  # noqa: E402


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _ms_between(start: Any, end: Any) -> int | None:
    parsed_start = _parse_dt(start)
    parsed_end = _parse_dt(end)
    if not parsed_start or not parsed_end:
        return None
    return round((parsed_end - parsed_start).total_seconds() * 1000)


def _fmt_ms(value: int | None) -> str:
    return "n/a" if value is None else f"{value} ms"


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _latest_inbound(session: Session) -> CRMMensaje | None:
    return session.exec(
        select(CRMMensaje)
        .where(CRMMensaje.tipo == "entrada")
        .order_by(CRMMensaje.id.desc())
        .limit(1)
    ).first()


def _find_outbound(session: Session, inbound: CRMMensaje, agent_meta: dict[str, Any]) -> CRMMensaje | None:
    delivery = agent_meta.get("delivery") if isinstance(agent_meta.get("delivery"), dict) else {}
    outbound_id = delivery.get("outbound_message_id")
    if outbound_id:
        return session.get(CRMMensaje, int(outbound_id))

    return session.exec(
        select(CRMMensaje)
        .where(CRMMensaje.tipo == "salida")
        .where(CRMMensaje.deleted_at.is_(None))
        .where(CRMMensaje.oportunidad_id == inbound.oportunidad_id)
        .order_by(CRMMensaje.id.desc())
        .limit(1)
    ).first()


def _find_channel_event(session: Session, inbound: CRMMensaje) -> ChannelEvent | None:
    if not inbound.origen_externo_id:
        return None
    return session.exec(
        select(ChannelEvent)
        .where(ChannelEvent.external_message_id == inbound.origen_externo_id)
        .order_by(ChannelEvent.id.desc())
        .limit(1)
    ).first()


def measure_message(session: Session, message_id: int | None = None) -> dict[str, Any]:
    inbound = session.get(CRMMensaje, message_id) if message_id else _latest_inbound(session)
    if inbound is None:
        raise RuntimeError("No se encontro mensaje inbound")
    if inbound.tipo != "entrada":
        raise RuntimeError(f"El mensaje {inbound.id} no es de entrada")

    metadata = dict(inbound.metadata_json or {})
    agent_meta = dict(metadata.get("agent_v3") or {})
    result = dict(agent_meta.get("result") or {})
    timing = dict(result.get("_timing") or {})
    pedido_obra = dict(result.get("pedido_obra") or {})
    delivery = dict(agent_meta.get("delivery") or {})
    outbound = _find_outbound(session, inbound, agent_meta)
    event = _find_channel_event(session, inbound)

    queue = {
        "status": metadata.get("agent_queue_status"),
        "queued_at": metadata.get("agent_queue_queued_at"),
        "enqueued_at": metadata.get("agent_queue_enqueued_at"),
        "started_at": metadata.get("agent_queue_started_at"),
        "processed_at": metadata.get("agent_queue_processed_at"),
        "attempts": metadata.get("agent_queue_attempts"),
        "source": metadata.get("agent_queue_source"),
    }
    agent = {
        "process_name": agent_meta.get("process_name"),
        "processed_at": agent_meta.get("processed_at"),
        "delivery_processed_at": agent_meta.get("delivery_processed_at"),
        "delivery": delivery,
        "timing": timing,
        "pedido_obra": pedido_obra,
    }
    derived_ms = {
        "event_created_to_msg_created": _ms_between(getattr(event, "created_at", None), inbound.created_at),
        "msg_created_to_queue_queued": _ms_between(inbound.created_at, queue["queued_at"]),
        "queue_queued_to_enqueued": _ms_between(queue["queued_at"], queue["enqueued_at"]),
        "queue_enqueued_to_started": _ms_between(queue["enqueued_at"], queue["started_at"]),
        "queue_queued_to_started": _ms_between(queue["queued_at"], queue["started_at"]),
        "started_to_agent_processed_at": _ms_between(queue["started_at"], agent["processed_at"]),
        "agent_processed_to_delivery_processed": _ms_between(
            agent["processed_at"],
            agent["delivery_processed_at"],
        ),
        "queue_started_to_processed": _ms_between(queue["started_at"], queue["processed_at"]),
        "msg_created_to_outbound_created": _ms_between(inbound.created_at, getattr(outbound, "created_at", None)),
        "event_created_to_outbound_created": _ms_between(
            getattr(event, "created_at", None),
            getattr(outbound, "created_at", None),
        ),
    }

    return {
        "inbound": {
            "id": inbound.id,
            "text": inbound.contenido,
            "created_at": inbound.created_at,
            "fecha_mensaje": inbound.fecha_mensaje,
            "external_id": inbound.origen_externo_id,
            "contacto_id": inbound.contacto_id,
            "oportunidad_id": inbound.oportunidad_id,
            "canal": inbound.canal,
        },
        "outbound": {
            "id": getattr(outbound, "id", None),
            "created_at": getattr(outbound, "created_at", None),
            "fecha_mensaje": getattr(outbound, "fecha_mensaje", None),
            "external_id": getattr(outbound, "origen_externo_id", None),
        },
        "channel_event": {
            "id": getattr(event, "id", None),
            "created_at": getattr(event, "created_at", None),
        },
        "queue": queue,
        "agent": agent,
        "derived_ms": derived_ms,
    }


def print_report(data: dict[str, Any]) -> None:
    inbound = data["inbound"]
    outbound = data["outbound"]
    event = data["channel_event"]
    queue = data["queue"]
    agent = data["agent"]
    timing = agent["timing"]
    pedido = agent["pedido_obra"]
    derived = data["derived_ms"]

    print(f"Mensaje entrada: {inbound['id']} | texto={inbound['text']!r}")
    print(f"Salida asociada: {outbound['id']}")
    print(f"Channel event: {event['id']}")
    print()
    print("Timestamps")
    print(f"  channel_event.created_at: {event['created_at']}")
    print(f"  mensaje.created_at:       {inbound['created_at']}")
    print(f"  mensaje.fecha_mensaje:    {inbound['fecha_mensaje']}")
    print(f"  outbound.created_at:      {outbound['created_at']}")
    print()
    print("Cola")
    print(f"  status:       {queue['status']}")
    print(f"  queued_at:    {queue['queued_at']}")
    print(f"  enqueued_at:  {queue['enqueued_at']}")
    print(f"  started_at:   {queue['started_at']}")
    print(f"  processed_at: {queue['processed_at']}")
    print(f"  attempts:     {queue['attempts']}")
    print(f"  source:       {queue['source']}")
    print()
    print("Tiempos derivados")
    for key, value in derived.items():
        print(f"  {key}: {_fmt_ms(value)}")
    print()
    print("Timings persistidos")
    print(f"  queue:                 {timing.get('queue')}")
    print(f"  prepare_message:       {_fmt_ms(timing.get('prepare_queued_message_ms'))}")
    print(f"  orchestrator/agente:   {_fmt_ms(timing.get('orchestrator_ms'))}")
    print(f"  persist_agent_result:  {_fmt_ms(timing.get('persist_agent_result_ms'))}")
    print(f"  materialization:       {_fmt_ms(timing.get('materialization_ms'))}")
    print(f"  mark_delivery_pending: {_fmt_ms(timing.get('mark_delivery_pending_ms'))}")
    print(f"  delivery:              {_fmt_ms(timing.get('delivery_ms'))}")
    print(f"  total_before_metadata: {_fmt_ms(timing.get('total_before_metadata_ms'))}")
    print()
    print("Proceso")
    print(f"  process_name: {agent['process_name']}")
    print(f"  llm_ms:       {_fmt_ms(pedido.get('llm_ms'))}")
    print(f"  executor_ms:  {_fmt_ms(pedido.get('executor_ms'))}")
    print(f"  process_ms:   {_fmt_ms(pedido.get('process_ms'))}")
    print(f"  operations:   {pedido.get('operations')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Mide timings del ultimo mensaje inbound del agente.")
    parser.add_argument("--message-id", type=int, default=None, help="ID de CRMMensaje de entrada a medir")
    parser.add_argument("--json", action="store_true", help="Imprime la medicion en JSON")
    args = parser.parse_args()

    with Session(engine) as session:
        data = measure_message(session, args.message_id)

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2, default=_json_default))
    else:
        print_report(data)


if __name__ == "__main__":
    main()
