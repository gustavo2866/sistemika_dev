"""
Seed para completar campos nuevos de propiedades (tipo_operacion, emprendimiento, costos, monedas).

Uso:
    python scripts/seed_propiedades.py

El script es idempotente, sólo asigna valores si los campos están vacíos.
"""
import os
from decimal import Decimal
from pathlib import Path

from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parent.parent

import sys

sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.db import engine
from app.models import (
    CRMTipoOperacion,
    Emprendimiento,
    Moneda,
    Propiedad,
    User,
)


def get_default_ids(session: Session) -> tuple[int | None, int | None, int | None, int | None]:
    tipo_default = session.exec(select(CRMTipoOperacion).where(CRMTipoOperacion.codigo == "alquiler")).first()
    dolar = session.exec(select(Moneda).where(Moneda.codigo == "USD")).first()
    peso = session.exec(select(Moneda).where(Moneda.codigo == "ARS")).first()
    responsable = session.exec(select(User)).first()

    # Emprendimiento demo (opcional)
    emprendimiento = session.exec(select(Emprendimiento)).first()
    if not emprendimiento:
        if responsable:
            emprendimiento = Emprendimiento(
                nombre="Demo Emprendimiento",
                descripcion="Carga automática para propiedades sin emprendimiento",
                estado="planificacion",
                responsable_id=responsable.id,
            )
            session.add(emprendimiento)
            session.commit()
            session.refresh(emprendimiento)

    return (
        tipo_default.id if tipo_default else None,
        emprendimiento.id if emprendimiento else None,
        peso.id if peso else None,
        dolar.id if dolar else None,
    )


def seed_propiedades(session: Session) -> None:
    tipo_id, empr_id, peso_id, dolar_id = get_default_ids(session)

    for propiedad in session.exec(select(Propiedad)).all():
        if propiedad.tipo_operacion_id is None and tipo_id is not None:
            propiedad.tipo_operacion_id = tipo_id
        if propiedad.emprendimiento_id is None and empr_id is not None:
            propiedad.emprendimiento_id = empr_id
        if propiedad.costo_propiedad is None and peso_id is not None:
            propiedad.costo_propiedad = Decimal("1000000")
            propiedad.costo_moneda_id = peso_id
        if propiedad.precio_venta_estimado is None and dolar_id is not None:
            propiedad.precio_venta_estimado = Decimal("150000")
            propiedad.precio_moneda_id = dolar_id
    session.commit()


def main() -> None:
    db_url = os.getenv("DATABASE_URL")
    print(f"Usando DATABASE_URL={db_url}")
    with Session(engine) as session:
        seed_propiedades(session)
    print("Seed de propiedades completado.")


if __name__ == "__main__":
    main()
