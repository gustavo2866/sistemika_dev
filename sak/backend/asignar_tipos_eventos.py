import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento
from app.models.enums import TipoEvento
import random

def asignar_tipos_validos():
    with Session(engine) as session:
        # Obtener eventos con tipo inválido o sin tipo
        statement = select(CRMEvento)
        eventos = session.exec(statement).all()
        
        tipos_validos = [tipo.value for tipo in TipoEvento]
        print(f"Tipos válidos: {tipos_validos}")
        
        eventos_a_actualizar = []
        for evento in eventos:
            if evento.tipo_evento is None or evento.tipo_evento not in tipos_validos:
                eventos_a_actualizar.append(evento)
        
        print(f"\nEventos a actualizar: {len(eventos_a_actualizar)}")
        
        # Distribuir tipos de manera balanceada
        for i, evento in enumerate(eventos_a_actualizar):
            # Rotar entre los tipos válidos para una distribución equitativa
            tipo_asignado = tipos_validos[i % len(tipos_validos)]
            evento.tipo_evento = tipo_asignado
            print(f"  Evento {evento.id}: '{evento.tipo_evento}' -> '{tipo_asignado}'")
        
        session.commit()
        print(f"\n✅ {len(eventos_a_actualizar)} eventos actualizados")
        
        # Verificar distribución final
        statement = select(CRMEvento)
        todos_eventos = session.exec(statement).all()
        distribucion = {}
        for evento in todos_eventos:
            distribucion[evento.tipo_evento] = distribucion.get(evento.tipo_evento, 0) + 1
        
        print("\nDistribución final:")
        for tipo, count in sorted(distribucion.items()):
            print(f"  {tipo}: {count}")

if __name__ == "__main__":
    asignar_tipos_validos()
