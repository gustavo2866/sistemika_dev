from sqlmodel import Session, create_engine, select
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.tipo_actualizacion import TipoActualizacion
from datetime import date
import os
from dotenv import load_dotenv
from calendar import monthrange

def add_months(start_date, months):
    """Agregar meses a una fecha"""
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, monthrange(year, month)[1])
    return date(year, month, day)

# Configuración
load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))

with Session(engine) as session:
    # Obtener propiedades realizadas con tipo_actualizacion
    estado_realizada = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    
    propiedades_realizadas = session.exec(
        select(Propiedad).where(
            Propiedad.tipo_operacion_id == 1,
            Propiedad.propiedad_status_id == estado_realizada.id,
            Propiedad.tipo_actualizacion_id.is_not(None),
            Propiedad.fecha_renovacion.is_not(None)
        )
    ).all()
    
    print('ANALISIS DE CONSISTENCIA FECHA_RENOVACION:')
    print('=' * 60)
    print(f'Propiedades realizadas con tipo_actualizacion: {len(propiedades_realizadas)}')
    
    inconsistentes = []
    
    for prop in propiedades_realizadas:
        tipo_act = session.get(TipoActualizacion, prop.tipo_actualizacion_id)
        
        if prop.vencimiento_contrato and tipo_act:
            # Calcular fecha esperada basada en vencimiento + meses del tipo
            fecha_esperada = add_months(prop.vencimiento_contrato, tipo_act.cantidad_meses)
            diferencia_dias = abs((prop.fecha_renovacion - fecha_esperada).days)
            
            if diferencia_dias > 7:  # Tolerancia de 7 días
                inconsistentes.append({
                    'propiedad': prop.nombre,
                    'vencimiento': prop.vencimiento_contrato,
                    'tipo': tipo_act.nombre,
                    'meses': tipo_act.cantidad_meses,
                    'fecha_renovacion_actual': prop.fecha_renovacion,
                    'fecha_esperada': fecha_esperada,
                    'diferencia': diferencia_dias
                })
    
    print(f'Propiedades con fechas inconsistentes: {len(inconsistentes)}')
    
    if inconsistentes:
        print('\nEjemplos de inconsistencias:')
        for inc in inconsistentes[:5]:
            print(f'  - {inc["propiedad"]}:')
            print(f'    Vence: {inc["vencimiento"]}')
            print(f'    Tipo: {inc["tipo"]} ({inc["meses"]} meses)')
            print(f'    Renovacion actual: {inc["fecha_renovacion_actual"]}')
            print(f'    Renovacion esperada: {inc["fecha_esperada"]}')
            print(f'    Diferencia: {inc["diferencia"]} dias')
            print()
    
    # Ahora revisar contratos vencidos
    print('ANALISIS DE CONTRATOS VENCIDOS:')
    print('=' * 60)
    
    hoy = date.today()
    
    propiedades_todas = session.exec(
        select(Propiedad).where(
            Propiedad.tipo_operacion_id == 1,
            Propiedad.propiedad_status_id == estado_realizada.id,
            Propiedad.vencimiento_contrato.is_not(None)
        )
    ).all()
    
    vencidos = []
    for prop in propiedades_todas:
        dias_vencido = (hoy - prop.vencimiento_contrato).days
        if dias_vencido > 0:
            vencidos.append({
                'propiedad': prop.nombre,
                'vencimiento': prop.vencimiento_contrato,
                'dias_vencido': dias_vencido
            })
    
    print(f'Total propiedades realizadas: {len(propiedades_todas)}')
    print(f'Propiedades con contrato vencido: {len(vencidos)}')
    
    if vencidos:
        print('\nEjemplos de contratos vencidos:')
        for venc in sorted(vencidos, key=lambda x: x['dias_vencido'], reverse=True)[:5]:
            print(f'  - {venc["propiedad"]}: Vencido hace {venc["dias_vencido"]} días ({venc["vencimiento"]})')