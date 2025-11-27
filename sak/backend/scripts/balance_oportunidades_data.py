#!/usr/bin/env python3
"""
Script para balancear datos de oportunidades con:
- ~30 oportunidades pendientes al inicio (dic 2024)
- Variaciones mensuales con algunos meses con más perdidas que ganadas
- Distribución más realista a lo largo de 2025

Uso:
    python scripts/balance_oportunidades_data.py
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta, UTC
from decimal import Decimal
import random

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, create_engine, select
from dotenv import load_dotenv
from app.models.crm_oportunidad import CRMOportunidad
from app.models.crm_oportunidad_log_estado import CRMOportunidadLogEstado
from app.models.crm_contacto import CRMContacto
from app.models.propiedad import Propiedad
from app.models.user import User
from app.models.crm_catalogos import CRMTipoOperacion, CRMMotivoPerdida, Moneda
from app.models.enums import EstadoOportunidad, EstadoPropiedad

# Cargar variables de entorno
load_dotenv()

# Configuración de la base de datos local
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/sak")

# Plan mensual de distribución (mes: {creadas, ganadas, perdidas})
# Objetivo: empezar con ~30 pendientes y variar mes a mes
PLAN_MENSUAL = {
    "2024-12": {"creadas": 5, "ganadas": 2, "perdidas": 1},   # Base inicial pequeña
    "2025-01": {"creadas": 8, "ganadas": 3, "perdidas": 2},   # Crecimiento moderado
    "2025-02": {"creadas": 10, "ganadas": 2, "perdidas": 5},  # Más perdidas que ganadas
    "2025-03": {"creadas": 12, "ganadas": 4, "perdidas": 3},  # Balance positivo
    "2025-04": {"creadas": 10, "ganadas": 3, "perdidas": 4},  # Más perdidas
    "2025-05": {"creadas": 15, "ganadas": 5, "perdidas": 3},  # Pico de creación
    "2025-06": {"creadas": 8, "ganadas": 2, "perdidas": 6},   # Mes difícil (más perdidas)
    "2025-07": {"creadas": 12, "ganadas": 6, "perdidas": 2},  # Recuperación
    "2025-08": {"creadas": 10, "ganadas": 3, "perdidas": 5},  # Más perdidas
    "2025-09": {"creadas": 14, "ganadas": 5, "perdidas": 4},  # Balance positivo
    "2025-10": {"creadas": 11, "ganadas": 4, "perdidas": 5},  # Más perdidas
    "2025-11": {"creadas": 13, "ganadas": 6, "perdidas": 3},  # Cierre positivo
}

# Mapeo de estado de oportunidad a estado de propiedad
ESTADO_OPP_A_PROPIEDAD = {
    EstadoOportunidad.GANADA.value: EstadoPropiedad.REALIZADA.value,
    EstadoOportunidad.RESERVA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.ABIERTA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.VISITA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.COTIZA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.PERDIDA.value: EstadoPropiedad.DISPONIBLE.value,
}


def generar_fecha_en_mes(year: int, month: int) -> datetime:
    """Genera una fecha aleatoria dentro de un mes específico."""
    # Calcular días en el mes
    if month == 12:
        dias_mes = 31
    else:
        dias_mes = (datetime(year, month + 1, 1) - timedelta(days=1)).day
    
    dia = random.randint(1, dias_mes)
    hora = random.randint(0, 23)
    return datetime(year, month, dia, hora, tzinfo=UTC)


def generar_pipeline_estados(estado_final: str, fecha_creacion: datetime, fecha_estado: datetime, usuario_id: int) -> list:
    """
    Genera la progresión de estados que llevaron al estado final.
    Retorna una lista de tuplos (estado, fecha, observacion).
    """
    pipeline = [
        EstadoOportunidad.ABIERTA.value,
        EstadoOportunidad.VISITA.value,
        EstadoOportunidad.COTIZA.value,
    ]
    
    estados_generados = []
    fecha_actual = fecha_creacion
    delta_total = (fecha_estado - fecha_creacion).total_seconds()
    
    # Si el estado final es GANADA o PERDIDA, pasar por algunos estados intermedios
    if estado_final in [EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value]:
        num_estados = random.randint(1, 2)  # 1-2 estados intermedios
        estados_intermedios = pipeline[:num_estados]
        
        # Distribuir el tiempo entre estados
        tiempo_por_estado = delta_total / (num_estados + 1) if num_estados > 0 else delta_total
        
        for estado in estados_intermedios:
            fecha_actual = fecha_actual + timedelta(seconds=tiempo_por_estado)
            estados_generados.append((estado, fecha_actual, f"Progresión a {estado}"))
    
    # Agregar el estado final
    estados_generados.append((estado_final, fecha_estado, f"Estado final: {estado_final}"))
    
    return estados_generados


def crear_log_estado(
    oportunidad_id: int,
    estado_anterior: str,
    estado_nuevo: str,
    fecha: datetime,
    usuario_id: int,
    observacion: str = None
) -> CRMOportunidadLogEstado:
    """Crea un registro de log de cambio de estado."""
    return CRMOportunidadLogEstado(
        oportunidad_id=oportunidad_id,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        fecha_registro=fecha,
        usuario_id=usuario_id,
        descripcion=observacion,
    )


def actualizar_estado_propiedad(session: Session, propiedad_id: int, estado_oportunidad: str):
    """Actualiza el estado de la propiedad según el estado de la oportunidad."""
    propiedad = session.get(Propiedad, propiedad_id)
    if not propiedad:
        return
    
    nuevo_estado = ESTADO_OPP_A_PROPIEDAD.get(estado_oportunidad)
    if nuevo_estado and propiedad.estado != nuevo_estado:
        propiedad.estado = nuevo_estado
        session.add(propiedad)


def balance_oportunidades(session: Session):
    """
    Balancea los datos con un plan mensual específico.
    """
    print("🚀 Iniciando balance de oportunidades...")
    
    # Obtener datos necesarios
    propiedades = list(session.exec(select(Propiedad)).all())
    contactos = list(session.exec(select(CRMContacto)).all())
    usuarios = list(session.exec(select(User)).all())
    tipos_operacion = list(session.exec(select(CRMTipoOperacion)).all())
    motivos_perdida = list(session.exec(select(CRMMotivoPerdida)).all())
    monedas = list(session.exec(select(Moneda)).all())
    
    if not all([propiedades, contactos, usuarios, tipos_operacion]):
        print("❌ Faltan datos necesarios en la base de datos.")
        return
    
    moneda_usd = next((m for m in monedas if m.codigo == "USD"), None)
    if not moneda_usd and monedas:
        moneda_usd = monedas[0]
    
    print(f"\n📊 Datos disponibles:")
    print(f"  - {len(propiedades)} propiedades")
    print(f"  - {len(contactos)} contactos")
    print(f"  - {len(usuarios)} usuarios")
    
    # Limpiar oportunidades existentes
    print("\n🧹 Limpiando oportunidades existentes...")
    existing_opps = session.exec(select(CRMOportunidad)).all()
    for opp in existing_opps:
        session.delete(opp)
    session.commit()
    print(f"  ✅ {len(existing_opps)} oportunidades eliminadas")
    
    # Restablecer estados de propiedades
    print("\n🔄 Restableciendo estados de propiedades a DISPONIBLE...")
    for prop in propiedades:
        if prop.estado != EstadoPropiedad.DISPONIBLE.value:
            prop.estado = EstadoPropiedad.DISPONIBLE.value
            session.add(prop)
    session.commit()
    
    total_generadas = 0
    total_ganadas = 0
    total_perdidas = 0
    total_abiertas = 0
    
    print(f"\n📝 Generando oportunidades según plan mensual...")
    print(f"{'Mes':<12} {'Creadas':>8} {'Ganadas':>8} {'Perdidas':>9} {'Balance':>9}")
    print("-" * 60)
    
    propiedades_usadas = set()
    
    for mes_str, plan in PLAN_MENSUAL.items():
        year, month = map(int, mes_str.split("-"))
        creadas = plan["creadas"]
        ganadas = plan["ganadas"]
        perdidas = plan["perdidas"]
        abiertas = creadas - ganadas - perdidas
        balance = ganadas - perdidas
        
        print(f"{mes_str:<12} {creadas:>8} {ganadas:>8} {perdidas:>9} {balance:>+9}")
        
        # Generar oportunidades para este mes
        estados_a_generar = (
            [EstadoOportunidad.GANADA.value] * ganadas +
            [EstadoOportunidad.PERDIDA.value] * perdidas +
            [EstadoOportunidad.ABIERTA.value] * (abiertas // 3 if abiertas > 0 else 0) +
            [EstadoOportunidad.VISITA.value] * (abiertas // 3 if abiertas > 0 else 0) +
            [EstadoOportunidad.COTIZA.value] * (abiertas - 2 * (abiertas // 3) if abiertas > 0 else 0)
        )
        
        random.shuffle(estados_a_generar)
        
        for estado in estados_a_generar:
            # Seleccionar propiedad que no esté ganada aún
            propiedad = random.choice([p for p in propiedades if p.id not in propiedades_usadas or estado != EstadoOportunidad.GANADA.value])
            if estado == EstadoOportunidad.GANADA.value:
                propiedades_usadas.add(propiedad.id)
            
            contacto = random.choice(contactos)
            tipo_operacion = random.choice(tipos_operacion)
            responsable = random.choice(usuarios)
            
            # Generar fechas dentro del mes
            fecha_creacion = generar_fecha_en_mes(year, month)
            
            # Fecha de estado: entre 5 y 60 días después de creación
            dias_hasta_estado = random.randint(5, 60)
            fecha_estado = fecha_creacion + timedelta(days=dias_hasta_estado)
            
            # Si es un estado abierto, la fecha_estado es reciente
            if estado in [EstadoOportunidad.ABIERTA.value, EstadoOportunidad.VISITA.value, EstadoOportunidad.COTIZA.value]:
                fecha_estado = min(fecha_estado, datetime(2025, 11, 25, tzinfo=UTC))
            
            # Monto estimado
            monto = Decimal(random.uniform(500, 5000)).quantize(Decimal("0.01"))
            
            # Crear oportunidad
            oportunidad = CRMOportunidad(
                propiedad_id=propiedad.id,
                contacto_id=contacto.id,
                tipo_operacion_id=tipo_operacion.id,
                responsable_id=responsable.id,
                estado=estado,
                fecha_estado=fecha_estado,
                monto=monto,
                moneda_id=moneda_usd.id if moneda_usd else None,
                observaciones=f"Generada - {mes_str} - Estado: {estado}",
                created_at=fecha_creacion,
                updated_at=fecha_estado,
            )
            
            session.add(oportunidad)
            session.flush()
            
            # Generar logs de estado
            log_inicial = crear_log_estado(
                oportunidad.id,
                EstadoOportunidad.ABIERTA.value,
                EstadoOportunidad.ABIERTA.value,
                fecha_creacion,
                responsable.id,
                "Oportunidad creada"
            )
            session.add(log_inicial)
            
            estados_pipeline = generar_pipeline_estados(estado, fecha_creacion, fecha_estado, responsable.id)
            
            estado_anterior = EstadoOportunidad.ABIERTA.value
            for estado_log, fecha_log, observacion in estados_pipeline:
                if estado_log != estado_anterior:
                    log = crear_log_estado(
                        oportunidad.id,
                        estado_anterior,
                        estado_log,
                        fecha_log,
                        responsable.id,
                        observacion
                    )
                    session.add(log)
                    estado_anterior = estado_log
                    
                    # Si es perdida, agregar motivo
                    if estado_log == EstadoOportunidad.PERDIDA.value and motivos_perdida:
                        motivo = random.choice(motivos_perdida)
                        oportunidad.motivo_perdida_id = motivo.id
            
            # Actualizar estado de la propiedad
            actualizar_estado_propiedad(session, propiedad.id, estado)
            
            total_generadas += 1
            if estado == EstadoOportunidad.GANADA.value:
                total_ganadas += 1
            elif estado == EstadoOportunidad.PERDIDA.value:
                total_perdidas += 1
            else:
                total_abiertas += 1
    
    session.commit()
    
    print("\n" + "=" * 80)
    print("✅ BALANCE COMPLETADO")
    print("=" * 80)
    print(f"\n📊 Resumen Total:")
    print(f"  - Total oportunidades generadas: {total_generadas}")
    print(f"  - Oportunidades ganadas: {total_ganadas} ({total_ganadas/total_generadas*100:.1f}%)")
    print(f"  - Oportunidades perdidas: {total_perdidas} ({total_perdidas/total_generadas*100:.1f}%)")
    print(f"  - Oportunidades abiertas: {total_abiertas} ({total_abiertas/total_generadas*100:.1f}%)")
    print(f"\n💡 Balance neto (ganadas - perdidas): {total_ganadas - total_perdidas:+d}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("  BALANCE DE DATOS DE OPORTUNIDADES")
    print("=" * 80 + "\n")
    
    engine = create_engine(DATABASE_URL, echo=False)
    
    with Session(engine) as session:
        balance_oportunidades(session)
    
    print("✅ Proceso completado exitosamente\n")
