"""
Endpoints para lectura y envio de mensajes.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Celular, Contacto, Conversacion, Mensaje, Empresa, LogIntegracion
from app.schemas import MensajeRead, TemplateMessageRequest
from app.services.meta_client import MetaAPIClient

router = APIRouter(prefix="/mensajes", tags=["Mensajes"])


@router.get("/", response_model=List[MensajeRead])
def listar_mensajes(
    empresa_id: UUID,
    contacto_id: Optional[UUID] = None,
    celular_id: Optional[UUID] = None,
    limit: int = 100,
    session: Session = Depends(get_session),
):
    query = select(Mensaje).where(Mensaje.empresa_id == empresa_id)
    if contacto_id:
        query = query.where(Mensaje.contacto_id == contacto_id)
    if celular_id:
        query = query.where(Mensaje.celular_id == celular_id)
    query = query.order_by(Mensaje.created_at.desc()).limit(limit)
    return session.exec(query).all()


def _obtener_o_crear_conversacion(
    session: Session,
    empresa_id: UUID,
    contacto_id: UUID,
    celular_id: UUID,
) -> Conversacion:
    query = (
        select(Conversacion)
        .where(
            Conversacion.empresa_id == empresa_id,
            Conversacion.contacto_id == contacto_id,
            Conversacion.celular_id == celular_id,
            Conversacion.estado == "activa",
        )
        .order_by(Conversacion.opened_at.desc())
    )
    conversacion = session.exec(query).first()
    if conversacion:
        return conversacion
    conversacion = Conversacion(
        empresa_id=empresa_id,
        contacto_id=contacto_id,
        celular_id=celular_id,
        estado="activa",
        canal="whatsapp",
        contexto_meta={},
    )
    session.add(conversacion)
    session.commit()
    session.refresh(conversacion)
    return conversacion


@router.post("/send-template", response_model=MensajeRead, status_code=status.HTTP_201_CREATED)
async def enviar_template(
    payload: TemplateMessageRequest,
    session: Session = Depends(get_session),
):
    # Validar celular
    celular = session.get(Celular, payload.celular_id)
    if not celular or celular.empresa_id != payload.empresa_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Celular no encontrado para la empresa")

    # Obtener empresa y validar token
    empresa = session.get(Empresa, payload.empresa_id)
    if not empresa or not empresa.meta_access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empresa sin token de acceso configurado")

    # Obtener o crear contacto
    contacto: Optional[Contacto] = None
    if payload.contacto_id:
        contacto = session.get(Contacto, payload.contacto_id)
    elif payload.telefono_destino:
        query = select(Contacto).where(
            Contacto.empresa_id == payload.empresa_id,
            Contacto.telefono == payload.telefono_destino,
        )
        contacto = session.exec(query).first()
        if not contacto:
            contacto = Contacto(
                empresa_id=payload.empresa_id,
                nombre=None,
                telefono=payload.telefono_destino,
                extra_data={"auto_created": True},
            )
            session.add(contacto)
            session.commit()
            session.refresh(contacto)
    if not contacto:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debe indicar contacto o telefono destino")

    # Obtener o crear conversación
    conversacion = _obtener_o_crear_conversacion(session, payload.empresa_id, contacto.id, celular.id)

    # Preparar payload del template
    template_payload = {
        "messaging_product": "whatsapp",
        "to": payload.telefono_destino or contacto.telefono,
        "type": "template",
        "template": {
            "name": payload.template_name,
            "language": {"code": payload.language_code},
        },
    }
    if payload.components:
        template_payload["template"]["components"] = payload.components

    # Crear mensaje inicial con status queued
    mensaje = Mensaje(
        empresa_id=payload.empresa_id,
        celular_id=celular.id,
        contacto_id=contacto.id,
        conversacion_id=conversacion.id,
        direccion="out",
        tipo="template",
        status="queued",
        contenido=template_payload,
        meta_payload={},
        created_at=datetime.utcnow(),
    )
    session.add(mensaje)
    session.commit()
    session.refresh(mensaje)

    # Enviar a Meta API
    meta_client = MetaAPIClient(
        access_token=empresa.meta_access_token,
        phone_number_id=celular.meta_phone_number_id,
    )
    
    try:
        meta_response = await meta_client.send_template_message(
            to=contacto.telefono,
            template_name=payload.template_name,
            language_code=payload.language_code,
            components=payload.components,
        )
        
        # Actualizar mensaje con respuesta de Meta
        mensaje.status = "sent"
        mensaje.meta_message_id = meta_response.get("messages", [{}])[0].get("id")
        mensaje.sent_at = datetime.utcnow()
        mensaje.meta_payload = meta_response
        
        # Actualizar conversación con context de Meta si viene
        if "contacts" in meta_response:
            contact_info = meta_response["contacts"][0]
            if "wa_id" in contact_info:
                conversacion.contexto_meta = conversacion.contexto_meta or {}
                conversacion.contexto_meta["wa_id"] = contact_info["wa_id"]
        
        # Log exitoso
        log = LogIntegracion(
            empresa_id=payload.empresa_id,
            celular_id=celular.id,
            scope="send",
            intent="send_template",
            request_payload=template_payload,
            response_payload=meta_response,
            status_code=200,
            resultado="ok",
        )
        session.add(log)
        
    except Exception as e:
        # Actualizar mensaje como fallido
        mensaje.status = "failed"
        mensaje.error_code = str(type(e).__name__)
        mensaje.meta_payload = {"error": str(e)}
        
        # Log de error
        log = LogIntegracion(
            empresa_id=payload.empresa_id,
            celular_id=celular.id,
            scope="send",
            intent="send_template",
            request_payload=template_payload,
            response_payload={"error": str(e)},
            status_code=500,
            resultado="error",
        )
        session.add(log)
        
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al enviar mensaje a Meta: {str(e)}"
        )
    
    session.commit()
    session.refresh(mensaje)
    return mensaje
