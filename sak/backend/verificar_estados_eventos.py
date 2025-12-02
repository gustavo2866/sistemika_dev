import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento
from app.models.enums import EstadoEvento

def verificar_estados_eventos():
    with Session(engine) as session:
        statement = select(CRMEvento).order_by(CRMEvento.id)
        eventos = session.exec(statement).all()
        
        # Valores válidos de EstadoEvento
        estados_validos = [estado.value for estado in EstadoEvento]
        
        print(f"Estados válidos: {estados_validos}")
        print(f"\nTotal de eventos: {len(eventos)}\n")
        
        sin_estado = []
        estado_invalido = []
        distribucion = {}
        
        for evento in eventos:
            if evento.estado_evento is None:
                sin_estado.append(evento.id)
            elif evento.estado_evento not in estados_validos:
                estado_invalido.append((evento.id, evento.estado_evento))
            else:
                distribucion[evento.estado_evento] = distribucion.get(evento.estado_evento, 0) + 1
        
        print(f"Eventos sin estado: {len(sin_estado)}")
        if sin_estado:
            print(f"  IDs: {sin_estado[:10]}")
            if len(sin_estado) > 10:
                print(f"  ... y {len(sin_estado) - 10} más")
        
        print(f"\nEventos con estado inválido: {len(estado_invalido)}")
        if estado_invalido:
            for evento_id, estado in estado_invalido[:10]:
                print(f"  ID {evento_id}: '{estado}'")
            if len(estado_invalido) > 10:
                print(f"  ... y {len(estado_invalido) - 10} más")
        
        if distribucion:
            print(f"\nDistribución de estados válidos:")
            for estado, count in sorted(distribucion.items()):
                print(f"  {estado}: {count}")
        
        if not sin_estado and not estado_invalido:
            print("\n✅ Todos los eventos tienen estados válidos")
        else:
            print(f"\n❌ {len(sin_estado) + len(estado_invalido)} eventos con problemas")

if __name__ == "__main__":
    verificar_estados_eventos()
