"""
Probar endpoint /crm/oportunidades con diferentes filtros para encontrar oportunidad 107
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session, select
from app.db import engine
from app.models import CRMOportunidad
from app.crud.crm_oportunidad_crud import crm_oportunidad_crud

with Session(engine) as session:
    print("\n=== TEST 1: Sin filtros ===")
    items, total = crm_oportunidad_crud.list(
        session,
        page=1,
        per_page=100,
        sort_by="created_at",
        sort_dir="desc",
        filters={},
        deleted="exclude"
    )
    oportunidad_107 = [item for item in items if item.id == 107]
    print(f"Total oportunidades: {total}")
    print(f"Oportunidad 107 encontrada: {'SÍ' if oportunidad_107 else 'NO'}")
    if oportunidad_107:
        print(f"  - tipo_operacion_id: {oportunidad_107[0].tipo_operacion_id}")
    
    print("\n=== TEST 2: Con tipo_operacion_id=1 ===")
    items, total = crm_oportunidad_crud.list(
        session,
        page=1,
        per_page=100,
        sort_by="created_at",
        sort_dir="desc",
        filters={"tipo_operacion_id": 1},
        deleted="exclude"
    )
    oportunidad_107 = [item for item in items if item.id == 107]
    print(f"Total oportunidades: {total}")
    print(f"Oportunidad 107 encontrada: {'SÍ' if oportunidad_107 else 'NO'}")
    
    print("\n=== TEST 3: Con tipo_operacion_id=3 ===")
    items, total = crm_oportunidad_crud.list(
        session,
        page=1,
        per_page=100,
        sort_by="created_at",
        sort_dir="desc",
        filters={"tipo_operacion_id": 3},
        deleted="exclude"
    )
    oportunidad_107 = [item for item in items if item.id == 107]
    print(f"Total oportunidades: {total}")
    print(f"Oportunidad 107 encontrada: {'SÍ' if oportunidad_107 else 'NO'}")
    
    print("\n=== TEST 4: Buscar directamente en la DB ===")
    stmt = select(CRMOportunidad).where(
        CRMOportunidad.id == 107,
        CRMOportunidad.deleted_at.is_(None)
    )
    result = session.exec(stmt).first()
    if result:
        print(f"✅ Oportunidad 107 existe en DB")
        print(f"  - tipo_operacion_id: {result.tipo_operacion_id}")
        print(f"  - estado: {result.estado}")
        print(f"  - deleted_at: {result.deleted_at}")
    else:
        print(f"❌ Oportunidad 107 NO existe en DB")
