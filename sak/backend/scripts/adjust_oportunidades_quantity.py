#!/usr/bin/env python3
"""
Script para ajustar las cantidades de oportunidades a proporciones más realistas.

En lugar de 15 oportunidades por propiedad (1,500 totales), genera:
- 2-3 oportunidades por propiedad (200-300 totales)
- Distribución más equilibrada de creación vs cierre

Uso:
    python scripts/adjust_oportunidades_quantity.py
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

# Estados ajustados para más cierres
ESTADOS_PROBABILIDADES = [
    (EstadoOportunidad.ABIERTA.value, 20),      # 20% abierta
    (EstadoOportunidad.VISITA.value, 15),       # 15% visita
    (EstadoOportunidad.COTIZA.value, 10),       # 10% cotiza
    (EstadoOportunidad.RESERVA.value, 5),       # 5% reserva
    (EstadoOportunidad.GANADA.value, 30),       # 30% ganada (aumentado)
    (EstadoOportunidad.PERDIDA.value, 20),      # 20% perdida (aumentado)
]

# Motivos de pérdida más comunes
MOTIVOS_PERDIDA_NOMBRES = [
    "Precio muy alto",
    "Eligió otra propiedad",
    "No cumple requisitos",
    "Cambió de opinión",
    "Problemas de financiamiento",
]

# Mapeo de estado de oportunidad a estado de propiedad
ESTADO_OPP_A_PROPIEDAD = {
    EstadoOportunidad.GANADA.value: EstadoPropiedad.REALIZADA.value,
    EstadoOportunidad.RESERVA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.ABIERTA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.VISITA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.COTIZA.value: EstadoPropiedad.DISPONIBLE.value,
    EstadoOportunidad.PERDIDA.value: EstadoPropiedad.DISPONIBLE.value,
}


def generar_fecha_aleatoria(desde: datetime, hasta: datetime) -> datetime:
    """Genera una fecha aleatoria entre dos fechas."""
    delta = hasta - desde
    dias_aleatorios = random.randint(0, delta.days)
    horas_aleatorias = random.randint(0, 23)
    return desde + timedelta(days=dias_aleatorios, hours=horas_aleatorias)


def seleccionar_estado_aleatorio() -> str:
    """Selecciona un estado basado en las probabilidades definidas."""
    estados, pesos = zip(*ESTADOS_PROBABILIDADES)
    return random.choices(estados, weights=pesos, k=1)[0]


def generar_pipeline_estados(estado_final: str, fecha_creacion: datetime, fecha_estado: datetime, usuario_id: int) -> list:
    """
    Genera la progresión de estados que llevaron al estado final.
    
    Retorna una lista de tuplos (estado, fecha, observacion) ordenados cronológicamente.
    """
    # Estados del pipeline en orden
    pipeline = [
        EstadoOportunidad.ABIERTA.value,
        EstadoOportunidad.VISITA.value,
        EstadoOportunidad.COTIZA.value,
        EstadoOportunidad.RESERVA.value,
    ]
    
    estados_generados = []
    fecha_actual = fecha_creacion
    delta_total = (fecha_estado - fecha_creacion).total_seconds()
    
    # Si el estado final es GANADA o PERDIDA, pasar por algunos estados intermedios
    if estado_final in [EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value]:
        # Determinar cuántos estados intermedios (1-3)
        num_estados = random.randint(1, min(3, len(pipeline)))
        estados_intermedios = pipeline[:num_estados]
        
        # Distribuir el tiempo entre estados
        tiempo_por_estado = delta_total / (num_estados + 1)
        
        for i, estado in enumerate(estados_intermedios):
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


def populate_oportunidades(session: Session):
    """
    Puebla la base de datos con oportunidades ajustadas.
    
    Genera 2-3 oportunidades por propiedad para un total más manejable.
    """
    print("🚀 Iniciando ajuste de oportunidades...")
    
    # Obtener datos necesarios
    propiedades = list(session.exec(select(Propiedad)).all())
    contactos = list(session.exec(select(CRMContacto)).all())
    usuarios = list(session.exec(select(User)).all())
    tipos_operacion = list(session.exec(select(CRMTipoOperacion)).all())
    motivos_perdida = list(session.exec(select(CRMMotivoPerdida)).all())
    monedas = list(session.exec(select(Moneda)).all())
    
    if not propiedades:
        print("❌ No hay propiedades en la base de datos.")
        return
    
    if not contactos:
        print("❌ No hay contactos en la base de datos.")
        return
    
    if not usuarios:
        print("❌ No hay usuarios en la base de datos.")
        return
    
    if not tipos_operacion:
        print("❌ No hay tipos de operación en la base de datos.")
        return
    
    # Buscar o crear moneda USD
    moneda_usd = next((m for m in monedas if m.codigo == "USD"), None)
    if not moneda_usd and monedas:
        moneda_usd = monedas[0]
    
    print(f"\n📊 Datos disponibles:")
    print(f"  - {len(propiedades)} propiedades")
    print(f"  - {len(contactos)} contactos")
    print(f"  - {len(usuarios)} usuarios")
    print(f"  - {len(tipos_operacion)} tipos de operación")
    print(f"  - {len(motivos_perdida)} motivos de pérdida")
    
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
    
    # Fecha de inicio: hace 2 años desde hoy
    hoy = datetime(2025, 11, 25, tzinfo=UTC)
    fecha_inicio = hoy - timedelta(days=730)
    fecha_fin = hoy
    
    total_generadas = 0
    total_ganadas = 0
    total_perdidas = 0
    total_abiertas = 0
    
    print(f"\n📝 Generando 2-3 oportunidades por propiedad...")
    print(f"📅 Periodo: {fecha_inicio.date()} a {fecha_fin.date()}")
    
    for propiedad in propiedades:
        # Decidir cuántas oportunidades generar para esta propiedad (2 o 3)
        cantidad = random.randint(2, 3)
        
        for i in range(cantidad):
            # Seleccionar datos aleatorios
            contacto = random.choice(contactos)
            tipo_operacion = random.choice(tipos_operacion)
            responsable = random.choice(usuarios)
            estado = seleccionar_estado_aleatorio()
            
            # Generar fechas
            fecha_creacion = generar_fecha_aleatoria(fecha_inicio, fecha_fin)
            
            # La fecha de estado es posterior a la creación (entre 1 y 90 días después)
            dias_hasta_estado = random.randint(1, 90)
            fecha_estado = fecha_creacion + timedelta(days=dias_hasta_estado)
            
            # Si la fecha de estado es futura, ajustar al presente
            if fecha_estado > hoy:
                fecha_estado = hoy
            
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
                observaciones=f"Oportunidad generada automáticamente - Estado: {estado}",
                created_at=fecha_creacion,
                updated_at=fecha_estado,
            )
            
            session.add(oportunidad)
            session.flush()
            
            # Generar logs de estado
            estados_pipeline = generar_pipeline_estados(estado, fecha_creacion, fecha_estado, responsable.id)
            
            # Primer log: creación (abierta)
            log_inicial = crear_log_estado(
                oportunidad.id,
                EstadoOportunidad.ABIERTA.value,  # estado_anterior no puede ser NULL
                EstadoOportunidad.ABIERTA.value,
                fecha_creacion,
                responsable.id,
                "Oportunidad creada"
            )
            session.add(log_inicial)
            
            estado_anterior = EstadoOportunidad.ABIERTA.value
            for estado_log, fecha_log, observacion in estados_pipeline:
                # Solo crear log si el estado es diferente al anterior
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
    print("✅ POBLACIÓN COMPLETADA")
    print("=" * 80)
    print(f"\n📊 Resumen:")
    print(f"  - Total oportunidades generadas: {total_generadas}")
    print(f"  - Oportunidades ganadas: {total_ganadas} ({total_ganadas/total_generadas*100:.1f}%)")
    print(f"  - Oportunidades perdidas: {total_perdidas} ({total_perdidas/total_generadas*100:.1f}%)")
    print(f"  - Oportunidades abiertas: {total_abiertas} ({total_abiertas/total_generadas*100:.1f}%)")
    print(f"  - Promedio por propiedad: {total_generadas/len(propiedades):.1f}")
    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("  AJUSTE DE CANTIDADES DE OPORTUNIDADES")
    print("=" * 80 + "\n")
    
    engine = create_engine(DATABASE_URL, echo=False)
    
    with Session(engine) as session:
        populate_oportunidades(session)
    
    print("✅ Proceso completado exitosamente\n")
