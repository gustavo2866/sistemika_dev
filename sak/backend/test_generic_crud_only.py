#!/usr/bin/env python3

import sys
import os
from pathlib import Path

# Agregar el directorio backend al path para importar módulos
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from sqlmodel import Session, select
from app.db import engine
from app.models.compras import PoSolicitud
from app.core.generic_crud import GenericCRUD

def test_generic_crud_update():
    """Test GenericCRUD update directo (sin nested relations)"""
    print("\n=== TEST: GenericCRUD.update directo ===")
    
    with Session(engine) as session:
        # 1. Buscar primera solicitud ACTIVA (deleted_at IS NULL)
        statement = select(PoSolicitud).where(PoSolicitud.deleted_at.is_(None)).limit(1)
        solicitud = session.exec(statement).first()
        if not solicitud:
            print("❌ No hay solicitudes ACTIVAS para testear")
            return

        print(f"✅ Solicitud ACTIVA encontrada: ID={solicitud.id}, titulo_original='{solicitud.titulo}'")
        print(f"✅ deleted_at={solicitud.deleted_at} (debe ser None)")
        
        # 2. Usar GenericCRUD directamente
        generic_crud = GenericCRUD(PoSolicitud)
        
        # 3. Datos de prueba (solo cabecera)
        update_data = {
            "titulo": f"TEST UPDATE {solicitud.id}",
            "comentario": "Actualizado por test genérico"
        }
        print(f"📤 Enviando datos: {update_data}")
        
        # 4. Ejecutar update
        try:
            result = generic_crud.update(session, solicitud.id, update_data)
            print(f"📥 Resultado update: {result}")
            
            if result:
                print(f"✅ Update exitoso: ID={result.id}, nuevo_titulo='{result.titulo}'")
                print(f"✅ Comentario actualizado: '{result.comentario}'")
            else:
                print("❌ Update retornó None")
                
        except Exception as e:
            print(f"❌ Error en update: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_generic_crud_update()