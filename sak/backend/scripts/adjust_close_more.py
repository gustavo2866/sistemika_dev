#!/usr/bin/env python3
"""
Script para ajustar oportunidades existentes cerrando más para mantener
un nivel parejo de pendientes (~30-35) a lo largo del tiempo.

NO crea nuevas oportunidades, solo modifica las existentes.

Uso:
    python scripts/adjust_close_more.py
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta, UTC
import random

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, create_engine, select
from dotenv import load_dotenv
from app.models.crm_oportunidad import CRMOportunidad
from app.models.crm_oportunidad_log_estado import CRMOportunidadLogEstado
from app.models.user import User
from app.models.crm_catalogos import CRMMotivoPerdida
from app.models.enums import EstadoOportunidad, EstadoPropiedad
from app.models.propiedad import Propiedad

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/sak")

# Meta de pendientes por mes (objetivo: mantener ~25-30)
TARGET_PENDIENTES = 28

# Tasa de pérdida aumentada para mayor cantidad de cierres
TASA_PERDIDA = 0.5  # 50% de los cierres serán perdidas (más realista)


def fecha_cierre_actual(opp):
    """Extrae la fecha de cierre actual de una oportunidad si existe"""
    logs = sorted(opp.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
    for log in logs:
        if log.estado_nuevo in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value):
            return log.fecha_registro.date() if log.fecha_registro else None
    return None


def crear_log_cierre(oportunidad_id: int, estado_anterior: str, estado_nuevo: str, 
                     fecha: datetime, usuario_id: int, observacion: str = None):
    """Crea un registro de log de cierre"""
    return CRMOportunidadLogEstado(
        oportunidad_id=oportunidad_id,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        fecha_registro=fecha,
        usuario_id=usuario_id,
        descripcion=observacion,
    )


def adjust_closures(session: Session):
    """
    Ajusta las oportunidades existentes para mantener un nivel parejo de pendientes.
    """
    print("🚀 Iniciando ajuste de cierres...")
    
    # Obtener datos necesarios
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades = list(session.exec(query).all())
    usuarios = list(session.exec(select(User)).all())
    motivos_perdida = list(session.exec(select(CRMMotivoPerdida)).all())
    
    if not usuarios:
        print("❌ No hay usuarios en la base de datos.")
        return
    
    print(f"\n📊 Estado inicial:")
    print(f"  - Total oportunidades: {len(oportunidades)}")
    
    # Agrupar por mes de creación
    from collections import defaultdict
    por_mes = defaultdict(list)
    
    for opp in oportunidades:
        if not opp.created_at:
            continue
        mes = opp.created_at.strftime("%Y-%m")
        por_mes[mes].append(opp)
    
    print(f"\n📝 Ajustando cierres para mantener ~{TARGET_PENDIENTES} pendientes...")
    print(f"{'Mes':<12} {'Total':>6} {'Cerrar':>7} {'Dejar':>6} {'Nuevas Pend':>12}")
    print("-" * 60)
    
    pendientes_acumuladas = 0
    meses_ordenados = sorted(por_mes.keys())
    
    modificadas = 0
    
    for i, mes in enumerate(meses_ordenados):
        opps_mes = por_mes[mes]
        total_mes = len(opps_mes)
        
        # Calcular cuántas están pendientes y cerradas actualmente en TODA la historia hasta este mes
        todas_hasta_mes = []
        for m in meses_ordenados[:i+1]:
            todas_hasta_mes.extend(por_mes[m])
        
        pendientes_hasta_ahora = sum(1 for opp in todas_hasta_mes
                                     if opp.estado not in [EstadoOportunidad.GANADA.value, 
                                                          EstadoOportunidad.PERDIDA.value])
        
        # Pendientes solo de este mes
        pendientes_este_mes = [opp for opp in opps_mes 
                              if opp.estado not in [EstadoOportunidad.GANADA.value, 
                                                   EstadoOportunidad.PERDIDA.value]]
        
        # Objetivo: mantener pendientes_hasta_ahora cerca de TARGET
        # Ser MUY agresivo cerrando para mantener el nivel bajo y parejo
        if pendientes_hasta_ahora > TARGET_PENDIENTES:
            # Tenemos demasiadas pendientes, cerrar TODO el exceso
            exceso = pendientes_hasta_ahora - TARGET_PENDIENTES
            cerrar_de_este_mes = min(exceso, len(pendientes_este_mes))
        elif pendientes_hasta_ahora > (TARGET_PENDIENTES - 3):
            # Estamos muy cerca del límite, cerrar agresivamente
            cerrar_de_este_mes = max(1, len(pendientes_este_mes) // 2) if len(pendientes_este_mes) > 1 else 0
        else:
            # Estamos bajo el objetivo, dejar crecer un poco
            cerrar_de_este_mes = 0
        
        cerrar_adicionales = max(0, cerrar_de_este_mes)
        dejar_pendientes = len(pendientes_este_mes) - cerrar_adicionales
        
        if cerrar_adicionales > 0:
            # Seleccionar aleatoriamente cuáles cerrar
            opps_a_cerrar = random.sample(pendientes_este_mes, cerrar_adicionales)
            
            for opp in opps_a_cerrar:
                # Decidir si ganada o perdida (50% ganada, 50% perdida para más balance)
                nuevo_estado = EstadoOportunidad.GANADA.value if random.random() > TASA_PERDIDA else EstadoOportunidad.PERDIDA.value
                
                # Fecha de cierre: entre 5 y 45 días después de creación, dentro del periodo
                dias_hasta_cierre = random.randint(5, 45)
                fecha_cierre = opp.created_at + timedelta(days=dias_hasta_cierre)
                
                # No cerrar en el futuro
                hoy = datetime(2025, 11, 25, tzinfo=UTC)
                if fecha_cierre.replace(tzinfo=UTC) > hoy:
                    fecha_cierre = hoy - timedelta(days=random.randint(1, 15))
                
                # Actualizar estado de la oportunidad
                estado_anterior = opp.estado
                opp.estado = nuevo_estado
                opp.fecha_estado = fecha_cierre
                opp.updated_at = fecha_cierre
                
                # Si es perdida, asignar motivo
                if nuevo_estado == EstadoOportunidad.PERDIDA.value and motivos_perdida:
                    opp.motivo_perdida_id = random.choice(motivos_perdida).id
                
                # Crear log de cierre
                usuario = random.choice(usuarios)
                log_cierre = crear_log_cierre(
                    opp.id,
                    estado_anterior,
                    nuevo_estado,
                    fecha_cierre,
                    usuario.id,
                    f"Ajuste: cerrada como {nuevo_estado}"
                )
                session.add(log_cierre)
                session.add(opp)
                
                # Actualizar estado de propiedad si es ganada
                if nuevo_estado == EstadoOportunidad.GANADA.value and opp.propiedad_id:
                    propiedad = session.get(Propiedad, opp.propiedad_id)
                    if propiedad:
                        propiedad.estado = EstadoPropiedad.ALQUILADA.value
                        session.add(propiedad)
                
                modificadas += 1
        
        # Actualizar pendientes acumuladas para el siguiente mes
        pendientes_acumuladas = sum(1 for m in meses_ordenados[:i+2] if m in por_mes
                                   for opp in por_mes[m]
                                   if opp.estado not in [EstadoOportunidad.GANADA.value, 
                                                        EstadoOportunidad.PERDIDA.value])
        
        print(f"{mes:<12} {total_mes:>6} {cerrar_adicionales:>7} {dejar_pendientes:>6} {pendientes_acumuladas:>12}")
    
    session.commit()
    
    print("\n" + "=" * 80)
    print("✅ AJUSTE COMPLETADO")
    print("=" * 80)
    
    # Estadísticas finales
    query = select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))
    oportunidades_final = list(session.exec(query).all())
    
    ganadas = sum(1 for opp in oportunidades_final if opp.estado == EstadoOportunidad.GANADA.value)
    perdidas = sum(1 for opp in oportunidades_final if opp.estado == EstadoOportunidad.PERDIDA.value)
    pendientes = sum(1 for opp in oportunidades_final 
                    if opp.estado not in [EstadoOportunidad.GANADA.value, 
                                         EstadoOportunidad.PERDIDA.value])
    
    print(f"\n📊 Resumen Final:")
    print(f"  - Total oportunidades: {len(oportunidades_final)}")
    print(f"  - Ganadas: {ganadas} ({ganadas/len(oportunidades_final)*100:.1f}%)")
    print(f"  - Perdidas: {perdidas} ({perdidas/len(oportunidades_final)*100:.1f}%)")
    print(f"  - Pendientes: {pendientes} ({pendientes/len(oportunidades_final)*100:.1f}%)")
    print(f"  - Modificadas: {modificadas}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("  AJUSTE DE CIERRES PARA NIVEL PAREJO")
    print("=" * 80 + "\n")
    
    engine = create_engine(DATABASE_URL, echo=False)
    
    with Session(engine) as session:
        adjust_closures(session)
    
    print("✅ Proceso completado exitosamente\n")
