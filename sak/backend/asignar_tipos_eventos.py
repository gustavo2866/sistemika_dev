import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select

from app.db import engine
from app.models.crm_catalogos import CRMTipoEvento
from app.models.crm_evento import CRMEvento


def asignar_tipos_validos() -> None:
    with Session(engine) as session:
        eventos = session.exec(select(CRMEvento)).all()
        tipos_catalogo = session.exec(select(CRMTipoEvento)).all()
        tipos_validos = [tipo.id for tipo in tipos_catalogo]

        print(f"Tipos validos: {len(tipos_validos)}")

        eventos_a_actualizar = [
            evento for evento in eventos if evento.tipo_id is None or evento.tipo_id not in tipos_validos
        ]

        print(f"\nEventos a actualizar: {len(eventos_a_actualizar)}")

        for i, evento in enumerate(eventos_a_actualizar):
            tipo_asignado = tipos_validos[i % len(tipos_validos)]
            evento.tipo_id = tipo_asignado
            print(f"  Evento {evento.id}: tipo_id -> '{tipo_asignado}'")

        session.commit()
        print(f"\nOK. {len(eventos_a_actualizar)} eventos actualizados")

        distribucion: dict[int, int] = {}
        for evento in session.exec(select(CRMEvento)).all():
            distribucion[evento.tipo_id] = distribucion.get(evento.tipo_id, 0) + 1

        print("\nDistribucion final:")
        for tipo, count in sorted(distribucion.items()):
            print(f"  {tipo}: {count}")


if __name__ == "__main__":
    asignar_tipos_validos()
