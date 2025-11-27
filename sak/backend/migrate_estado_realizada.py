#!/usr/bin/env python3
"""
Valida que todas las propiedades pasaron del estado "4-alquilada"
al nuevo estado "4-realizada" luego de ejecutar la migración.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlmodel import Session, create_engine, select

# Permitir importar el paquete `app` cuando se ejecuta el script directamente.
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.core.config import settings  # noqa: E402
from app.models import Propiedad  # noqa: E402


def main() -> int:
    """Validar migración de estados."""
    print("Validando migración de estado 4-alquilada -> 4-realizada\n")

    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

    with Session(engine) as session:
        antiguas = session.exec(
            select(Propiedad).where(Propiedad.estado == "4-alquilada")
        ).all()
        nuevas = session.exec(
            select(Propiedad).where(Propiedad.estado == "4-realizada")
        ).all()

        print("Resultados:")
        print(f"  - Propiedades con estado '4-alquilada': {len(antiguas)}")
        print(f"  - Propiedades con estado '4-realizada': {len(nuevas)}")

        if antiguas:
            print(
                f"\nADVERTENCIA: aún hay {len(antiguas)} propiedades con estado '4-alquilada'."
            )
            print("Ejecutá `alembic upgrade head` para aplicar la migración.")
            return 1

        if nuevas:
            print(f"\nMigración exitosa: {len(nuevas)} propiedades actualizadas.")
            print("\nPropiedades con estado 4-realizada:")
            for prop in nuevas[:5]:
                print(f"  - ID {prop.id}: {prop.nombre}")
            restantes = len(nuevas) - 5
            if restantes > 0:
                print(f"  ... y {restantes} más.")
        else:
            print("\nNo hay propiedades en estado 4-realizada.")

        print("\nValidación completada.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
