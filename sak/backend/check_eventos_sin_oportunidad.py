"""
Verificar eventos sin oportunidad_id
"""
from sqlmodel import Session, select, func
from app.models.crm_evento import CRMEvento
from app.db import engine

with Session(engine) as session:
    total = session.exec(select(func.count(CRMEvento.id)).where(CRMEvento.deleted_at.is_(None))).one()
    sin_op = session.exec(select(func.count(CRMEvento.id)).where(CRMEvento.deleted_at.is_(None)).where(CRMEvento.oportunidad_id.is_(None))).one()
    
    print(f"\nTotal eventos: {total}")
    print(f"Sin oportunidad_id: {sin_op}")
    
    if sin_op > 0:
        print(f"\n⚠️ Hay {sin_op} eventos sin oportunidad asignada")
        print("\nOpciones:")
        print("1. Eliminarlos (si son datos de prueba)")
        print("2. Asignarles una oportunidad por defecto")
        print("3. Mantener oportunidad_id como opcional en el modelo")
