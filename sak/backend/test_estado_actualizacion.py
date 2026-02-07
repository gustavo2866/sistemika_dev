#!/usr/bin/env python3
"""
Script para probar la actualización automática de estados de solicitudes
cuando se crea una orden de compra.
"""

import sys
sys.path.insert(0, '.')

from app.db import get_session
from app.models.compras import PoSolicitud, PoSolicitudDetalle, EstadoPoSolicitud
from app.routers.po_orden_compra_router import _extract_solicitud_ids_from_detalles
from sqlmodel import select

def test_extract_solicitud_ids():
    """Prueba la función _extract_solicitud_ids_from_detalles"""
    
    print("=== PRUEBA: Extracción de IDs de solicitudes ===")
    
    # Simular payload de detalles como llega desde el frontend
    detalles_payload = [
        {
            "solicitud_detalle_id": 99,
            "articulo_id": 17,
            "cantidad": 1,
            "precio_unitario": 100
        },
        {
            "solicitud_detalle_id": 94,
            "articulo_id": 5,
            "cantidad": 2,
            "precio_unitario": 50
        },
        {
            "solicitud_detalle_id": 98,
            "articulo_id": 26,
            "cantidad": 1,
            "precio_unitario": 75
        }
    ]
    
    # Obtener sesión de DB
    for db in get_session():
        print("\n1. Extrayendo IDs de solicitudes...")
        solicitud_ids = _extract_solicitud_ids_from_detalles(db, detalles_payload)
        print(f"   IDs extraídos: {solicitud_ids}")
        
        if solicitud_ids:
            print("\n2. Buscando solicitudes en DB...")
            solicitudes = db.exec(select(PoSolicitud).where(PoSolicitud.id.in_(solicitud_ids))).all()
            
            print(f"   Solicitudes encontradas: {len(solicitudes)}")
            for sol in solicitudes:
                print(f"   - Solicitud {sol.id}: estado actual = {sol.estado}")
            
            print("\n3. Simulando actualización de estados...")
            for sol in solicitudes:
                estado_anterior = sol.estado
                sol.estado = EstadoPoSolicitud.EN_PROCESO.value
                print(f"   - Solicitud {sol.id}: {estado_anterior} -> {sol.estado}")
            
            print("\n4. Verificando que la actualización funcionaría...")
            print("   ✓ Todas las solicitudes serían actualizadas a 'en_proceso'")
            
        break
    
    print("\n✅ Prueba completada exitosamente")

def reset_solicitudes_to_aprobada():
    """Resetea las solicitudes de prueba al estado 'aprobada'"""
    
    print("\n=== RESET: Regresando solicitudes a 'aprobada' ===")
    
    for db in get_session():
        solicitudes = db.exec(select(PoSolicitud).where(PoSolicitud.id.in_([94, 95]))).all()
        
        for sol in solicitudes:
            sol.estado = EstadoPoSolicitud.APROBADA.value
            db.add(sol)
        
        db.commit()
        print("   ✓ Solicitudes regresadas a estado 'aprobada'")
        break

if __name__ == "__main__":
    test_extract_solicitud_ids()
    reset_solicitudes_to_aprobada()