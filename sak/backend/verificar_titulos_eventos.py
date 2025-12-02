import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento

def verificar_titulos():
    with Session(engine) as session:
        statement = select(CRMEvento).order_by(CRMEvento.id)
        eventos = session.exec(statement).all()
        
        print(f"Total de eventos: {len(eventos)}\n")
        
        for evento in eventos:
            print(f"ID: {evento.id}")
            print(f"  Título: {evento.titulo}")
            print(f"  Tipo: {evento.tipo_evento}")
            print(f"  Resultado: {evento.resultado[:50] if evento.resultado else 'Sin resultado'}")
            print()

if __name__ == "__main__":
    verificar_titulos()
