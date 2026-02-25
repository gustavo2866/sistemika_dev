from sqlmodel import Session, create_engine, select
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.tipo_actualizacion import TipoActualizacion
from datetime import date
import os
from dotenv import load_dotenv
from calendar import monthrange

def subtract_months(end_date, months):
    """Restar meses a una fecha"""
    month = end_date.month - 1 - months
    year = end_date.year + month // 12
    month = month % 12 + 1
    day = min(end_date.day, monthrange(year, month)[1])
    return date(year, month, day)

# Configuración
load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))

print('CORRIGIENDO FECHAS DE RENOVACIÓN (LÓGICA CORRECTA)')
print('=' * 60)
print('La fecha de renovación debe ser ANTERIOR al vencimiento del contrato')
print('según el tipo de actualización (trimestral = 3 meses antes)')
print()

with Session(engine) as session:
    # Obtener estado realizada
    estado_realizada = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    
    # Obtener propiedades realizadas con tipo_actualizacion y vencimiento
    propiedades = session.exec(
        select(Propiedad).where(
            Propiedad.tipo_operacion_id == 1,
            Propiedad.propiedad_status_id == estado_realizada.id,
            Propiedad.tipo_actualizacion_id.is_not(None),
            Propiedad.vencimiento_contrato.is_not(None)
        )
    ).all()
    
    print(f'Propiedades a revisar: {len(propiedades)}')
    print()
    
    actualizaciones = 0
    
    for prop in propiedades:
        tipo_act = session.get(TipoActualizacion, prop.tipo_actualizacion_id)
        
        if tipo_act and prop.vencimiento_contrato:
            # Calcular fecha de renovación CORRECTA (restar meses del vencimiento)
            fecha_renovacion_correcta = subtract_months(prop.vencimiento_contrato, tipo_act.cantidad_meses)
            
            # Verificar si es diferente a la actual
            if not prop.fecha_renovacion or prop.fecha_renovacion != fecha_renovacion_correcta:
                print(f'  {prop.nombre}:')
                print(f'    Vencimiento: {prop.vencimiento_contrato}')
                print(f'    Tipo: {tipo_act.nombre} ({tipo_act.cantidad_meses} meses antes)')
                print(f'    Renovación anterior: {prop.fecha_renovacion}')
                print(f'    Renovación correcta: {fecha_renovacion_correcta}')
                print()
                
                prop.fecha_renovacion = fecha_renovacion_correcta
                session.add(prop)
                actualizaciones += 1
    
    print(f'Total propiedades a actualizar: {actualizaciones}')
    
    if actualizaciones > 0:
        confirmacion = input('\n¿Confirmar corrección de fechas de renovación? (s/N): ')
        if confirmacion.lower() == 's':
            session.commit()
            print('✅ Fechas de renovación corregidas exitosamente!')
        else:
            session.rollback()
            print('❌ Cambios cancelados.')
    else:
        print('No se requieren cambios.')