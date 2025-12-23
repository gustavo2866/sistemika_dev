"""
Normalize CRM event types.

Usage:
  python scripts/normalize_tipos_evento.py
"""
from __future__ import annotations

import os
import random
import sys
from pathlib import Path

from sqlmodel import Session, select
from sqlalchemy import or_

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.db import engine
from app.models.crm_evento import CRMEvento
from app.models.crm_catalogos import CRMTipoEvento


VALID_TIPOS = ["llamada", "visita", "tarea", "evento"]


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def main() -> None:
    valid_set = {_norm(item) for item in VALID_TIPOS}
    if not valid_set:
        print("No hay tipos validos configurados.")
        return

    with Session(engine) as session:
        tipos = session.exec(select(CRMTipoEvento)).all()
        if not tipos:
            print("No hay tipos de evento en el catalogo.")
            return

        valid_catalog = [
            item
            for item in tipos
            if _norm(item.codigo) in valid_set or _norm(item.nombre) in valid_set
        ]

        if not valid_catalog:
            print("No se encontraron tipos de evento validos en el catalogo.")
            return

        valid_ids = [item.id for item in valid_catalog]
        invalid_catalog = [item for item in tipos if item.id not in valid_ids]

        eventos = session.exec(
            select(CRMEvento).where(
                or_(
                    CRMEvento.tipo_id.is_(None),
                    CRMEvento.tipo_id.not_in(valid_ids),
                )
            )
        ).all()

        eventos_actualizados = 0
        for evento in eventos:
            elegido = random.choice(valid_catalog)
            evento.tipo_id = elegido.id
            eventos_actualizados += 1

        session.commit()

        for item in invalid_catalog:
            session.delete(item)

        session.commit()

        print(f"Eventos actualizados: {eventos_actualizados}")
        print(f"Tipos eliminados: {len(invalid_catalog)}")
        if invalid_catalog:
            for item in invalid_catalog:
                print(f"  - {item.id}: {item.codigo} ({item.nombre})")


if __name__ == "__main__":
    main()
