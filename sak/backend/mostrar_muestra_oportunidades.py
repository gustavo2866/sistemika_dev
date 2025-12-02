import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad

def mostrar_muestra():
    with Session(engine) as session:
        statement = select(CRMOportunidad).order_by(CRMOportunidad.id).limit(20)
        oportunidades = session.exec(statement).all()
        
        print(f"Muestra de 20 oportunidades:\n")
        
        for oport in oportunidades:
            tipo_nombre = "Sin tipo"
            if oport.tipo_operacion:
                tipo_nombre = oport.tipo_operacion.nombre
            
            # Mostrar primeras palabras (título)
            primeras_palabras = ' '.join(oport.descripcion.split()[:8])
            
            print(f"ID {oport.id} | {tipo_nombre:15} | {primeras_palabras}...")

if __name__ == "__main__":
    mostrar_muestra()
