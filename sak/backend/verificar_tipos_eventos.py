import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select

from app.db import engine
from app.models.crm_catalogos import CRMTipoEvento
from app.models.crm_evento import CRMEvento


def verificar_tipos_eventos() -> None:
    with Session(engine) as session:
        eventos = session.exec(select(CRMEvento)).all()
        tipos_catalogo = session.exec(select(CRMTipoEvento)).all()
        tipos_validos = {tipo.id for tipo in tipos_catalogo}

        print(f"Tipos validos en catalogo: {len(tipos_validos)}")
        print(f"\nTotal de eventos: {len(eventos)}")

        sin_tipo = []
        tipo_invalido = []
        distribucion: dict[int, int] = {}

        for evento in eventos:
            if evento.tipo_id is None:
                sin_tipo.append(evento.id)
            elif evento.tipo_id not in tipos_validos:
                tipo_invalido.append((evento.id, evento.tipo_id))
            else:
                distribucion[evento.tipo_id] = distribucion.get(evento.tipo_id, 0) + 1

        print(f"\nEventos sin tipo_id: {len(sin_tipo)}")
        if sin_tipo:
            print(f"  IDs: {sin_tipo[:10]}")
            if len(sin_tipo) > 10:
                print(f"  ... y {len(sin_tipo) - 10} mas")

        print(f"\nEventos con tipo_id invalido: {len(tipo_invalido)}")
        if tipo_invalido:
            for evento_id, tipo in tipo_invalido[:10]:
                print(f"  ID {evento_id}: '{tipo}'")
            if len(tipo_invalido) > 10:
                print(f"  ... y {len(tipo_invalido) - 10} mas")

        if distribucion:
            print("\nDistribucion de tipos validos:")
            for tipo, count in sorted(distribucion.items()):
                print(f"  {tipo}: {count}")

        if not sin_tipo and not tipo_invalido:
            print("\nOK. Todos los eventos tienen tipos validos")
        else:
            print(f"\nWARN. {len(sin_tipo) + len(tipo_invalido)} eventos con problemas")


if __name__ == "__main__":
    verificar_tipos_eventos()
