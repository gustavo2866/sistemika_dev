"""
Script 01: Migrar estados de propiedades a formato con prefijo numérico.

Este script actualiza todas las propiedades existentes para que tengan:
- estado con prefijo numérico (ejemplo: '1-recibida')
- estado_fecha con timestamp actual
- estado_comentario con mensaje de migración

Ejecutar después de aplicar la migración de Alembic.
"""

import sys
import os
from datetime import datetime

# Agregar path del backend al PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models.propiedad import Propiedad


# Mapeo de estados antiguos a nuevos
MAPEO_ESTADOS = {
    'recibida': '1-recibida',
    'en_reparacion': '2-en_reparacion',
    'disponible': '3-disponible',
    'alquilada': '4-alquilada',
    'retirada': '5-retirada',
    # También mapear si ya tienen el prefijo (por si se ejecuta dos veces)
    '1-recibida': '1-recibida',
    '2-en_reparacion': '2-en_reparacion',
    '3-disponible': '3-disponible',
    '4-alquilada': '4-alquilada',
    '5-retirada': '5-retirada',
}


def migrate_estados():
    """Actualiza todos los estados de propiedades al nuevo formato."""
    
    print("\n" + "="*60)
    print("SCRIPT 01: Migración de estados de propiedades")
    print("="*60)
    
    with Session(engine) as session:
        # Obtener todas las propiedades
        statement = select(Propiedad).where(Propiedad.deleted_at.is_(None))
        propiedades = session.exec(statement).all()
        
        print(f"\nPropiedades encontradas: {len(propiedades)}")
        
        if len(propiedades) == 0:
            print("No hay propiedades para migrar.")
            return
        
        # Contadores
        actualizadas = 0
        sin_cambios = 0
        estados_desconocidos = []
        
        for propiedad in propiedades:
            estado_actual = propiedad.estado or 'recibida'
            
            # Obtener nuevo estado
            nuevo_estado = MAPEO_ESTADOS.get(estado_actual)
            
            if nuevo_estado is None:
                # Estado desconocido - por defecto usar '1-recibida'
                print(f"  ⚠️  Propiedad ID {propiedad.id}: estado desconocido '{estado_actual}', usando '1-recibida'")
                nuevo_estado = '1-recibida'
                estados_desconocidos.append((propiedad.id, estado_actual))
            
            # Actualizar si cambió
            if propiedad.estado != nuevo_estado:
                propiedad.estado = nuevo_estado
                propiedad.estado_fecha = datetime.utcnow()
                propiedad.estado_comentario = f"Migración automática desde '{estado_actual}'"
                actualizadas += 1
                print(f"  ✅ Propiedad ID {propiedad.id}: '{estado_actual}' → '{nuevo_estado}'")
            else:
                sin_cambios += 1
        
        # Guardar cambios
        session.commit()
        
        # Resumen
        print("\n" + "-"*60)
        print("RESUMEN:")
        print(f"  Total propiedades: {len(propiedades)}")
        print(f"  Actualizadas: {actualizadas}")
        print(f"  Sin cambios: {sin_cambios}")
        
        if estados_desconocidos:
            print(f"\n  Estados desconocidos encontrados:")
            for prop_id, estado in estados_desconocidos:
                print(f"    - Propiedad {prop_id}: '{estado}'")
        
        print("-"*60)
        print("✅ Migración completada exitosamente\n")


if __name__ == "__main__":
    try:
        migrate_estados()
    except Exception as e:
        print(f"\n❌ Error durante la migración: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
