"""
Debug helper to replay the Meta webhook processing for a sample payload.

Usage:
    python backend/scripts/debug_meta_webhook_message.py
    python backend/scripts/debug_meta_webhook_message.py --payload-file /path/to/payload.json

The default payload matches the data of CRM message #31 (contact 74) so we can inspect
why it wasn't linked to any opportunity.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Session, select

from app.db import engine
from app.models import CRMContacto, CRMCelular, CRMOportunidad
from app.schemas.metaw_webhook import MetaWWebhookPayload

SAMPLE_PAYLOAD: Dict[str, Any] = {
    "event_type": "message.received",
    "timestamp": "2025-12-19T13:54:35-03:00",
    "mensaje": {
        "id": "5a94cfa9-b45d-4da5-a671-1ceeb1c04d14",
        "meta_message_id": "wamid.HBgNNTQ5MTE1NjM4NDMxMBUCABIYFDNBMDhBQkEyNUU3MjRGNkIzMEQwAA==",
        "from_phone": "5491156384310",
        "from_name": "Gustavo",
        "to_phone": "+15551676015",
        "direccion": "in",
        "tipo": "text",
        "texto": "Nuevo mensaje",
        "media_id": None,
        "caption": None,
        "filename": None,
        "mime_type": None,
        "status": "queued",
        "meta_timestamp": "2025-12-19T13:54:35-03:00",
        "created_at": "2025-12-19T13:54:35-03:00",
        "celular": {
            "id": "14b530aa-ff61-44be-af48-957dabde4f28",
            "alias": "Canal +15551676015",
            "phone_number": "+15551676015",
        },
    },
}


def load_payload(path: Path | None) -> Dict[str, Any]:
    if not path:
        return SAMPLE_PAYLOAD
    data = json.loads(path.read_text(encoding="utf-8"))
    return data


def find_contact_by_phone(session: Session, phone: str) -> CRMContacto | None:
    stmt = select(CRMContacto).where(
        cast(CRMContacto.telefonos, JSONB).op("@>")(cast([phone], JSONB))
    )
    return session.exec(stmt).first()


def fetch_active_opportunities(session: Session, contacto_id: int) -> list[CRMOportunidad]:
    stmt = (
        select(CRMOportunidad)
        .where(
            CRMOportunidad.contacto_id == contacto_id,
            CRMOportunidad.activo.is_(True),
            CRMOportunidad.deleted_at.is_(None),
        )
        .order_by(CRMOportunidad.fecha_estado.desc())
    )
    return list(session.exec(stmt))


def debug_payload(payload: Dict[str, Any]) -> None:
    parsed = MetaWWebhookPayload(**payload)
    print("=== Payload resumido ===")
    print(f"Evento      : {parsed.event_type}")
    print(f"Dirección   : {parsed.mensaje.direccion}")
    print(f"From (name) : {parsed.mensaje.from_name}")
    print(f"From (phone): {parsed.mensaje.from_phone}")
    print(f"To (phone)  : {parsed.mensaje.to_phone}")
    print(f"Meta msg ID : {parsed.mensaje.meta_message_id}")
    print(f"Status      : {parsed.mensaje.status}")
    print()

    with Session(engine) as session:
        # Paso 1: celular configurado
        celular = session.exec(
            select(CRMCelular).where(CRMCelular.meta_celular_id == str(parsed.mensaje.celular.id))
        ).first()
        if celular:
            print(f"Celular en DB -> id={celular.id}, alias={celular.alias}, numero={celular.numero_celular}")
        else:
            print("Celular no encontrado en DB (se crearía uno nuevo)")

        # Paso 2: contacto existente
        contacto = find_contact_by_phone(session, parsed.mensaje.from_phone)
        if not contacto:
            print("Contacto no existente; el flujo original lo crearía.")
            return

        print(f"Contacto -> id={contacto.id}, nombre={contacto.nombre_completo or contacto.nombre}")
        print(f"Telefonos guardados: {contacto.telefonos}")

        # Paso 3: oportunidades activas
        oportunidades = fetch_active_opportunities(session, contacto.id)
        print(f"Oportunidades activas encontradas: {len(oportunidades)}")
        for opp in oportunidades[:5]:
            print(
                f"  - id={opp.id} estado={opp.estado} fecha_estado={opp.fecha_estado} titulo={opp.titulo or opp.descripcion_estado}"
            )
        if len(oportunidades) > 5:
            print(f"    ... (+{len(oportunidades) - 5} más)")

        if oportunidades:
            seleccionada = oportunidades[0]
            print(f"\nOportunidad que se asociaría (ordenada por fecha_estado desc): {seleccionada.id}\n")
        else:
            print("\nNo hay oportunidades activas; el mensaje quedaría sin oportunidad.\n")

        # Paso 4: payload del mensaje que se grabaría
        contenido = parsed.mensaje.texto or "[sin texto]"
        mensaje_preview = {
            "tipo": "entrada",
            "canal": "whatsapp",
            "contacto_id": contacto.id,
            "oportunidad_id": oportunidades[0].id if oportunidades else None,
            "contacto_referencia": parsed.mensaje.from_phone,
            "estado": "nuevo",
            "contenido": contenido,
            "origen_externo_id": parsed.mensaje.meta_message_id,
            "celular_id": celular.id if celular else None,
            "fecha_mensaje": parsed.mensaje.meta_timestamp,
            "estado_meta": parsed.mensaje.status,
        }
        print("Mensaje a crear (preview):")
        for key, value in mensaje_preview.items():
            print(f"  {key}: {value}")

        print("\n⚠️  Este script no inserta datos; solo muestra el flujo paso a paso.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reproducir paso a paso el flujo de Meta webhook.")
    parser.add_argument(
        "--payload-file",
        type=Path,
        help="Ruta a un archivo JSON con el payload del webhook (opcional).",
    )
    args = parser.parse_args()
    payload = load_payload(args.payload_file)
    debug_payload(payload)


if __name__ == "__main__":
    main()
