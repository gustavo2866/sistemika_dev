from sqlmodel import Session, create_engine, select
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.tipo_actualizacion import TipoActualizacion
from datetime import date
import os
from dotenv import load_dotenv

# Configuración
load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))

print('VERIFICACIÓN DE FECHAS DE RENOVACIÓN CORREGIDAS')
print('=' * 60)

with Session(engine) as session:
    # Obtener estado realizada
    estado_realizada = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    
    # Obtener propiedades realizadas de alquiler
    propiedades = session.exec(
        select(Propiedad).where(
            Propiedad.tipo_operacion_id == 1,
            Propiedad.propiedad_status_id == estado_realizada.id,
            Propiedad.tipo_actualizacion_id.is_not(None),
            Propiedad.vencimiento_contrato.is_not(None),
            Propiedad.fecha_renovacion.is_not(None)
        )
    ).all()
    
    print(f'Propiedades a verificar: {len(propiedades)}')
    print()
    
    correctas = 0
    incorrectas = 0
    
    for prop in propiedades:
        tipo_act = session.get(TipoActualizacion, prop.tipo_actualizacion_id)
        
        if tipo_act:
            # Verificar que la fecha de renovación sea ANTERIOR al vencimiento
            es_anterior = prop.fecha_renovacion < prop.vencimiento_contrato
            
            # Calcular diferencia en días (debería ser aproximadamente la cantidad de meses del tipo)
            diferencia_dias = (prop.vencimiento_contrato - prop.fecha_renovacion).days
            dias_esperados = tipo_act.cantidad_meses * 30  # Aproximado
            diferencia_permitida = abs(diferencia_dias - dias_esperados)
            
            if es_anterior and diferencia_permitida <= 60:  # Tolerancia de 2 meses
                correctas += 1
            else:
                incorrectas += 1
                print(f'❌ {prop.nombre}:')
                print(f'   Renovación: {prop.fecha_renovacion}')
                print(f'   Vencimiento: {prop.vencimiento_contrato}')
                print(f'   Tipo: {tipo_act.nombre} ({tipo_act.cantidad_meses} meses)')
                print(f'   Diferencia: {diferencia_dias} días (esperado: ~{dias_esperados})')
                print()
    
    print(f'RESULTADOS:')
    print(f'✅ Fechas correctas: {correctas}')
    print(f'❌ Fechas incorrectas: {incorrectas}')
    print(f'📊 Porcentaje de éxito: {(correctas/(correctas+incorrectas)*100):.1f}%')
    
    if correctas > 0:
        print(f'\\nEJEMPLOS DE FECHAS CORRECTAS:')
        count = 0
        for prop in propiedades:
            if count >= 3:
                break
            tipo_act = session.get(TipoActualizacion, prop.tipo_actualizacion_id)
            if tipo_act and prop.fecha_renovacion < prop.vencimiento_contrato:
                diferencia_dias = (prop.vencimiento_contrato - prop.fecha_renovacion).days
                print(f'  ✅ {prop.nombre}:')
                print(f'     Renovación: {prop.fecha_renovacion}')
                print(f'     Vencimiento: {prop.vencimiento_contrato}')
                print(f'     Tipo: {tipo_act.nombre} ({diferencia_dias} días antes)')
                print()
                count += 1