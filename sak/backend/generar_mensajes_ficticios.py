"""
Script para generar mensajes ficticios asociados a oportunidades específicas
"""
from datetime import datetime, timedelta
from app.db import get_session
from app.models.crm_mensaje import CRMMensaje
from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import TipoMensaje, CanalMensaje, EstadoMensaje, PrioridadMensaje
from sqlmodel import select

def generar_mensajes_ficticios():
    """Generar mensajes ficticios para las oportunidades 6391 y 6392"""
    session = next(get_session())
    
    try:
        # Verificar que las oportunidades existen
        opp_6391 = session.get(CRMOportunidad, 6391)
        opp_6392 = session.get(CRMOportunidad, 6392)
        
        if not opp_6391:
            print("❌ No se encontró la oportunidad 6391")
            return
        if not opp_6392:
            print("❌ No se encontró la oportunidad 6392")
            return
        
        print(f"✓ Encontradas oportunidades:")
        print(f"  - Oportunidad 6391: {opp_6391.titulo if hasattr(opp_6391, 'titulo') else 'Sin título'}")
        print(f"  - Oportunidad 6392: {opp_6392.titulo if hasattr(opp_6392, 'titulo') else 'Sin título'}")
        
        # Mensajes para oportunidad 6391
        mensajes_6391 = [
            {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.WHATSAPP.value,
                "asunto": "Consulta inicial sobre la propiedad",
                "contenido": "Hola, vi la propiedad publicada y me gustaría obtener más información. ¿Está disponible para una visita?",
                "contacto_referencia": "+54911234567",
                "contacto_nombre_propuesto": "Juan Pérez",
                "estado": EstadoMensaje.CONFIRMADO.value,
                "prioridad": PrioridadMensaje.ALTA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=5)
            },
            {
                "tipo": TipoMensaje.SALIDA.value,
                "canal": CanalMensaje.WHATSAPP.value,
                "asunto": "Re: Consulta inicial sobre la propiedad",
                "contenido": "¡Hola Juan! Claro, la propiedad está disponible. ¿Te viene bien el viernes a las 15:00 para visitarla?",
                "contacto_referencia": "+54911234567",
                "contacto_nombre_propuesto": "Juan Pérez",
                "estado": EstadoMensaje.ENVIADO.value,
                "prioridad": PrioridadMensaje.MEDIA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=5, hours=-2)
            },
            {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.WHATSAPP.value,
                "asunto": "Confirmación de visita",
                "contenido": "Perfecto, ahí estaré el viernes. ¿Cuál es la dirección exacta?",
                "contacto_referencia": "+54911234567",
                "contacto_nombre_propuesto": "Juan Pérez",
                "estado": EstadoMensaje.CONFIRMADO.value,
                "prioridad": PrioridadMensaje.MEDIA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=4)
            },
            {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.EMAIL.value,
                "asunto": "Solicitud de documentación",
                "contenido": "Buenos días, después de la visita me interesa avanzar. ¿Me pueden enviar la documentación de la propiedad?",
                "contacto_referencia": "juan.perez@email.com",
                "contacto_nombre_propuesto": "Juan Pérez",
                "estado": EstadoMensaje.CONFIRMADO.value,
                "prioridad": PrioridadMensaje.ALTA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=2)
            },
        ]
        
        # Mensajes para oportunidad 6392
        mensajes_6392 = [
            {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.OTRO.value,
                "asunto": "Llamada - Consulta sobre precio",
                "contenido": "Cliente llamó preguntando por el precio de la propiedad y condiciones de financiamiento.",
                "contacto_referencia": "+54911987654",
                "contacto_nombre_propuesto": "María González",
                "estado": EstadoMensaje.CONFIRMADO.value,
                "prioridad": PrioridadMensaje.ALTA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=7)
            },
            {
                "tipo": TipoMensaje.SALIDA.value,
                "canal": CanalMensaje.WHATSAPP.value,
                "asunto": "Seguimiento post-llamada",
                "contenido": "Hola María, como hablamos por teléfono, te envío los detalles de la propiedad y las opciones de financiamiento disponibles.",
                "contacto_referencia": "+54911987654",
                "contacto_nombre_propuesto": "María González",
                "estado": EstadoMensaje.ENVIADO.value,
                "prioridad": PrioridadMensaje.MEDIA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=7, hours=-3)
            },
            {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.WHATSAPP.value,
                "asunto": "Interés en financiamiento",
                "contenido": "Gracias por la info. Me interesa la opción de financiamiento a 20 años. ¿Qué requisitos necesito?",
                "contacto_referencia": "+54911987654",
                "contacto_nombre_propuesto": "María González",
                "estado": EstadoMensaje.CONFIRMADO.value,
                "prioridad": PrioridadMensaje.ALTA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=6)
            },
            {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.EMAIL.value,
                "asunto": "Documentación para análisis crediticio",
                "contenido": "Adjunto la documentación solicitada para el análisis crediticio. Recibo de sueldo, DNI y constancia de CUIL.",
                "contacto_referencia": "maria.gonzalez@email.com",
                "contacto_nombre_propuesto": "María González",
                "estado": EstadoMensaje.CONFIRMADO.value,
                "prioridad": PrioridadMensaje.ALTA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=3),
                "adjuntos": [
                    {"nombre": "recibo_sueldo.pdf", "tipo": "application/pdf"},
                    {"nombre": "dni_frente.jpg", "tipo": "image/jpeg"},
                    {"nombre": "dni_dorso.jpg", "tipo": "image/jpeg"}
                ]
            },
            {
                "tipo": TipoMensaje.SALIDA.value,
                "canal": CanalMensaje.EMAIL.value,
                "asunto": "Re: Documentación para análisis crediticio",
                "contenido": "Recibimos tu documentación. El análisis crediticio demora 48hs hábiles. Te contactaremos pronto con novedades.",
                "contacto_referencia": "maria.gonzalez@email.com",
                "contacto_nombre_propuesto": "María González",
                "estado": EstadoMensaje.ENVIADO.value,
                "prioridad": PrioridadMensaje.MEDIA.value,
                "fecha_mensaje": datetime.now() - timedelta(days=3, hours=-2)
            },
            {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.WHATSAPP.value,
                "asunto": "Consulta sobre estado de análisis",
                "contenido": "Hola, ¿hay novedades sobre el análisis crediticio?",
                "contacto_referencia": "+54911987654",
                "contacto_nombre_propuesto": "María González",
                "estado": EstadoMensaje.NUEVO.value,
                "prioridad": PrioridadMensaje.ALTA.value,
                "fecha_mensaje": datetime.now() - timedelta(hours=2)
            },
        ]
        
        print(f"\n📝 Creando mensajes para oportunidad 6391...")
        for msg_data in mensajes_6391:
            mensaje = CRMMensaje(
                oportunidad_id=6391,
                **msg_data
            )
            session.add(mensaje)
        
        print(f"📝 Creando mensajes para oportunidad 6392...")
        for msg_data in mensajes_6392:
            mensaje = CRMMensaje(
                oportunidad_id=6392,
                **msg_data
            )
            session.add(mensaje)
        
        session.commit()
        
        print(f"\n✅ Mensajes creados exitosamente:")
        print(f"   - Oportunidad 6391: {len(mensajes_6391)} mensajes")
        print(f"   - Oportunidad 6392: {len(mensajes_6392)} mensajes")
        print(f"   - Total: {len(mensajes_6391) + len(mensajes_6392)} mensajes")
        
        # Verificar
        statement = select(CRMMensaje).where(CRMMensaje.oportunidad_id.in_([6391, 6392]))
        mensajes_creados = session.exec(statement).all()
        print(f"\n✓ Verificación: {len(mensajes_creados)} mensajes en total para ambas oportunidades")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Error al crear mensajes: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    generar_mensajes_ficticios()
