"""
Script para actualizar fecha_inicio_contrato de forma consistente 
en propiedades de alquiler
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

# Cargar variables de entorno
load_dotenv()

# Configurar conexión a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada")

engine = create_engine(DATABASE_URL)


def add_months(start_date: date, months: int) -> date:
    """
    Agrega meses a una fecha (puede ser negativo para restar).
    """
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    
    # Manejar casos donde el día no existe en el nuevo mes
    day = min(start_date.day, monthrange(year, month)[1])
    
    return date(year, month, day)


def calcular_fecha_inicio_consistente(propiedad: Propiedad) -> date:
    """
    Calcula fecha_inicio_contrato de forma consistente.
    
    Lógica:
    1. Si tiene vencimiento_contrato: vencimiento - 12 meses (contrato anual estándar)
    2. Si no tiene vencimiento: fecha aleatoria en últimos 2 años
    """
    
    if propiedad.vencimiento_contrato:
        # Calcular inicio como vencimiento - 12 meses
        fecha_inicio = add_months(propiedad.vencimiento_contrato, -12)
    else:
        # Generar fecha aleatoria en los últimos 2 años
        fecha_actual = date.today()
        dias_atras = random.randint(30, 730)  # Entre 1 mes y 2 años
        fecha_inicio = fecha_actual - timedelta(days=dias_atras)
    
    return fecha_inicio


def main():
    """Función principal para actualizar fechas de inicio de contrato"""
    print("📅 Iniciando actualización de fecha_inicio_contrato para alquileres...")
    
    propiedades_actualizadas = 0
    propiedades_omitidas = 0
    
    try:
        with Session(engine) as session:
            # Obtener propiedades de alquiler
            propiedades_alquiler = session.exec(
                select(Propiedad).where(Propiedad.tipo_operacion_id == 1)
            ).all()
            
            print(f"📊 Propiedades de alquiler encontradas: {len(propiedades_alquiler)}")
            print()
            
            for propiedad in propiedades_alquiler:
                fecha_inicio_actual = propiedad.fecha_inicio_contrato
                
                # Calcular nueva fecha de inicio consistente
                nueva_fecha_inicio = calcular_fecha_inicio_consistente(propiedad)
                
                # Actualizar si no tiene fecha o si queremos forzar actualización
                actualizar = False
                razon = ""
                
                if not fecha_inicio_actual:
                    actualizar = True
                    razon = "sin fecha inicial"
                elif propiedad.vencimiento_contrato:
                    # Verificar si la fecha actual es consistente (dentro de ±30 días de lo esperado)
                    fecha_esperada = add_months(propiedad.vencimiento_contrato, -12)
                    diferencia_dias = abs((fecha_inicio_actual - fecha_esperada).days)
                    
                    if diferencia_dias > 30:  # Más de 30 días de diferencia
                        actualizar = True
                        razon = f"inconsistente (diferencia: {diferencia_dias} días)"
                
                if actualizar:
                    propiedad.fecha_inicio_contrato = nueva_fecha_inicio
                    session.add(propiedad)
                    propiedades_actualizadas += 1
                    
                    metodo = "basado en vencimiento" if propiedad.vencimiento_contrato else "fecha aleatoria"
                    print(f"✅ {propiedad.nombre}")
                    print(f"   Fecha anterior: {fecha_inicio_actual}")
                    print(f"   Fecha nueva: {nueva_fecha_inicio}")
                    print(f"   Vencimiento: {propiedad.vencimiento_contrato}")
                    print(f"   Razón: {razon}")
                    print(f"   Método: {metodo}")
                    print()
                else:
                    propiedades_omitidas += 1
                    if propiedades_omitidas <= 3:  # Mostrar solo los primeros 3
                        print(f"⚠️  {propiedad.nombre} - fecha ya consistente ({fecha_inicio_actual})")
            
            # Confirmar cambios
            session.commit()
            
            print(f"🎉 Proceso completado:")
            print(f"   - Propiedades actualizadas: {propiedades_actualizadas}")
            print(f"   - Propiedades omitidas (ya consistentes): {propiedades_omitidas}")
            
            # Verificación final
            propiedades_con_fecha = session.exec(
                select(Propiedad).where(
                    Propiedad.tipo_operacion_id == 1,
                    Propiedad.fecha_inicio_contrato.is_not(None)
                )
            ).all()
            
            print(f"   - Total alquileres con fecha_inicio_contrato: {len(propiedades_con_fecha)}")
            
            # Verificar consistencia
            inconsistentes = 0
            for prop in propiedades_con_fecha:
                if prop.vencimiento_contrato and prop.fecha_inicio_contrato:
                    diferencia = (prop.vencimiento_contrato - prop.fecha_inicio_contrato).days
                    if abs(diferencia - 365) > 30:  # Debería ser ~365 días ±30
                        inconsistentes += 1
            
            print(f"   - Propiedades potencialmente inconsistentes: {inconsistentes}")
            
    except Exception as e:
        print(f"❌ Error durante la actualización: {e}")
        raise


if __name__ == "__main__":
    main()