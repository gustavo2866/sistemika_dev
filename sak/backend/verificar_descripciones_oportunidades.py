import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad

def verificar_descripciones():
    with Session(engine) as session:
        statement = select(CRMOportunidad).order_by(CRMOportunidad.id)
        oportunidades = session.exec(statement).all()
        
        print(f"Total de oportunidades: {len(oportunidades)}\n")
        
        sin_descripcion = []
        con_descripcion = []
        
        for oport in oportunidades:
            if not oport.descripcion or oport.descripcion.strip() == "":
                sin_descripcion.append(oport.id)
            else:
                con_descripcion.append({
                    'id': oport.id,
                    'tipo_operacion': oport.tipo_operacion,
                    'descripcion': oport.descripcion[:80]
                })
        
        print(f"Sin descripción: {len(sin_descripcion)}")
        if sin_descripcion:
            print(f"  IDs: {sin_descripcion[:20]}")
            if len(sin_descripcion) > 20:
                print(f"  ... y {len(sin_descripcion) - 20} más\n")
        
        print(f"\nCon descripción: {len(con_descripcion)}")
        if con_descripcion:
            print("\nMuestra de descripciones por tipo de operación:")
            por_tipo = {}
            for item in con_descripcion:
                tipo = str(item['tipo_operacion']) if item['tipo_operacion'] else 'sin_tipo'
                if tipo not in por_tipo:
                    por_tipo[tipo] = []
                if len(por_tipo[tipo]) < 3:
                    por_tipo[tipo].append(item)
            
            for tipo, items in sorted(por_tipo.items()):
                print(f"\n{tipo}:")
                for item in items:
                    print(f"  ID {item['id']}: {item['descripcion']}...")

if __name__ == "__main__":
    verificar_descripciones()
