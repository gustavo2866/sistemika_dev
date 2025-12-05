"""
Script para asignar true al campo activo de todas las oportunidades.
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad

def main():
    with Session(engine) as session:
        # Obtener todas las oportunidades
        statement = select(CRMOportunidad)
        oportunidades = session.exec(statement).all()
        
        print(f"Total de oportunidades: {len(oportunidades)}")
        
        # Contar cuántas ya tienen activo=True
        ya_activas = sum(1 for o in oportunidades if o.activo)
        print(f"Ya activas: {ya_activas}")
        print(f"Inactivas: {len(oportunidades) - ya_activas}")
        
        # Actualizar todas a activo=True
        updated = 0
        for oportunidad in oportunidades:
            if not oportunidad.activo:
                oportunidad.activo = True
                updated += 1
            
            if updated % 50 == 0 and updated > 0:
                print(f"Procesadas {updated} oportunidades...")
        
        # Guardar cambios
        session.commit()
        print(f"\n✅ Se activaron {updated} oportunidades")
        print(f"✅ Total de oportunidades activas: {len(oportunidades)}")

if __name__ == "__main__":
    main()
