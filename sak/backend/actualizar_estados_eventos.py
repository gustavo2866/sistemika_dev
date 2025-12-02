import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento

def actualizar_estados_eventos():
    with Session(engine) as session:
        statement = select(CRMEvento).order_by(CRMEvento.id)
        eventos = session.exec(statement).all()
        
        # Mapeo de valores antiguos a nuevos
        mapeo = {
            "pendiente": "1-pendiente",
            "hecho": "2-realizado",
            "cancelado": "3-cancelado"
        }
        
        print(f"Total de eventos: {len(eventos)}\n")
        
        actualizados = 0
        for evento in eventos:
            if evento.estado_evento in mapeo:
                valor_anterior = evento.estado_evento
                evento.estado_evento = mapeo[valor_anterior]
                print(f"Evento {evento.id}: '{valor_anterior}' -> '{evento.estado_evento}'")
                actualizados += 1
        
        if actualizados > 0:
            session.commit()
            print(f"\n✅ {actualizados} eventos actualizados")
        else:
            print("No hay eventos para actualizar")

if __name__ == "__main__":
    actualizar_estados_eventos()
