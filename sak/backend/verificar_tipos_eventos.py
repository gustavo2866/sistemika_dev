import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento
from app.models.enums import TipoEvento

def verificar_tipos_eventos():
    with Session(engine) as session:
        # Obtener todos los eventos
        statement = select(CRMEvento)
        eventos = session.exec(statement).all()
        
        # Valores válidos de TipoEvento
        tipos_validos = [tipo.value for tipo in TipoEvento]
        
        print(f"Tipos válidos: {tipos_validos}")
        print(f"\nTotal de eventos: {len(eventos)}")
        
        sin_tipo = []
        tipo_invalido = []
        distribucion = {}
        
        for evento in eventos:
            if evento.tipo_evento is None:
                sin_tipo.append(evento.id)
            elif evento.tipo_evento not in tipos_validos:
                tipo_invalido.append((evento.id, evento.tipo_evento))
            else:
                distribucion[evento.tipo_evento] = distribucion.get(evento.tipo_evento, 0) + 1
        
        print(f"\nEventos sin tipo: {len(sin_tipo)}")
        if sin_tipo:
            print(f"  IDs: {sin_tipo[:10]}")
            if len(sin_tipo) > 10:
                print(f"  ... y {len(sin_tipo) - 10} más")
        
        print(f"\nEventos con tipo inválido: {len(tipo_invalido)}")
        if tipo_invalido:
            for evento_id, tipo in tipo_invalido[:10]:
                print(f"  ID {evento_id}: '{tipo}'")
            if len(tipo_invalido) > 10:
                print(f"  ... y {len(tipo_invalido) - 10} más")
        
        if distribucion:
            print(f"\nDistribución de tipos válidos:")
            for tipo, count in sorted(distribucion.items()):
                print(f"  {tipo}: {count}")
        
        if not sin_tipo and not tipo_invalido:
            print("\n✅ Todos los eventos tienen tipos válidos")
        else:
            print(f"\n❌ {len(sin_tipo) + len(tipo_invalido)} eventos con problemas")

if __name__ == "__main__":
    verificar_tipos_eventos()
