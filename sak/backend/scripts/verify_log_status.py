#!/usr/bin/env python3
"""
Verificar el estado de la tabla propiedades_log_status después del poblado
"""

import sys
import os

# Agregar el directorio backend al path
backend_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(backend_dir)
sys.path.insert(0, parent_dir)

from app.database import get_session
from app.models.propiedad import PropiedadesLogStatus, Propiedad, PropiedadesStatus
from sqlalchemy import func

def main():
    session = next(get_session())
    
    # Conteos generales
    total_logs = session.query(PropiedadesLogStatus).count()
    total_propiedades = session.query(Propiedad).count()
    
    print(f"📊 ESTADÍSTICAS GENERALES:")
    print(f"   • Total registros en log: {total_logs}")
    print(f"   • Total propiedades: {total_propiedades}")
    
    # Propiedades con/sin logs
    propiedades_con_logs = session.query(Propiedad.id)\
        .join(PropiedadesLogStatus, Propiedad.id == PropiedadesLogStatus.propiedad_id)\
        .distinct().count()
    
    print(f"   • Propiedades con logs: {propiedades_con_logs}/{total_propiedades}")
    
    # Distribución por estado en último log
    print(f"\n🏷️  DISTRIBUCIÓN ESTADOS ACTUALES (según último log):")
    ultimo_estado_query = session.query(
        PropiedadesStatus.nombre,
        func.count(Propiedad.id).label('cantidad')
    ).select_from(Propiedad)\
    .join(
        PropiedadesLogStatus,
        Propiedad.id == PropiedadesLogStatus.propiedad_id
    )\
    .join(PropiedadesStatus, PropiedadesLogStatus.estado_id == PropiedadesStatus.id)\
    .filter(
        PropiedadesLogStatus.fecha == (
            session.query(func.max(PropiedadesLogStatus.fecha))
            .filter(PropiedadesLogStatus.propiedad_id == Propiedad.id)
            .scalar_subquery()
        )
    ).group_by(PropiedadesStatus.nombre).all()
    
    for estado, cantidad in ultimo_estado_query:
        print(f"   • {estado}: {cantidad}")
    
    # Ejemplos de logs por propiedad
    print(f"\n📋 EJEMPLOS DE LOGS (primeras 3 propiedades):")
    primeras_propiedades = session.query(Propiedad).limit(3).all()
    
    for prop in primeras_propiedades:
        logs = session.query(PropiedadesLogStatus)\
            .join(PropiedadesStatus, PropiedadesLogStatus.estado_id == PropiedadesStatus.id)\
            .filter(PropiedadesLogStatus.propiedad_id == prop.id)\
            .order_by(PropiedadesLogStatus.fecha)\
            .all()
        
        print(f"\n🏠 Propiedad {prop.id}: {prop.nombre}")
        print(f"   Estado actual tabla: {prop.estado.nombre if prop.estado else 'N/A'}")
        if logs:
            print(f"   Logs encontrados: {len(logs)}")
            print(f"   Primer log: {logs[0].fecha} → {logs[0].estado.nombre}")
            print(f"   Último log: {logs[-1].fecha} → {logs[-1].estado.nombre}")
        else:
            print(f"   ❌ Sin logs encontrados!")

if __name__ == "__main__":
    main()