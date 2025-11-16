"""
Verificar datos en la base de datos.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.db import get_session
from app.models.vacancia import Vacancia
from app.models.propiedad import Propiedad
from sqlmodel import select, func
from datetime import datetime

def main():
    for session in get_session():
        # Contar propiedades
        total_propiedades = session.exec(
            select(func.count(Propiedad.id))
        ).one()
        print(f"📊 Total propiedades: {total_propiedades}")
        
        # Contar vacancias
        total_vacancias = session.exec(
            select(func.count(Vacancia.id))
        ).one()
        print(f"📊 Total vacancias: {total_vacancias}")
        
        if total_vacancias == 0:
            print("\n⚠️  No hay vacancias en la base de datos!")
            return
        
        # Ver algunas vacancias
        print("\n🔍 Primeras 5 vacancias:")
        vacancias = session.exec(
            select(Vacancia).limit(5)
        ).all()
        
        for v in vacancias:
            print(f"\n  Vacancia #{v.id}:")
            print(f"    Propiedad ID: {v.propiedad_id}")
            print(f"    Ciclo activo: {v.ciclo_activo}")
            print(f"    Fecha recibida: {v.fecha_recibida}")
            print(f"    Fecha en reparación: {v.fecha_en_reparacion}")
            print(f"    Fecha disponible: {v.fecha_disponible}")
            print(f"    Fecha alquilada: {v.fecha_alquilada}")
            print(f"    Fecha retirada: {v.fecha_retirada}")
            print(f"    Días totales: {v.dias_totales}")
            print(f"    Días reparación: {v.dias_reparacion}")
            print(f"    Días disponible: {v.dias_disponible}")
        
        # Rangos de fechas
        result = session.exec(
            select(
                func.min(Vacancia.fecha_recibida).label('min_fecha'),
                func.max(Vacancia.fecha_recibida).label('max_fecha')
            )
        ).one()
        
        print(f"\n📅 Rango de fechas en vacancias:")
        print(f"    Mínima: {result.min_fecha}")
        print(f"    Máxima: {result.max_fecha}")

if __name__ == "__main__":
    main()
