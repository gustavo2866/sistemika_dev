#!/usr/bin/env python3
"""
Verificar el estado de la tabla propiedades_log_status después del poblado
"""

import os
import sys

# Cambiar al directorio backend
os.chdir(r"C:\Users\gpalmieri\source\sistemika\sak\backend")
sys.path.insert(0, os.getcwd())

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
    
    # Propiedades con logs
    propiedades_con_logs = session.query(Propiedad.id)\
        .join(PropiedadesLogStatus, Propiedad.id == PropiedadesLogStatus.propiedad_id)\
        .distinct().count()
    
    print(f"   • Propiedades con logs: {propiedades_con_logs}/{total_propiedades}")
    
    # Mostrar algunos ejemplos
    print(f"\n🏠 EJEMPLOS DE PROPIEDADES CON LOGS:")
    
    # Tomar 5 propiedades aleatorias con logs
    propiedades_ejemplo = session.query(Propiedad)\
        .join(PropiedadesLogStatus)\
        .distinct()\
        .limit(5).all()
    
    for prop in propiedades_ejemplo:
        logs = session.query(PropiedadesLogStatus)\
            .join(PropiedadesStatus, PropiedadesLogStatus.estado_id == PropiedadesStatus.id)\
            .filter(PropiedadesLogStatus.propiedad_id == prop.id)\
            .order_by(PropiedadesLogStatus.fecha)\
            .all()
        
        print(f"   {prop.id}: {prop.nombre}")
        print(f"      Estado actual: {prop.estado.nombre if prop.estado else 'N/A'}")
        print(f"      Logs: {len(logs)} registros")
        if logs:
            print(f"      Primer: {logs[0].fecha} → {logs[0].estado.nombre}")
            print(f"      Último: {logs[-1].fecha} → {logs[-1].estado.nombre}")
        print()

if __name__ == "__main__":
    main()