"""
Script 03: Validar migración de propiedades y vacancias.

Este script verifica que la migración se haya completado correctamente:
- Todas las propiedades tienen estado con prefijo numérico
- Todas las propiedades tienen estado_fecha
- Propiedades no alquiladas/retiradas tienen vacancia activa
- Propiedades alquiladas/retiradas tienen vacancia cerrada

Ejecutar después de los scripts 01 y 02.
"""

import sys
import os
from datetime import datetime

# Agregar path del backend al PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia


ESTADOS_VALIDOS = ['1-recibida', '2-en_reparacion', '3-disponible', '4-alquilada', '5-retirada']
ESTADOS_CON_CICLO_CERRADO = ['4-alquilada', '5-retirada']


def validate_migration():
    """Valida que la migración se haya completado correctamente."""
    
    print("\n" + "="*60)
    print("SCRIPT 03: Validación de migración")
    print("="*60)
    
    errores = []
    warnings = []
    
    with Session(engine) as session:
        # Obtener todas las propiedades
        statement = select(Propiedad).where(Propiedad.deleted_at.is_(None))
        propiedades = session.exec(statement).all()
        
        print(f"\nValidando {len(propiedades)} propiedades...\n")
        
        for propiedad in propiedades:
            prop_id = propiedad.id
            prop_nombre = propiedad.nombre
            
            # 1. Validar formato de estado
            if propiedad.estado not in ESTADOS_VALIDOS:
                errores.append(f"Propiedad {prop_id} ('{prop_nombre}'): estado inválido '{propiedad.estado}'")
            
            # 2. Validar estado_fecha
            if not propiedad.estado_fecha:
                errores.append(f"Propiedad {prop_id} ('{prop_nombre}'): falta estado_fecha")
            
            # 3. Verificar vacancias
            vacancia_statement = select(Vacancia).where(
                Vacancia.propiedad_id == prop_id,
                Vacancia.deleted_at.is_(None)
            )
            vacancias = session.exec(vacancia_statement).all()
            
            if not vacancias:
                errores.append(f"Propiedad {prop_id} ('{prop_nombre}'): sin vacancias")
                continue
            
            # Verificar vacancia activa
            vacancias_activas = [v for v in vacancias if v.ciclo_activo]
            
            if propiedad.estado in ESTADOS_CON_CICLO_CERRADO:
                # Debe tener ciclo cerrado
                if vacancias_activas:
                    errores.append(f"Propiedad {prop_id} ('{prop_nombre}'): estado {propiedad.estado} pero tiene vacancia activa")
            else:
                # Debe tener ciclo activo
                if not vacancias_activas:
                    errores.append(f"Propiedad {prop_id} ('{prop_nombre}'): estado {propiedad.estado} pero no tiene vacancia activa")
                elif len(vacancias_activas) > 1:
                    warnings.append(f"Propiedad {prop_id} ('{prop_nombre}'): tiene {len(vacancias_activas)} vacancias activas")
            
            # 4. Validar consistencia de fechas en vacancia activa
            for vacancia in vacancias_activas:
                if not vacancia.fecha_recibida:
                    errores.append(f"Vacancia {vacancia.id} (Prop {prop_id}): falta fecha_recibida")
                
                # Validar secuencia de fechas
                fechas = []
                if vacancia.fecha_recibida:
                    fechas.append(('recibida', vacancia.fecha_recibida))
                if vacancia.fecha_en_reparacion:
                    fechas.append(('en_reparacion', vacancia.fecha_en_reparacion))
                if vacancia.fecha_disponible:
                    fechas.append(('disponible', vacancia.fecha_disponible))
                if vacancia.fecha_alquilada:
                    fechas.append(('alquilada', vacancia.fecha_alquilada))
                if vacancia.fecha_retirada:
                    fechas.append(('retirada', vacancia.fecha_retirada))
                
                # Verificar que las fechas están en orden
                for i in range(1, len(fechas)):
                    if fechas[i][1] < fechas[i-1][1]:
                        warnings.append(
                            f"Vacancia {vacancia.id} (Prop {prop_id}): "
                            f"fecha_{fechas[i][0]} es anterior a fecha_{fechas[i-1][0]}"
                        )
        
        # Resumen
        print("\n" + "-"*60)
        print("RESUMEN DE VALIDACIÓN:")
        print(f"  Total propiedades validadas: {len(propiedades)}")
        print(f"  Errores encontrados: {len(errores)}")
        print(f"  Warnings: {len(warnings)}")
        
        if errores:
            print("\n❌ ERRORES:")
            for error in errores:
                print(f"  - {error}")
        
        if warnings:
            print("\n⚠️  WARNINGS:")
            for warning in warnings:
                print(f"  - {warning}")
        
        if not errores and not warnings:
            print("\n✅ Todas las validaciones pasaron exitosamente")
        elif not errores:
            print("\n✅ Validación completada con warnings (revisar pero no crítico)")
        else:
            print("\n❌ Validación falló - revisar errores")
        
        print("-"*60 + "\n")
        
        return len(errores) == 0


if __name__ == "__main__":
    try:
        success = validate_migration()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error durante la validación: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
