"""
Seed de emprendimientos (crea/actualiza 3 registros).

Uso:
    python scripts/seed_emprendimientos.py
"""

from __future__ import annotations

from pathlib import Path

from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parent.parent

import sys

sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.db import engine
from app.models import Emprendimiento
from app.models.enums import EstadoEmprendimiento


SEED_DATA: list[dict] = [
    {
        "nombre": "Emprendimiento Centro",
        "descripcion": "Proyecto demo en zona céntrica.",
        "ubicacion": "Centro",
        "estado": EstadoEmprendimiento.PLANIFICACION.value,
        "activo": True,
    },
    {
        "nombre": "Emprendimiento Norte",
        "descripcion": "Proyecto demo en zona norte.",
        "ubicacion": "Zona Norte",
        "estado": EstadoEmprendimiento.CONSTRUCCION.value,
        "activo": True,
    },
    {
        "nombre": "Emprendimiento Sur",
        "descripcion": "Proyecto demo en zona sur.",
        "ubicacion": "Zona Sur",
        "estado": EstadoEmprendimiento.FINALIZADO.value,
        "activo": True,
    },
]


def seed_emprendimientos(session: Session) -> None:
    for item in SEED_DATA:
        existing = session.exec(
            select(Emprendimiento).where(Emprendimiento.nombre == item["nombre"])
        ).first()

        if existing:
            for key, value in item.items():
                setattr(existing, key, value)
            continue

        session.add(Emprendimiento(**item))

    session.commit()


def main() -> None:
    with Session(engine) as session:
        seed_emprendimientos(session)
    print("OK: emprendimientos seeded/updated.")


if __name__ == "__main__":
    main()

