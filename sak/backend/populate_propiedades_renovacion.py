"""
Script para poblar los nuevos campos de propiedades (solo propiedades de alquiler)
- propietario_id (FK aleatoria)
- tipo_actualizacion_id (FK aleatoria)  
- fecha_renovacion (calculada basada en datos existentes)
"""

import sys
from pathlib import Path
import random
from datetime import date, timedelta
from calendar import monthrange

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import Session, create_engine, select
from dotenv import load_dotenv
import os

from app.models.propiedad import Propiedad
from app.models.propietario import Propietario
from app.models.tipo_actualizacion import TipoActualizacion

# Cargar variables de entorno
load_dotenv()

# Configurar conexión a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada")

engine = create_engine(DATABASE_URL)


def add_months(start_date: date, months: int) -> date:
    """
    Agrega meses a una fecha manejando correctamente los cambios de año y días del mes.
    """
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    
    # Manejar casos donde el día no existe en el nuevo mes (ej: 31 de enero + 1 mes = 28/29 de febrero)
    day = min(start_date.day, monthrange(year, month)[1])
    
    return date(year, month, day)


def calcular_fecha_renovacion(propiedad: Propiedad, meses_tipo_actualizacion: int) -> date:
    """
    Calcula la fecha de renovación basada en los datos de la propiedad.
    
    Lógica:
    1. Si tiene vencimiento_contrato: usar esa fecha + período de actualización
    2. Si no tiene vencimiento pero sí fecha_inicio_contrato: usar fecha_inicio_contrato + 12 meses + período
    3. Si no tiene ninguna fecha: usar fecha actual + período
    """
    
    if propiedad.vencimiento_contrato:
        # Usar vencimiento del contrato actual + período de actualización
        base_date = propiedad.vencimiento_contrato
        fecha_renovacion = add_months(base_date, meses_tipo_actualizacion)
    elif propiedad.fecha_inicio_contrato:
        # Usar fecha de inicio del contrato + 12 meses (asumir contrato anual) + período
        base_date = add_months(propiedad.fecha_inicio_contrato, 12)
        fecha_renovacion = add_months(base_date, meses_tipo_actualizacion)
    else:
        # Usar fecha actual + período de actualización
        base_date = date.today()
        fecha_renovacion = add_months(base_date, meses_tipo_actualizacion)
    
    return fecha_renovacion


def main():
    """Función principal para poblar campos de renovación en propiedades de alquiler"""
    print("🏠 Iniciando población de campos de renovación en propiedades...")
    
    propiedades_actualizadas = 0
    propiedades_omitidas = 0
    
    try:
        with Session(engine) as session:
            # Obtener propietarios activos
            propietarios_activos = session.exec(
                select(Propietario).where(Propietario.activo == True)
            ).all()
            
            # Obtener tipos de actualización
            tipos_actualizacion = session.exec(select(TipoActualizacion)).all()
            
            # Obtener propiedades de alquiler que no tienen los campos poblados
            propiedades_alquiler = session.exec(
                select(Propiedad).where(
                    Propiedad.tipo_operacion_id == 1  # Alquiler
                )
            ).all()
            
            print(f"📊 Datos disponibles:")
            print(f"   - Propietarios activos: {len(propietarios_activos)}")
            print(f"   - Tipos de actualización: {len(tipos_actualizacion)}")
            print(f"   - Propiedades de alquiler: {len(propiedades_alquiler)}")
            print()
            
            if not propietarios_activos or not tipos_actualizacion:
                print("❌ No hay suficientes datos para poblar las propiedades")
                return
            
            for propiedad in propiedades_alquiler:
                # Verificar si ya tiene los campos poblados (para evitar duplicados)
                if (propiedad.propietario_id is not None or 
                    propiedad.tipo_actualizacion_id is not None or 
                    propiedad.fecha_renovacion is not None):
                    print(f"⚠️  '{propiedad.nombre}' ya tiene campos poblados, omitiendo...")
                    propiedades_omitidas += 1
                    continue
                
                # Asignar propietario aleatorio
                propietario_aleatorio = random.choice(propietarios_activos)
                propiedad.propietario_id = propietario_aleatorio.id
                
                # Asignar tipo de actualización aleatorio
                tipo_actualizacion_aleatorio = random.choice(tipos_actualizacion)
                propiedad.tipo_actualizacion_id = tipo_actualizacion_aleatorio.id
                
                # Calcular fecha de renovación
                propiedad.fecha_renovacion = calcular_fecha_renovacion(
                    propiedad, 
                    tipo_actualizacion_aleatorio.cantidad_meses
                )
                
                session.add(propiedad)
                propiedades_actualizadas += 1
                
                print(f"✅ {propiedad.nombre}")
                print(f"   Propietario: {propietario_aleatorio.nombre}")
                print(f"   Tipo actualización: {tipo_actualizacion_aleatorio.nombre}")
                print(f"   Fecha renovación: {propiedad.fecha_renovacion}")
                print(f"   Basado en: {'vencimiento_contrato' if propiedad.vencimiento_contrato else 'fecha_inicio_contrato' if propiedad.fecha_inicio_contrato else 'fecha_actual'}")
                print()
            
            # Confirmar cambios
            session.commit()
            
            print(f"🎉 Proceso completado:")
            print(f"   - Propiedades actualizadas: {propiedades_actualizadas}")
            print(f"   - Propiedades omitidas: {propiedades_omitidas}")
            
            # Estadísticas finales
            propiedades_con_renovacion = session.exec(
                select(Propiedad).where(
                    Propiedad.tipo_operacion_id == 1,
                    Propiedad.propietario_id.is_not(None),
                    Propiedad.tipo_actualizacion_id.is_not(None),
                    Propiedad.fecha_renovacion.is_not(None)
                )
            ).all()
            
            print(f"   - Total propiedades de alquiler con datos de renovación: {len(propiedades_con_renovacion)}")
            
            # Mostrar distribución por tipo de actualización
            distribucion = {}
            for prop in propiedades_con_renovacion:
                tipo_id = prop.tipo_actualizacion_id
                if tipo_id not in distribucion:
                    distribucion[tipo_id] = 0
                distribucion[tipo_id] += 1
            
            print(f"\n📈 Distribución por tipo de actualización:")
            for tipo in tipos_actualizacion:
                cantidad = distribucion.get(tipo.id, 0)
                print(f"   - {tipo.nombre}: {cantidad} propiedades")
            
    except Exception as e:
        print(f"❌ Error durante la población: {e}")
        raise


if __name__ == "__main__":
    main()