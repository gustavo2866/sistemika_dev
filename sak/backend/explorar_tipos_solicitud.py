#!/usr/bin/env python3

from sqlmodel import select
from app.db import get_session
from app.models.tipo_solicitud import TipoSolicitud
from app.models.compras import PoOrder

def explorar_tipos_solicitud():
    """Explora los tipos de solicitud existentes para clasificarlos"""
    
    with next(get_session()) as db:
        print("=== EXPLORANDO TIPOS DE SOLICITUD ===\n")
        
        # Obtener todos los tipos de solicitud
        tipos_solicitud = db.exec(select(TipoSolicitud)).all()
        
        print(f"📋 Total tipos de solicitud: {len(tipos_solicitud)}")
        
        for tipo in tipos_solicitud:
            print(f"\n🔍 ID: {tipo.id}")
            print(f"   Nombre: {tipo.nombre}")
            print(f"   Descripción: {tipo.descripcion or 'Sin descripción'}")
            print(f"   Filtro artículo: {tipo.tipo_articulo_filter or 'Sin filtro'}")
        
        # Verificar órdenes existentes por tipo
        print(f"\n=== ÓRDENES POR TIPO DE SOLICITUD ===")
        
        ordenes_count = db.exec(
            select(PoOrder.tipo_solicitud_id, TipoSolicitud.nombre)
            .join(TipoSolicitud, PoOrder.tipo_solicitud_id == TipoSolicitud.id, isouter=True)
        ).all()
        
        tipo_counts = {}
        for orden_tipo_id, tipo_nombre in ordenes_count:
            key = f"{orden_tipo_id}: {tipo_nombre or 'Sin nombre'}"
            tipo_counts[key] = tipo_counts.get(key, 0) + 1
        
        for tipo_key, count in sorted(tipo_counts.items()):
            print(f"   {tipo_key} -> {count} órdenes")
        
        print(f"\n=== CLASIFICACIÓN SUGERIDA ===")
        print("Basándose en los nombres, la clasificación podría ser:")
        print("🔧 MO-PROPIOS: tipos relacionados a labo rpropia, personal interno")  
        print("⚙️  SERVICIOS (MO-TERCEROS): tipos relacionados a servicios externos")
        print("📦 MATERIALES: resto de tipos (equipos, materiales, suministros)")

if __name__ == "__main__":
    explorar_tipos_solicitud()