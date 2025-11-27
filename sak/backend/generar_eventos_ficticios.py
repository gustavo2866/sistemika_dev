"""
Script para generar eventos ficticios asociados a oportunidades específicas
"""
from datetime import datetime, date, timedelta
from app.db import get_session
from app.models.crm_evento import CRMEvento
from app.models.crm_oportunidad import CRMOportunidad
from app.models.crm_catalogos import CRMTipoEvento, CRMMotivoEvento
from app.models.enums import EstadoEvento
from sqlmodel import select

def generar_eventos_ficticios():
    """Generar eventos ficticios para las oportunidades 6391 y 6392"""
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
        print(f"  - Oportunidad 6391: Contacto ID: {opp_6391.contacto_id}")
        print(f"  - Oportunidad 6392: Contacto ID: {opp_6392.contacto_id}")
        
        # Obtener tipos y motivos de evento disponibles
        tipos_evento = session.exec(select(CRMTipoEvento)).all()
        motivos_evento = session.exec(select(CRMMotivoEvento)).all()
        
        if not tipos_evento or not motivos_evento:
            print("❌ No hay tipos o motivos de evento en la base de datos")
            return
        
        print(f"\n✓ Tipos de evento disponibles: {len(tipos_evento)}")
        print(f"✓ Motivos de evento disponibles: {len(motivos_evento)}")
        
        # Usar el primer usuario disponible (asumiendo que existe usuario con ID 1)
        usuario_id = 1
        
        # Eventos para oportunidad 6391
        eventos_6391 = [
            {
                "contacto_id": opp_6391.contacto_id,
                "tipo_id": tipos_evento[0].id if len(tipos_evento) > 0 else 1,
                "motivo_id": motivos_evento[0].id if len(motivos_evento) > 0 else 1,
                "fecha_evento": datetime.now() - timedelta(days=5, hours=10),
                "descripcion": "Primera llamada de consulta. Cliente interesado en conocer la propiedad. Manifestó interés en agendar una visita.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.HECHO.value,
                "proximo_paso": "Coordinar visita para el viernes",
                "fecha_compromiso": date.today() - timedelta(days=2)
            },
            {
                "contacto_id": opp_6391.contacto_id,
                "tipo_id": tipos_evento[1].id if len(tipos_evento) > 1 else 1,
                "motivo_id": motivos_evento[1].id if len(motivos_evento) > 1 else 1,
                "fecha_evento": datetime.now() - timedelta(days=2, hours=15),
                "descripcion": "Visita a la propiedad realizada. Cliente muy interesado, le gustó la ubicación y distribución. Preguntó sobre documentación y plazos.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.HECHO.value,
                "proximo_paso": "Enviar documentación de la propiedad",
                "fecha_compromiso": date.today() - timedelta(days=1)
            },
            {
                "contacto_id": opp_6391.contacto_id,
                "tipo_id": tipos_evento[0].id if len(tipos_evento) > 0 else 1,
                "motivo_id": motivos_evento[2].id if len(motivos_evento) > 2 else 1,
                "fecha_evento": datetime.now() - timedelta(days=1, hours=11),
                "descripcion": "Seguimiento telefónico. Cliente recibió documentación. Quiere consultar con su familia antes de avanzar.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.HECHO.value,
                "proximo_paso": "Llamar el jueves para conocer decisión",
                "fecha_compromiso": date.today() + timedelta(days=2)
            },
            {
                "contacto_id": opp_6391.contacto_id,
                "tipo_id": tipos_evento[0].id if len(tipos_evento) > 0 else 1,
                "motivo_id": motivos_evento[0].id if len(motivos_evento) > 0 else 1,
                "fecha_evento": datetime.now() + timedelta(days=2, hours=14),
                "descripcion": "Llamada de seguimiento programada para conocer decisión del cliente.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.PENDIENTE.value,
                "proximo_paso": "Preparar opciones de financiamiento por si hay interés",
                "fecha_compromiso": date.today() + timedelta(days=2)
            },
        ]
        
        # Eventos para oportunidad 6392
        eventos_6392 = [
            {
                "contacto_id": opp_6392.contacto_id,
                "tipo_id": tipos_evento[0].id if len(tipos_evento) > 0 else 1,
                "motivo_id": motivos_evento[0].id if len(motivos_evento) > 0 else 1,
                "fecha_evento": datetime.now() - timedelta(days=7, hours=9),
                "descripcion": "Llamada inicial. Cliente preguntó por precio y opciones de financiamiento. Muy interesado en la zona.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.HECHO.value,
                "proximo_paso": "Enviar detalles de financiamiento por WhatsApp",
                "fecha_compromiso": date.today() - timedelta(days=7)
            },
            {
                "contacto_id": opp_6392.contacto_id,
                "tipo_id": tipos_evento[2].id if len(tipos_evento) > 2 else 1,
                "motivo_id": motivos_evento[1].id if len(motivos_evento) > 1 else 1,
                "fecha_evento": datetime.now() - timedelta(days=6, hours=16),
                "descripcion": "Reunión virtual para explicar opciones de financiamiento. Cliente mostró interés en financiación a 20 años.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.HECHO.value,
                "proximo_paso": "Solicitar documentación para análisis crediticio",
                "fecha_compromiso": date.today() - timedelta(days=5)
            },
            {
                "contacto_id": opp_6392.contacto_id,
                "tipo_id": tipos_evento[0].id if len(tipos_evento) > 0 else 1,
                "motivo_id": motivos_evento[2].id if len(motivos_evento) > 2 else 1,
                "fecha_evento": datetime.now() - timedelta(days=3, hours=10),
                "descripcion": "Cliente envió documentación para análisis crediticio. Todo en orden, iniciar proceso con el banco.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.HECHO.value,
                "proximo_paso": "Enviar documentación al banco para pre-aprobación",
                "fecha_compromiso": date.today() - timedelta(days=2)
            },
            {
                "contacto_id": opp_6392.contacto_id,
                "tipo_id": tipos_evento[0].id if len(tipos_evento) > 0 else 1,
                "motivo_id": motivos_evento[0].id if len(motivos_evento) > 0 else 1,
                "fecha_evento": datetime.now() - timedelta(hours=2),
                "descripcion": "Cliente preguntó por el estado del análisis crediticio. Informé que está en proceso.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.HECHO.value,
                "proximo_paso": "Esperar respuesta del banco (48hs)",
                "fecha_compromiso": date.today() + timedelta(days=1)
            },
            {
                "contacto_id": opp_6392.contacto_id,
                "tipo_id": tipos_evento[0].id if len(tipos_evento) > 0 else 1,
                "motivo_id": motivos_evento[0].id if len(motivos_evento) > 0 else 1,
                "fecha_evento": datetime.now() + timedelta(days=1, hours=10),
                "descripcion": "Llamada programada para informar resultado del análisis crediticio.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.PENDIENTE.value,
                "proximo_paso": "Si es aprobado, coordinar reserva de la propiedad",
                "fecha_compromiso": date.today() + timedelta(days=1)
            },
            {
                "contacto_id": opp_6392.contacto_id,
                "tipo_id": tipos_evento[1].id if len(tipos_evento) > 1 else 1,
                "motivo_id": motivos_evento[1].id if len(motivos_evento) > 1 else 1,
                "fecha_evento": datetime.now() + timedelta(days=3, hours=15),
                "descripcion": "Visita programada a la propiedad con familia del cliente.",
                "asignado_a_id": usuario_id,
                "estado_evento": EstadoEvento.PENDIENTE.value,
                "proximo_paso": "Preparar documentación completa de la propiedad",
                "fecha_compromiso": date.today() + timedelta(days=3)
            },
        ]
        
        print(f"\n📅 Creando eventos para oportunidad 6391...")
        for evt_data in eventos_6391:
            evento = CRMEvento(
                oportunidad_id=6391,
                **evt_data
            )
            session.add(evento)
        
        print(f"📅 Creando eventos para oportunidad 6392...")
        for evt_data in eventos_6392:
            evento = CRMEvento(
                oportunidad_id=6392,
                **evt_data
            )
            session.add(evento)
        
        session.commit()
        
        print(f"\n✅ Eventos creados exitosamente:")
        print(f"   - Oportunidad 6391: {len(eventos_6391)} eventos")
        print(f"   - Oportunidad 6392: {len(eventos_6392)} eventos")
        print(f"   - Total: {len(eventos_6391) + len(eventos_6392)} eventos")
        
        # Mostrar resumen de estados
        statement = select(CRMEvento).where(CRMEvento.oportunidad_id.in_([6391, 6392]))
        eventos_creados = session.exec(statement).all()
        
        pendientes = len([e for e in eventos_creados if e.estado_evento == EstadoEvento.PENDIENTE.value])
        hechos = len([e for e in eventos_creados if e.estado_evento == EstadoEvento.HECHO.value])
        
        print(f"\n📊 Resumen:")
        print(f"   - Eventos pendientes: {pendientes}")
        print(f"   - Eventos realizados: {hechos}")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Error al crear eventos: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    generar_eventos_ficticios()
