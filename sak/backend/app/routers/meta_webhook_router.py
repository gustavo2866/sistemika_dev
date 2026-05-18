"""
Router para recibir webhooks de Meta WhatsApp
"""
import logging
from typing import Dict, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Query
from sqlmodel import Session

from app.db import engine, get_session
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
    import os
    expected_token = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "mi_token_secreto_123")
    
    logger.info(f"Verificación de webhook - mode: {hub_mode}, token recibido: {hub_verify_token}")
    
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("Webhook verificado exitosamente")
        return {"challenge": hub_challenge}
    
    logger.warning("Token de verificación inválido")
    raise HTTPException(status_code=403, detail="Token de verificación inválido")


async def _process_webhook_background(payload: dict) -> None:
    """
    Procesa el webhook en background — fuera del ciclo de vida del request original.
    Usa su propia Session para no depender de la sesión del request que ya cerró.
    """
    with Session(engine) as session:
        try:
            service = MetaWebhookService(session)
            await service.process_webhook(payload)
        except Exception:
            logger.exception("Error procesando webhook en background")


@router.post("/", response_model=WebhookResponse)
async def receive_webhook(
    payload: Dict[str, Any],
    background_tasks: BackgroundTasks,
):
    """
    Recibe el webhook de Meta y retorna 200 inmediatamente.
    El procesamiento (guardar mensaje, llamar al LLM, responder por WhatsApp)
    ocurre en background — Meta no necesita esperar ese resultado.
    
    Patron estandar para webhooks asincrónicos: ack rapido + proceso en background.
    """
    logger.info(f"Webhook recibido: {payload.get('event_type', '?')}")
    background_tasks.add_task(_process_webhook_background, payload)
    return WebhookResponse(status="ok", message="Recibido")
