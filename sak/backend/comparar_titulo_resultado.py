import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento

def comparar_titulo_resultado():
    with Session(engine) as session:
        statement = select(CRMEvento).order_by(CRMEvento.id)
        eventos = session.exec(statement).all()
        
        print(f"Total de eventos: {len(eventos)}\n")
        
        iguales = 0
        diferentes = 0
        
        for evento in eventos:
            titulo = evento.titulo or ""
            resultado = evento.resultado or ""
            
            # Verificar si son iguales (comparando sin espacios extra)
            son_iguales = titulo.strip() == resultado.strip()
            
            if son_iguales:
                iguales += 1
                print(f"ID {evento.id}: ✓ IGUALES")
                print(f"  Título:    {titulo[:80]}")
                print(f"  Resultado: {resultado[:80]}")
            else:
                diferentes += 1
                print(f"ID {evento.id}: ✗ DIFERENTES")
                print(f"  Título:    {titulo[:80]}")
                print(f"  Resultado: {resultado[:80]}")
            print()
        
        print(f"\n{'='*60}")
        print(f"Resumen:")
        print(f"  Eventos con título = resultado: {iguales}")
        print(f"  Eventos con título ≠ resultado: {diferentes}")
        print(f"{'='*60}")

if __name__ == "__main__":
    comparar_titulo_resultado()
