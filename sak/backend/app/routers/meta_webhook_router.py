"""
Router para recibir webhooks de Meta WhatsApp
"""
import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlmodel import Session

from app.db import get_session
from app.schemas.meta_webhook import WebhookEventPayload, WebhookResponse
from app.services.meta_webhook_service import MetaWebhookService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/meta-whatsapp", tags=["webhooks"])


@router.get("/", response_model=Dict[str, Any])
async def verify_webhook(
    request: Request,
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
):
    """
    Endpoint de verificación de webhook de Meta.
    Meta envía una petición GET con query params para verificar la URL.
    
    Retorna el hub.challenge si el verify_token es correcto.
    """
    # Obtener el token esperado de variables de entorno
    import os
    expected_token = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "mi_token_secreto_123")
    
    logger.info(f"Verificación de webhook - mode: {hub_mode}, token recibido: {hub_verify_token}")
    
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("Webhook verificado exitosamente")
        return {"challenge": hub_challenge}
    
    logger.warning("Token de verificación inválido")
    raise HTTPException(status_code=403, detail="Token de verificación inválido")


@router.post("/", response_model=WebhookResponse)
async def receive_webhook(
    payload: WebhookEventPayload,
    session: Session = Depends(get_session),
):
    """
    Endpoint principal para recibir notificaciones de Meta WhatsApp.
    
    Eventos soportados:
    - message.received: Mensaje entrante de un contacto
    - message.sent: Mensaje enviado confirmado por Meta
    - message.delivered: Mensaje entregado al destinatario
    - message.read: Mensaje leído por el destinatario
    - message.failed: Mensaje falló al enviarse
    
    El payload contiene:
    - entry[].id: empresa_id de Meta (debe coincidir con settings.meta_w_empresa_id)
    - entry[].changes[].value.metadata.phone_number_id: ID del celular en Meta
    - entry[].changes[].value.messages: Mensajes entrantes
    - entry[].changes[].value.statuses: Cambios de estado de mensajes
    """
    logger.info(f"Webhook recibido: {payload.model_dump()}")
    
    try:
        service = MetaWebhookService(session)
        result = service.process_webhook(payload)
        return WebhookResponse(status="ok", message=result.get("message"))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error procesando webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error procesando webhook: {str(e)}")
