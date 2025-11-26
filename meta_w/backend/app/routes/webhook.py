"""
Webhook oficial de Meta WhatsApp Cloud API.
"""
from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from app.config import settings
from app.db.session import get_session
from app.models import WebhookEvento
from app.services.webhook_processor import procesar_webhook_mensaje

router = APIRouter(prefix="/webhooks/meta/whatsapp", tags=["Webhooks"])


@router.get("/", response_class=PlainTextResponse)
async def verificar_webhook(
    request: Request,
):
    # Meta envía parámetros como hub.mode, hub.challenge, hub.verify_token
    params = dict(request.query_params)
    hub_mode = params.get("hub.mode")
    hub_challenge = params.get("hub.challenge")
    hub_verify_token = params.get("hub.verify_token")
    
    if hub_mode != "subscribe" or hub_verify_token != settings.META_WEBHOOK_VERIFY_TOKEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token de verificación inválido")
    return PlainTextResponse(content=hub_challenge)


@router.post("/")
async def recibir_webhook(
    request: Request,
    empresa_id: UUID = Query(..., description="Empresa asociada al webhook"),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    payload = await request.json()
    
    # Guardar evento crudo
    evento = WebhookEvento(
        empresa_id=empresa_id,
        tipo_evento=payload.get("object", "unknown"),
        meta_entry_id=str(payload.get("entry", [{}])[0].get("id", "")),
        raw_payload=payload,
        procesado=False,
    )
    session.add(evento)
    session.commit()
    session.refresh(evento)
    
    # Procesar inmediatamente si es un mensaje
    mensaje = None
    try:
        mensaje = procesar_webhook_mensaje(session, evento)
    except Exception as e:
        print(f"❌ Error procesando webhook: {e}")
        # No fallar el webhook, solo loguear el error
    
    return {
        "status": "received",
        "evento_id": str(evento.id),
        "mensaje_id": str(mensaje.id) if mensaje else None,
        "procesado": evento.procesado,
    }
