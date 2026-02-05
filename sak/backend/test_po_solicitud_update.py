#!/usr/bin/env python3
"""
Script para probar actualizaciones de po_solicitudes
"""

import sys
import os

# Agregar el directorio del proyecto al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import get_session
from app.routers.po_solicitud_router import po_solicitud_crud
from app.models.compras import PoSolicitud

def test_update():
    """Prueba una actualización simple"""
    session = next(get_session())
    
    # Buscar una solicitud existente
    try:
        from sqlmodel import select
        statement = select(PoSolicitud).limit(1)
        result = session.exec(statement)
        solicitudes = result.all()
        
        if not solicitudes:
            print("❌ No hay solicitudes en la DB")
            return
            
        solicitud = solicitudes[0]
        print(f"✅ Encontrada solicitud #{solicitud.id}")
        print(f"   Título actual: '{solicitud.titulo}'")
        print(f"   Total actual: {solicitud.total}")
        print(f"   Detalles: {len(getattr(solicitud, 'detalles', []))}")
        
        # Payload de prueba (simular lo que viene del frontend)
        test_payload = {
            "id": solicitud.id,
            "titulo": f"{solicitud.titulo} (actualizado)",
            "comentario": "Prueba de actualización desde script",
            "detalles": [
                {
                    "id": detalle.id if hasattr(detalle, 'id') else None,
                    "articulo_id": detalle.articulo_id,
                    "descripcion": f"{detalle.descripcion} (mod)",
                    "unidad_medida": detalle.unidad_medida,
                    "cantidad": detalle.cantidad,
                    "precio": detalle.precio,
                    "importe": detalle.importe,
                }
                for detalle in getattr(solicitud, 'detalles', [])
            ]
        }
        
        print(f"📤 Enviando payload: {len(test_payload)} campos")
        print(f"📤 Detalles a actualizar: {len(test_payload['detalles'])}")
        
        # Ejecutar update
        resultado = po_solicitud_crud.update(session, solicitud.id, test_payload)
        
        if resultado:
            print(f"✅ Actualización exitosa")
            print(f"   Título final: '{resultado.titulo}'")
            print(f"   Total final: {resultado.total}")
        else:
            print("❌ La actualización falló - objeto None")
            
    except Exception as e:
        print(f"💥 Error durante la actualización: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        session.close()

if __name__ == "__main__":
    test_update()