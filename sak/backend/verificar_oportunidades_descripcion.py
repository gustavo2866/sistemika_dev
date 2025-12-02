import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad

def verificar_oportunidades():
    with Session(engine) as session:
        # Obtener todas las oportunidades
        statement = select(CRMOportunidad)
        oportunidades = session.exec(statement).all()
        
        total = len(oportunidades)
        sin_descripcion = []
        con_descripcion_vacia = []
        
        for opp in oportunidades:
            if opp.descripcion is None:
                sin_descripcion.append(opp.id)
            elif opp.descripcion.strip() == "":
                con_descripcion_vacia.append(opp.id)
        
        print(f"Total de oportunidades: {total}")
        print(f"Oportunidades sin descripción (NULL): {len(sin_descripcion)}")
        print(f"Oportunidades con descripción vacía: {len(con_descripcion_vacia)}")
        print(f"Oportunidades con descripción válida: {total - len(sin_descripcion) - len(con_descripcion_vacia)}")
        
        if sin_descripcion:
            print(f"\n❌ Oportunidades sin descripción (NULL):")
            for opp_id in sin_descripcion[:10]:  # Mostrar solo las primeras 10
                print(f"  - ID: {opp_id}")
            if len(sin_descripcion) > 10:
                print(f"  ... y {len(sin_descripcion) - 10} más")
        
        if con_descripcion_vacia:
            print(f"\n⚠️ Oportunidades con descripción vacía:")
            for opp_id in con_descripcion_vacia[:10]:
                print(f"  - ID: {opp_id}")
            if len(con_descripcion_vacia) > 10:
                print(f"  ... y {len(con_descripcion_vacia) - 10} más")
        
        if not sin_descripcion and not con_descripcion_vacia:
            print("\n✅ Todas las oportunidades tienen descripción válida")

if __name__ == "__main__":
    verificar_oportunidades()
