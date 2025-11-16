"""
Script 02: Crear registros de vacancia para todas las propiedades.

Este script crea un registro de vacancia activo para cada propiedad
que no tenga uno. Todas las propiedades inician en estado '1-recibida'
con un ciclo de vacancia activo.

Ejecutar después del script 01.
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


def seed_vacancias():
    """Crea registros de vacancia para propiedades sin vacancia activa."""
    
    print("\n" + "="*60)
    print("SCRIPT 02: Crear vacancias para propiedades")
    print("="*60)
    
    with Session(engine) as session:
        # Obtener todas las propiedades activas
        statement = select(Propiedad).where(Propiedad.deleted_at.is_(None))
        propiedades = session.exec(statement).all()
        
        print(f"\nPropiedades encontradas: {len(propiedades)}")
        
        if len(propiedades) == 0:
            print("No hay propiedades en la base de datos.")
            return
        
        # Contadores
        creadas = 0
        ya_existian = 0
        
        for propiedad in propiedades:
            # Verificar si ya tiene una vacancia activa
            vacancia_statement = select(Vacancia).where(
                Vacancia.propiedad_id == propiedad.id,
                Vacancia.ciclo_activo == True,
                Vacancia.deleted_at.is_(None)
            )
            vacancia_existente = session.exec(vacancia_statement).first()
            
            if vacancia_existente:
                ya_existian += 1
                print(f"  ⏭️  Propiedad ID {propiedad.id} ('{propiedad.nombre}'): ya tiene vacancia activa (ID {vacancia_existente.id})")
                continue
            
            # Crear nueva vacancia según el estado actual de la propiedad
            estado = propiedad.estado or '1-recibida'
            
            # Determinar fechas según el estado
            vacancia_data = {
                'propiedad_id': propiedad.id,
                'ciclo_activo': True,
                'fecha_recibida': datetime.utcnow(),
                'comentario_recibida': 'Vacancia creada por migración automática'
            }
            
            # Si el estado es diferente a '1-recibida', agregar fechas intermedias
            # (asumimos que pasó inmediatamente por cada estado)
            if estado == '2-en_reparacion':
                vacancia_data['fecha_en_reparacion'] = datetime.utcnow()
                vacancia_data['comentario_en_reparacion'] = 'Estado actual al momento de migración'
            elif estado == '3-disponible':
                vacancia_data['fecha_en_reparacion'] = datetime.utcnow()
                vacancia_data['fecha_disponible'] = datetime.utcnow()
                vacancia_data['comentario_disponible'] = 'Estado actual al momento de migración'
            elif estado == '4-alquilada':
                # Si está alquilada, crear vacancia cerrada
                vacancia_data['ciclo_activo'] = False
                vacancia_data['fecha_en_reparacion'] = datetime.utcnow()
                vacancia_data['fecha_disponible'] = datetime.utcnow()
                vacancia_data['fecha_alquilada'] = datetime.utcnow()
                vacancia_data['comentario_alquilada'] = 'Estado actual al momento de migración'
                vacancia_data['dias_reparacion'] = 0
                vacancia_data['dias_disponible'] = 0
                vacancia_data['dias_totales'] = 0
            elif estado == '5-retirada':
                # Si está retirada, crear vacancia cerrada sin alquilar
                vacancia_data['ciclo_activo'] = False
                vacancia_data['fecha_retirada'] = datetime.utcnow()
                vacancia_data['comentario_retirada'] = 'Estado actual al momento de migración'
                vacancia_data['dias_totales'] = 0
            
            # Crear vacancia
            nueva_vacancia = Vacancia(**vacancia_data)
            session.add(nueva_vacancia)
            creadas += 1
            
            # Emoji según estado
            emoji = "🆕"
            if estado == '4-alquilada':
                emoji = "✅"
            elif estado == '5-retirada':
                emoji = "🚫"
            
            print(f"  {emoji} Propiedad ID {propiedad.id} ('{propiedad.nombre}'): vacancia creada (estado: {estado})")
        
        # Guardar cambios
        session.commit()
        
        # Resumen
        print("\n" + "-"*60)
        print("RESUMEN:")
        print(f"  Total propiedades: {len(propiedades)}")
        print(f"  Vacancias creadas: {creadas}")
        print(f"  Ya existían: {ya_existian}")
        print("-"*60)
        print("✅ Seed de vacancias completado exitosamente\n")


if __name__ == "__main__":
    try:
        seed_vacancias()
    except Exception as e:
        print(f"\n❌ Error durante el seed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
