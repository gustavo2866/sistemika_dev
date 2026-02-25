from sqlmodel import Session, create_engine, select
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.tipo_actualizacion import TipoActualizacion
from datetime import date, timedelta
import os
from dotenv import load_dotenv
from calendar import monthrange
import random

def add_months(start_date, months):
    """Agregar meses a una fecha"""
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, monthrange(year, month)[1])
    return date(year, month, day)

def generar_fecha_futura():
    """Generar una fecha de vencimiento futura (entre 6 meses y 2 años)"""
    hoy = date.today()
    dias_futuros = random.randint(180, 730)  # Entre 6 meses y 2 años
    return hoy + timedelta(days=dias_futuros)

# Configuración
load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))

print('CORRIGIENDO PROPIEDADES REALIZADAS DE ALQUILER')
print('=' * 60)

with Session(engine) as session:
    # Obtener estado realizada
    estado_realizada = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    
    print(f'Estado realizada ID: {estado_realizada.id}')
    
    # Obtener todas las propiedades realizadas de alquiler
    propiedades_realizadas = session.exec(
        select(Propiedad).where(
            Propiedad.tipo_operacion_id == 1,
            Propiedad.propiedad_status_id == estado_realizada.id
        )
    ).all()
    
    print(f'Total propiedades realizadas de alquiler: {len(propiedades_realizadas)}')
    
    hoy = date.today()
    contratos_vencidos = 0
    fechas_inconsistentes = 0
    actualizaciones = 0
    
    for prop in propiedades_realizadas:
        actualizar_propiedad = False
        
        # 1. Verificar si el contrato está vencido
        if prop.vencimiento_contrato and prop.vencimiento_contrato < hoy:
            # Generar nueva fecha de vencimiento futura
            prop.vencimiento_contrato = generar_fecha_futura()
            contratos_vencidos += 1
            actualizar_propiedad = True
            print(f'  - {prop.nombre}: Nuevo vencimiento -> {prop.vencimiento_contrato}')
        
        # 2. Si no tiene fecha de vencimiento, asignar una
        elif not prop.vencimiento_contrato:
            prop.vencimiento_contrato = generar_fecha_futura()
            actualizar_propiedad = True
            print(f'  - {prop.nombre}: Asignando vencimiento -> {prop.vencimiento_contrato}')
        
        # 3. Verificar consistencia de fecha_renovacion con tipo_actualizacion
        if prop.tipo_actualizacion_id and prop.vencimiento_contrato:
            tipo_act = session.get(TipoActualizacion, prop.tipo_actualizacion_id)
            if tipo_act:
                fecha_renovacion_esperada = add_months(prop.vencimiento_contrato, tipo_act.cantidad_meses)
                
                if not prop.fecha_renovacion or abs((prop.fecha_renovacion - fecha_renovacion_esperada).days) > 7:
                    prop.fecha_renovacion = fecha_renovacion_esperada
                    fechas_inconsistentes += 1
                    actualizar_propiedad = True
                    print(f'  - {prop.nombre}: Nueva fecha renovación -> {prop.fecha_renovacion} ({tipo_act.nombre})')
        
        # Actualizar si hubo cambios
        if actualizar_propiedad:
            session.add(prop)
            actualizaciones += 1
    
    # Confirmar cambios
    print(f'\\nRESUMEN DE CAMBIOS:')
    print(f'- Contratos vencidos corregidos: {contratos_vencidos}')
    print(f'- Fechas de renovación inconsistentes corregidas: {fechas_inconsistentes}')
    print(f'- Total propiedades actualizadas: {actualizaciones}')
    
    if actualizaciones > 0:
        confirmacion = input(f'\\n¿Confirmar los cambios? (s/N): ')
        if confirmacion.lower() == 's':
            session.commit()
            print('✅ Cambios guardados exitosamente!')
        else:
            session.rollback()
            print('❌ Cambios cancelados.')
    else:
        print('No se requieren cambios.')