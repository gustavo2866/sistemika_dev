#!/usr/bin/env python3
"""
Script para poblar oportunidades de CRM en base de datos local de desarrollo.

Genera oportunidades con:
- Diferentes propiedades
- Diferentes periodos (últimos 2 años)
- Diferentes estados del pipeline
- Actualización consistente del estado de propiedades relacionadas

Uso:
    python scripts/populate_oportunidades_dev.py
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

# Estados y sus probabilidades de ocurrencia
ESTADOS_PROBABILIDADES = [
    (EstadoOportunidad.ABIERTA.value, 30),      # 30% abierta
    (EstadoOportunidad.VISITA.value, 20),       # 20% visita
    (EstadoOportunidad.COTIZA.value, 15),       # 15% cotiza
    (EstadoOportunidad.RESERVA.value, 10),      # 10% reserva
    (EstadoOportunidad.GANADA.value, 15),       # 15% ganada
    (EstadoOportunidad.PERDIDA.value, 10),      # 10% perdida
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
    estados = [e[0] for e in ESTADOS_PROBABILIDADES]
    pesos = [e[1] for e in ESTADOS_PROBABILIDADES]
    return random.choices(estados, weights=pesos, k=1)[0]


def generar_monto_aleatorio(tipo_operacion: str) -> Decimal:
    """Genera un monto realista según el tipo de operación."""
    if "venta" in tipo_operacion.lower():
        # Ventas: entre 80k y 500k USD
        return Decimal(random.randint(80000, 500000))
    elif "alquiler" in tipo_operacion.lower():
        # Alquileres: entre 800 y 3500 USD mensuales
        return Decimal(random.randint(800, 3500))
    else:
        # Otros: entre 50k y 300k
        return Decimal(random.randint(50000, 300000))


def calcular_probabilidad(estado: str) -> int:
    """Calcula la probabilidad de éxito según el estado."""
    probabilidades = {
        EstadoOportunidad.ABIERTA.value: random.randint(10, 30),
        EstadoOportunidad.VISITA.value: random.randint(30, 50),
        EstadoOportunidad.COTIZA.value: random.randint(50, 70),
        EstadoOportunidad.RESERVA.value: random.randint(70, 90),
        EstadoOportunidad.GANADA.value: 100,
        EstadoOportunidad.PERDIDA.value: 0,
    }
    return probabilidades.get(estado, 50)


def generar_descripcion_estado(estado: str, propiedad_nombre: str, contacto_nombre: str) -> str:
    """Genera una descripción realista según el estado."""
    descripciones = {
        EstadoOportunidad.ABIERTA.value: [
            f"Interés inicial en {propiedad_nombre}",
            f"{contacto_nombre} consultó por {propiedad_nombre}",
            f"Primera consulta de {contacto_nombre}",
        ],
        EstadoOportunidad.VISITA.value: [
            f"Visita programada para {propiedad_nombre}",
            f"{contacto_nombre} visitó la propiedad",
            f"Segunda visita agendada",
        ],
        EstadoOportunidad.COTIZA.value: [
            f"Cotización enviada a {contacto_nombre}",
            f"En proceso de evaluación financiera",
            f"Revisando propuesta para {propiedad_nombre}",
        ],
        EstadoOportunidad.RESERVA.value: [
            f"Reserva confirmada por {contacto_nombre}",
            f"Seña recibida para {propiedad_nombre}",
            f"En proceso de firma de contrato",
        ],
        EstadoOportunidad.GANADA.value: [
            f"Contrato firmado con {contacto_nombre}",
            f"Operación cerrada exitosamente",
            f"{propiedad_nombre} alquilada a {contacto_nombre}",
        ],
        EstadoOportunidad.PERDIDA.value: [
            f"{contacto_nombre} decidió no continuar",
            f"Oportunidad perdida por precio",
            f"Cliente eligió otra opción",
        ],
    }
    opciones = descripciones.get(estado, [f"Oportunidad en estado {estado}"])
    return random.choice(opciones)


def actualizar_estado_propiedad(session: Session, propiedad_id: int, estado_oportunidad: str):
    """Actualiza el estado de la propiedad según el estado de la oportunidad."""
    propiedad = session.get(Propiedad, propiedad_id)
    if not propiedad:
        return
    
    nuevo_estado = ESTADO_OPP_A_PROPIEDAD.get(estado_oportunidad)
    if nuevo_estado and propiedad.estado != nuevo_estado:
        print(f"  📦 Actualizando propiedad '{propiedad.nombre}': {propiedad.estado} → {nuevo_estado}")
        propiedad.estado = nuevo_estado
        session.add(propiedad)


def crear_log_estado(oportunidad_id: int, estado: str, fecha: datetime, usuario_id: int, observacion: str = None) -> CRMOportunidadLogEstado:
    """Crea un registro de log de cambio de estado."""
    return CRMOportunidadLogEstado(
        oportunidad_id=oportunidad_id,
        estado_anterior=EstadoOportunidad.ABIERTA.value,  # Primera transición desde abierta
        estado_nuevo=estado,
        fecha_registro=fecha,
        usuario_id=usuario_id,
        descripcion=observacion,
    )


def populate_oportunidades(session: Session, cantidad_por_propiedad: int = 10):
    """
    Puebla la base de datos con oportunidades de prueba.
    
    Args:
        session: Sesión de SQLModel
        cantidad_por_propiedad: Cantidad de oportunidades a generar por propiedad
    """
    print("🚀 Iniciando población de oportunidades...")
    
    # Obtener datos necesarios
    propiedades = list(session.exec(select(Propiedad)).all())
    contactos = list(session.exec(select(CRMContacto)).all())
    usuarios = list(session.exec(select(User)).all())
    tipos_operacion = list(session.exec(select(CRMTipoOperacion)).all())
    motivos_perdida = list(session.exec(select(CRMMotivoPerdida)).all())
    monedas = list(session.exec(select(Moneda)).all())
    
    if not propiedades:
        print("❌ No hay propiedades en la base de datos. Ejecuta primero las migraciones de propiedades.")
        return
    
    if not contactos:
        print("⚠️  No hay contactos. Creando contactos de prueba...")
        # Crear algunos contactos de prueba
        nombres = ["Juan Pérez", "María González", "Carlos López", "Ana Martínez", "Pedro Rodríguez"]
        for nombre in nombres:
            contacto = CRMContacto(
                nombre_completo=nombre,
                referencia=f"+549{random.randint(1000000000, 9999999999)}",
                responsable_id=random.choice(usuarios).id if usuarios else 1,
            )
            session.add(contacto)
        session.commit()
        contactos = list(session.exec(select(CRMContacto)).all())
    
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
    
    print(f"📊 Datos disponibles:")
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
    
    # Fecha de inicio: hace 2 años desde hoy
    # Usar fecha fija de hoy para que la distribución sea consistente
    hoy = datetime(2025, 11, 25, tzinfo=UTC)
    fecha_inicio = hoy - timedelta(days=730)
    fecha_fin = hoy
    
    total_generadas = 0
    
    print(f"\n📝 Generando {cantidad_por_propiedad} oportunidades por propiedad...")
    print(f"📅 Periodo: {fecha_inicio.date()} a {fecha_fin.date()}")
    
    for propiedad in propiedades:
        print(f"\n🏠 Propiedad: {propiedad.nombre}")
        
        for i in range(cantidad_por_propiedad):
            # Seleccionar datos aleatorios
            contacto = random.choice(contactos)
            tipo_operacion = random.choice(tipos_operacion)
            responsable = random.choice(usuarios)
            estado = seleccionar_estado_aleatorio()
            
            # Generar fechas
            fecha_creacion = generar_fecha_aleatoria(fecha_inicio, fecha_fin)
            
            # fecha_estado siempre parte de fecha_creacion para distribuir en todo el período
            # Oportunidades cerradas: 30-120 días después de creación
            # Oportunidades activas: mismo día o pocos días después
            if estado in [EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value]:
                fecha_estado = fecha_creacion + timedelta(days=random.randint(30, 120))
            else:
                fecha_estado = fecha_creacion + timedelta(days=random.randint(0, 7))
            
            # Generar monto y probabilidad
            monto = generar_monto_aleatorio(tipo_operacion.nombre)
            probabilidad = calcular_probabilidad(estado)
            
            # Generar descripción
            descripcion = generar_descripcion_estado(estado, propiedad.nombre, contacto.nombre_completo)
            
            # Crear oportunidad
            oportunidad = CRMOportunidad(
                contacto_id=contacto.id,
                tipo_operacion_id=tipo_operacion.id,
                propiedad_id=propiedad.id,
                estado=estado,
                fecha_estado=fecha_estado,
                motivo_perdida_id=random.choice(motivos_perdida).id if estado == EstadoOportunidad.PERDIDA.value and motivos_perdida else None,
                monto=monto,
                moneda_id=moneda_usd.id if moneda_usd else None,
                probabilidad=probabilidad,
                fecha_cierre_estimada=(fecha_estado + timedelta(days=random.randint(30, 90))).date(),
                responsable_id=responsable.id,
                descripcion_estado=descripcion,
                created_at=fecha_creacion,
                updated_at=fecha_estado,
            )
            
            session.add(oportunidad)
            session.flush()  # Para obtener el ID
            
            # Crear log de estado inicial
            log = crear_log_estado(
                oportunidad_id=oportunidad.id,
                estado=estado,
                fecha=fecha_creacion,
                usuario_id=responsable.id,
                observacion=f"Oportunidad creada en estado {estado}",
            )
            session.add(log)
            
            total_generadas += 1
            
            # Actualizar estado de propiedad si es necesario
            if estado == EstadoOportunidad.GANADA.value:
                actualizar_estado_propiedad(session, propiedad.id, estado)
        
        print(f"  ✅ {cantidad_por_propiedad} oportunidades generadas")
    
    # Commit final
    session.commit()
    
    print(f"\n✅ Total de oportunidades generadas: {total_generadas}")
    
    # Resumen por estado
    print("\n📊 Resumen por estado:")
    for estado, _ in ESTADOS_PROBABILIDADES:
        count = len(session.exec(select(CRMOportunidad).where(CRMOportunidad.estado == estado)).all())
        print(f"  - {estado}: {count}")


def main():
    """Función principal."""
    print("=" * 60)
    print("  SCRIPT DE POBLACIÓN DE OPORTUNIDADES CRM")
    print("=" * 60)
    
    # Crear engine
    engine = create_engine(DATABASE_URL, echo=False)
    
    try:
        with Session(engine) as session:
            # Generar 15 oportunidades por propiedad (ajustar según necesidad)
            populate_oportunidades(session, cantidad_por_propiedad=15)
            
        print("\n" + "=" * 60)
        print("  ✅ POBLACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error durante la población: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
