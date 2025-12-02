"""
Script para verificar oportunidades sin responsable asignado
"""
from sqlmodel import Session, select, func
from app.models.crm_oportunidad import CRMOportunidad
from app.db import engine


def check_oportunidades_responsables():
    with Session(engine) as session:
        # Total de oportunidades activas
        total = session.exec(
            select(func.count(CRMOportunidad.id))
            .where(CRMOportunidad.deleted_at.is_(None))
        ).one()
        
        # Oportunidades con responsable
        con_responsable = session.exec(
            select(func.count(CRMOportunidad.id))
            .where(CRMOportunidad.deleted_at.is_(None))
            .where(CRMOportunidad.responsable_id.is_not(None))
        ).one()
        
        # Oportunidades sin responsable
        sin_responsable = total - con_responsable
        
        print("\n" + "="*60)
        print("REPORTE DE OPORTUNIDADES - RESPONSABLES")
        print("="*60)
        print(f"Total de oportunidades activas: {total}")
        print(f"Con responsable asignado:       {con_responsable}")
        print(f"Sin responsable asignado:       {sin_responsable}")
        print("="*60)
        
        if sin_responsable > 0:
            print(f"\n⚠️  Hay {sin_responsable} oportunidades sin responsable asignado")
            print("\nListado de oportunidades sin responsable:")
            print("-"*60)
            
            oportunidades = session.exec(
                select(CRMOportunidad)
                .where(CRMOportunidad.deleted_at.is_(None))
                .where(CRMOportunidad.responsable_id.is_(None))
                .limit(20)
            ).all()
            
            for op in oportunidades:
                print(f"ID: {op.id} | Estado: {op.estado} | Contacto: {op.contacto_id} | Creado: {op.created_at}")
        else:
            print("\n✅ Todas las oportunidades tienen responsable asignado")
        
        print()


if __name__ == "__main__":
    check_oportunidades_responsables()
