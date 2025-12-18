"""
Schemas para webhooks del sistema meta-w (formato personalizado)
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID


class MetaWCelular(BaseModel):
    """Información del celular en webhook de meta-w"""
    id: UUID
    alias: str
    phone_number: str


class MetaWMensaje(BaseModel):
    """Datos del mensaje en webhook de meta-w"""
    id: UUID
    meta_message_id: str
    from_phone: str = Field(..., description="Número del remitente")
    from_name: Optional[str] = None
    to_phone: str = Field(..., description="Número receptor (nuestro celular)")
    direccion: str = Field(..., description="in o out")
    tipo: str = Field(..., description="text, image, etc")
    texto: Optional[str] = None
    media_id: Optional[str] = None
    caption: Optional[str] = None
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    status: str
    meta_timestamp: datetime
    created_at: datetime
    celular: MetaWCelular


class MetaWWebhookPayload(BaseModel):
    """Payload completo del webhook de meta-w"""
    event_type: str = Field(..., description="message.received, message.status, etc")
    timestamp: datetime
    mensaje: MetaWMensaje
