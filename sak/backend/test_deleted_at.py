#!/usr/bin/env python3

import sys
from pathlib import Path

# Agregar el directorio backend al path para importar módulos
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from sqlmodel import Session, select
from app.db import engine
from app.models.compras import PoSolicitud

def test_deleted_at_check():
    """Verificar el estado de deleted_at de las solicitudes"""
    print("\n=== TEST: Verificar deleted_at ===")
    
    with Session(engine) as session:
        # Buscar todas las solicitudes incluidas las "borradas"
        statement = select(PoSolicitud)
        solicitudes = session.exec(statement).all()
        
        if not solicitudes:
            print("❌ No hay solicitudes en la DB")
            return
            
        print(f"✅ Encontradas {len(solicitudes)} solicitudes total")
        
        for sol in solicitudes:
            deleted_status = "DELETED" if sol.deleted_at else "ACTIVE"
            print(f"  ID={sol.id}, titulo='{sol.titulo[:30]}...', deleted_at={sol.deleted_at} [{deleted_status}]")
        
        # Contar activas vs borradas
        activas = [s for s in solicitudes if s.deleted_at is None]
        borradas = [s for s in solicitudes if s.deleted_at is not None]
        
        print(f"\n📊 Resumen:")
        print(f"  🟢 Activas: {len(activas)}")
        print(f"  🔴 Borradas: {len(borradas)}")
        
        if len(activas) > 0:
            primera_activa = activas[0]
            print(f"\n🎯 Primera activa para test: ID={primera_activa.id}, titulo='{primera_activa.titulo}'")
            return primera_activa.id
        else:
            print(f"\n⚠️ No hay solicitudes activas para testear")
            return None

if __name__ == "__main__":
    test_deleted_at_check()