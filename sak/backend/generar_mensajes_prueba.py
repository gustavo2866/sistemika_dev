#!/usr/bin/env python3
"""
Script para generar mensajes de prueba para oportunidades sin mensajes asociados.
Crea mensajes con fechas anteriores a hoy para simular escenarios reales.
"""

import os
import sys
from datetime import datetime, timedelta
from random import randint, choice
from zoneinfo import ZoneInfo

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from app.db import get_session
from app.models.crm.oportunidad import CRMOportunidad
from app.models.crm.mensaje import CRMMensaje
from app.models.crm.contacto import CRMContacto
from app.models.enums import TipoMensaje, CanalMensaje, EstadoMensaje
from app.crud.crm_mensaje_crud import crm_mensaje_crud

# Mensajes de ejemplo para diferentes tipos de consultas inmobiliarias
MENSAJES_EJEMPLO = [
    "Hola! Vi su propiedad publicada y me interesa mucho. ¿Podríamos coordinar una visita?",
    "Buenos días, quisiera más información sobre la propiedad que tienen disponible.",
    "Hola, estoy buscando algo similar a lo que publican. ¿Tienen disponibilidad?",
    "Me interesa la propiedad, ¿podrían enviarme más detalles y fotos?",
    "Buenas tardes, ¿la propiedad sigue disponible? Me gustaría visitarla.",
    "Hola! Estoy interesado en la propiedad. ¿Cuáles son las condiciones?",
    "Buenos días, vi la publicación y me parece interesante. ¿Podemos hablar?",
    "Hola, quisiera saber si aún está disponible y coordinar una visita.",
    "Me interesa mucho la propiedad que tienen. ¿Podríamos vernos para hablar?",
    "Buenas, estoy buscando en esa zona y su propiedad me llamó la atención.",
]

UTC = ZoneInfo("UTC")
ARGENTINA_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


def obtener_oportunidades_sin_mensajes(session: Session):
    """Obtiene oportunidades que no tienen mensajes asociados"""
    stmt = (
        select(CRMOportunidad)
        .outerjoin(CRMMensaje, CRMOportunidad.id == CRMMensaje.oportunidad_id)
        .where(CRMMensaje.id.is_(None))
        .where(CRMOportunidad.activo == True)
    )
    return session.exec(stmt).all()


def generar_fecha_pasada():
    """Genera una fecha entre 1 y 30 días atrás"""
    dias_atras = randint(1, 30)
    horas_atras = randint(0, 23)
    minutos_atras = randint(0, 59)
    
    # Crear fecha en hora Argentina y convertir a UTC
    fecha_argentina = datetime.now(ARGENTINA_TZ) - timedelta(
        days=dias_atras, hours=horas_atras, minutes=minutos_atras
    )
    return fecha_argentina.astimezone(UTC)


def generar_mensaje_para_oportunidad(session: Session, oportunidad: CRMOportunidad):
    """Genera un mensaje de entrada para una oportunidad"""
    
    # Obtener el contacto asociado
    contacto = session.get(CRMContacto, oportunidad.contacto_id)
    if not contacto:
        print(f"⚠️  Oportunidad {oportunidad.id} sin contacto válido")
        return None
    
    # Obtener referencia de contacto (teléfono)
    contacto_referencia = None
    if contacto.telefonos and len(contacto.telefonos) > 0:
        contacto_referencia = contacto.telefonos[0]
    
    if not contacto_referencia:
        print(f"⚠️  Contacto {contacto.id} sin teléfono")
        return None
    
    # Datos del mensaje
    mensaje_data = {
        "tipo": TipoMensaje.ENTRADA.value,
        "canal": CanalMensaje.WHATSAPP.value,
        "contacto_id": contacto.id,
        "oportunidad_id": oportunidad.id,
        "asunto": f"Consulta sobre {oportunidad.titulo or 'propiedad'}",
        "contenido": choice(MENSAJES_EJEMPLO),
        "estado": EstadoMensaje.ENVIADO.value,
        "fecha_mensaje": generar_fecha_pasada(),
        "responsable_id": oportunidad.responsable_id,
        "contacto_referencia": contacto_referencia,
        "origen_externo_id": f"test_msg_{oportunidad.id}_{randint(1000, 9999)}",
    }
    
    # Crear mensaje usando CRUD extendido (actualiza automáticamente ultimo_mensaje_*)
    try:
        mensaje = crm_mensaje_crud.create(session, mensaje_data)
        print(f"✅ Mensaje creado para oportunidad {oportunidad.id} - {contacto.nombre_completo}")
        return mensaje
    except Exception as e:
        print(f"❌ Error creando mensaje para oportunidad {oportunidad.id}: {e}")
        return None


def main():
    print("🚀 Generando mensajes de prueba para oportunidades sin mensajes...")
    
    with next(get_session()) as session:
        # Obtener oportunidades sin mensajes
        oportunidades = obtener_oportunidades_sin_mensajes(session)
        
        if not oportunidades:
            print("✅ Todas las oportunidades activas ya tienen mensajes asociados")
            return
        
        print(f"📊 Encontradas {len(oportunidades)} oportunidades sin mensajes")
        
        # Confirmar antes de proceder
        respuesta = input("\n¿Continuar con la generación de mensajes? (s/N): ")
        if respuesta.lower() not in ['s', 'si', 'sí', 'y', 'yes']:
            print("🚫 Operación cancelada")
            return
        
        mensajes_creados = 0
        
        for oportunidad in oportunidades:
            mensaje = generar_mensaje_para_oportunidad(session, oportunidad)
            if mensaje:
                mensajes_creados += 1
        
        print(f"\n🎉 Proceso completado!")
        print(f"✅ {mensajes_creados} mensajes creados exitosamente")
        print(f"❌ {len(oportunidades) - mensajes_creados} errores")
        
        # Verificar que se actualizaron los campos ultimo_mensaje_*
        if mensajes_creados > 0:
            print("\n🔍 Verificando actualización de campos ultimo_mensaje_*...")
            stmt = select(CRMOportunidad).where(
                CRMOportunidad.ultimo_mensaje_id.isnot(None)
            )
            oportunidades_actualizadas = session.exec(stmt).all()
            print(f"✅ {len(oportunidades_actualizadas)} oportunidades con ultimo_mensaje_* actualizados")


if __name__ == "__main__":
    main()