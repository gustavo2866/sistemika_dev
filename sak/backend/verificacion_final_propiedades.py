from sqlmodel import Session, create_engine, select
from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.tipo_actualizacion import TipoActualizacion
from app.models.propietario import Propietario
from datetime import date
import os
from dotenv import load_dotenv

# Configuración
load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))

print('VERIFICACION FINAL DE PROPIEDADES REALIZADAS DE ALQUILER')
print('=' * 70)

with Session(engine) as session:
    # Obtener estado realizada
    estado_realizada = session.exec(
        select(PropiedadesStatus).where(PropiedadesStatus.orden == 4)
    ).first()
    
    # Obtener todas las propiedades realizadas de alquiler con sus relaciones
    propiedades_realizadas = session.exec(
        select(Propiedad).where(
            Propiedad.tipo_operacion_id == 1,
            Propiedad.propiedad_status_id == estado_realizada.id
        )
    ).all()
    
    hoy = date.today()
    
    print(f'Total propiedades realizadas de alquiler: {len(propiedades_realizadas)}')
    print()
    
    # Verificaciones
    con_vencimiento = 0
    vencimientos_futuros = 0
    con_propietario = 0
    con_tipo_actualizacion = 0
    con_fecha_renovacion = 0
    con_fecha_inicio_contrato = 0
    
    problemas = []
    
    for prop in propiedades_realizadas:
        # Verificar campos obligatorios para propiedades realizadas
        if prop.vencimiento_contrato:
            con_vencimiento += 1
            if prop.vencimiento_contrato > hoy:
                vencimientos_futuros += 1
            else:
                problemas.append(f'{prop.nombre}: Contrato vencido ({prop.vencimiento_contrato})')
        else:
            problemas.append(f'{prop.nombre}: Sin fecha de vencimiento')
        
        if prop.propietario_id:
            con_propietario += 1
        else:
            problemas.append(f'{prop.nombre}: Sin propietario asignado')
        
        if prop.tipo_actualizacion_id:
            con_tipo_actualizacion += 1
        else:
            problemas.append(f'{prop.nombre}: Sin tipo de actualización')
        
        if prop.fecha_renovacion:
            con_fecha_renovacion += 1
        else:
            problemas.append(f'{prop.nombre}: Sin fecha de renovación')
        
        if prop.fecha_inicio_contrato:
            con_fecha_inicio_contrato += 1
        else:
            problemas.append(f'{prop.nombre}: Sin fecha de inicio de contrato')
    
    # Mostrar estadísticas
    print('ESTADÍSTICAS DE COMPLETITUD:')
    print('-' * 40)
    print(f'Propiedades con vencimiento contrato: {con_vencimiento}/{len(propiedades_realizadas)} ({(con_vencimiento/len(propiedades_realizadas)*100):.1f}%)')
    print(f'Vencimientos en el futuro: {vencimientos_futuros}/{con_vencimiento} ({(vencimientos_futuros/con_vencimiento*100) if con_vencimiento > 0 else 0:.1f}%)')
    print(f'Propiedades con propietario: {con_propietario}/{len(propiedades_realizadas)} ({(con_propietario/len(propiedades_realizadas)*100):.1f}%)')
    print(f'Propiedades con tipo actualización: {con_tipo_actualizacion}/{len(propiedades_realizadas)} ({(con_tipo_actualizacion/len(propiedades_realizadas)*100):.1f}%)')
    print(f'Propiedades con fecha renovación: {con_fecha_renovacion}/{len(propiedades_realizadas)} ({(con_fecha_renovacion/len(propiedades_realizadas)*100):.1f}%)')
    print(f'Propiedades con fecha inicio contrato: {con_fecha_inicio_contrato}/{len(propiedades_realizadas)} ({(con_fecha_inicio_contrato/len(propiedades_realizadas)*100):.1f}%)')
    
    # Mostrar problemas si los hay
    if problemas:
        print(f'\\nPROBLEMAS ENCONTRADOS ({len(problemas)}):')
        print('-' * 40)
        for problema in problemas[:10]:  # Mostrar máximo 10
            print(f'⚠️  {problema}')
        if len(problemas) > 10:
            print(f'... y {len(problemas) - 10} más')
    else:
        print(f'\\n✅ NO SE ENCONTRARON PROBLEMAS')
    
    # Muestra de propiedades exitosas
    print(f'\\nMUESTRA DE PROPIEDADES CORRECTAS:')
    print('-' * 40)
    
    count = 0
    for prop in propiedades_realizadas:
        if (prop.vencimiento_contrato and prop.vencimiento_contrato > hoy and 
            prop.propietario_id and prop.tipo_actualizacion_id and 
            prop.fecha_renovacion and prop.fecha_inicio_contrato):
            
            # Obtener datos relacionados
            propietario = session.get(Propietario, prop.propietario_id)
            tipo_act = session.get(TipoActualizacion, prop.tipo_actualizacion_id)
            
            dias_hasta_vencimiento = (prop.vencimiento_contrato - hoy).days
            
            print(f'  {prop.nombre}:')
            print(f'    📅 Vence: {prop.vencimiento_contrato} (en {dias_hasta_vencimiento} días)')
            print(f'    🏠 Propietario: {propietario.nombre if propietario else "N/A"}')
            print(f'    🔄 Tipo: {tipo_act.nombre if tipo_act else "N/A"} → Próxima renovación: {prop.fecha_renovacion}')
            print(f'    📆 Inicio contrato: {prop.fecha_inicio_contrato}')
            print()
            
            count += 1
            if count >= 3:  # Solo mostrar 3 ejemplos
                break