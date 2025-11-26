"""
Procesador de eventos de webhook para convertirlos en mensajes.
"""
from typing import Dict, Any, Optional
from datetime import datetime
from uuid import UUID

from sqlmodel import Session, select

from app.models import (
    WebhookEvento,
    Mensaje,
    Conversacion,
    Contacto,
    Celular,
    Empresa,
)


def procesar_webhook_mensaje(
    session: Session,
    evento: WebhookEvento,
) -> Optional[Mensaje]:
    """
    Procesa un evento de webhook y crea un Mensaje entrante.
    
    Args:
        session: Sesión de base de datos
        evento: Evento de webhook a procesar
        
    Returns:
        Mensaje creado o None si no se pudo procesar
    """
    payload = evento.raw_payload
    
    # Validar que sea un evento de mensajes
    if payload.get("object") != "whatsapp_business_account":
        return None
    
    entries = payload.get("entry", [])
    if not entries:
        return None
    
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            if change.get("field") != "messages":
                continue
            
            value = change.get("value", {})
            messages = value.get("messages", [])
            
            if not messages:
                continue
            
            # Procesar el primer mensaje
            msg_data = messages[0]
            
            # Extraer información
            meta_message_id = msg_data.get("id")
            from_number = msg_data.get("from")
            timestamp = msg_data.get("timestamp")
            msg_type = msg_data.get("type", "text")
            
            # Obtener metadata
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")
            
            # Buscar celular por phone_number_id
            celular_query = select(Celular).where(
                Celular.meta_phone_number_id == phone_number_id
            )
            celular = session.exec(celular_query).first()
            
            if not celular:
                print(f"❌ No se encontró celular con phone_number_id: {phone_number_id}")
                return None
            
            # Obtener o crear contacto
            contacto_query = select(Contacto).where(
                Contacto.empresa_id == evento.empresa_id,
                Contacto.telefono == f"+{from_number}",
            )
            contacto = session.exec(contacto_query).first()
            
            if not contacto:
                # Obtener nombre del contacto si viene en el webhook
                contacts_data = value.get("contacts", [])
                contact_name = None
                if contacts_data:
                    profile = contacts_data[0].get("profile", {})
                    contact_name = profile.get("name")
                
                contacto = Contacto(
                    empresa_id=evento.empresa_id,
                    nombre=contact_name,
                    telefono=f"+{from_number}",
                    extra_data={"auto_created": True, "from_webhook": True},
                )
                session.add(contacto)
                session.commit()
                session.refresh(contacto)
            
            # Obtener o crear conversación
            conv_query = select(Conversacion).where(
                Conversacion.empresa_id == evento.empresa_id,
                Conversacion.contacto_id == contacto.id,
                Conversacion.celular_id == celular.id,
                Conversacion.estado == "activa",
            ).order_by(Conversacion.opened_at.desc())
            
            conversacion = session.exec(conv_query).first()
            
            if not conversacion:
                conversacion = Conversacion(
                    empresa_id=evento.empresa_id,
                    contacto_id=contacto.id,
                    celular_id=celular.id,
                    estado="activa",
                    canal="whatsapp",
                    contexto_meta={},
                )
                session.add(conversacion)
                session.commit()
                session.refresh(conversacion)
            
            # Extraer contenido según tipo
            contenido = {}
            if msg_type == "text":
                text_data = msg_data.get("text", {})
                contenido = {"body": text_data.get("body", "")}
            elif msg_type == "image":
                image_data = msg_data.get("image", {})
                contenido = {
                    "id": image_data.get("id"),
                    "mime_type": image_data.get("mime_type"),
                    "caption": image_data.get("caption"),
                }
            elif msg_type == "document":
                doc_data = msg_data.get("document", {})
                contenido = {
                    "id": doc_data.get("id"),
                    "filename": doc_data.get("filename"),
                    "mime_type": doc_data.get("mime_type"),
                }
            elif msg_type == "audio":
                audio_data = msg_data.get("audio", {})
                contenido = {
                    "id": audio_data.get("id"),
                    "mime_type": audio_data.get("mime_type"),
                }
            else:
                # Para otros tipos, guardar todo el mensaje
                contenido = msg_data
            
            # Crear mensaje entrante
            mensaje = Mensaje(
                empresa_id=evento.empresa_id,
                celular_id=celular.id,
                contacto_id=contacto.id,
                conversacion_id=conversacion.id,
                meta_message_id=meta_message_id,
                direccion="in",  # Mensaje entrante
                tipo=msg_type,
                contenido=contenido,
                status="received",
                meta_payload=msg_data,
                created_at=datetime.fromtimestamp(int(timestamp)),
            )
            
            session.add(mensaje)
            
            # Marcar evento como procesado
            evento.procesado = True
            
            session.commit()
            session.refresh(mensaje)
            
            print(f"✅ Mensaje procesado: {meta_message_id} - {msg_type} - {contenido}")
            
            return mensaje
    
    return None
