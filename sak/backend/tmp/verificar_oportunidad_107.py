"""
Verificar datos de la oportunidad 107
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session, select
from app.db import engine
from app.models import CRMOportunidad

with Session(engine) as session:
    # Buscar oportunidad 107
    oportunidad = session.get(CRMOportunidad, 107)
    
    if oportunidad:
        print(f"\n=== OPORTUNIDAD 107 ===")
        print(f"ID: {oportunidad.id}")
        print(f"Título: {oportunidad.titulo}")
        print(f"Estado: {oportunidad.estado}")
        print(f"Tipo Operación ID: {oportunidad.tipo_operacion_id}")
        print(f"Contacto ID: {oportunidad.contacto_id}")
        print(f"Propiedad ID: {oportunidad.propiedad_id}")
        print(f"Emprendimiento ID: {oportunidad.emprendimiento_id}")
        print(f"Responsable ID: {oportunidad.responsable_id}")
        print(f"Deleted At: {oportunidad.deleted_at}")
        print(f"Created At: {oportunidad.created_at}")
    else:
        print("\n❌ Oportunidad 107 NO ENCONTRADA")
    
    # Verificar si hay oportunidades con deleted_at
    stmt = select(CRMOportunidad).where(CRMOportunidad.id == 107)
    result = session.exec(stmt).first()
    
    if result:
        print(f"\n=== QUERY DIRECTA (sin get) ===")
        print(f"ID: {result.id}")
        print(f"Deleted At: {result.deleted_at}")
