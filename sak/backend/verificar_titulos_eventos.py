import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select

from app.db import engine
from app.models.crm_evento import CRMEvento


def verificar_titulos() -> None:
    with Session(engine) as session:
        eventos = session.exec(select(CRMEvento).order_by(CRMEvento.id)).all()

        print(f"Total de eventos: {len(eventos)}\n")

        for evento in eventos:
            print(f"ID: {evento.id}")
            print(f"  Titulo: {evento.titulo}")
            print(f"  Tipo ID: {evento.tipo_id}")
            resultado = evento.resultado[:50] if evento.resultado else "Sin resultado"
            print(f"  Resultado: {resultado}")
            print()


if __name__ == "__main__":
    verificar_titulos()
