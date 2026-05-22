"""Schemas para payloads normalizados del modulo channel."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ChannelEndpoint(BaseModel):
    """Cuenta/celular receptor normalizado por el modulo channel."""

    id: UUID
    alias: str
    phone_number: str


class ChannelMessage(BaseModel):
    """Mensaje normalizado de un proveedor de canales."""

    id: UUID
    meta_message_id: str
    from_phone: str = Field(..., description="Numero del remitente")
    from_name: Optional[str] = None
    to_phone: str = Field(..., description="Numero receptor")
    direccion: str = Field(..., description="in o out")
    tipo: str = Field(..., description="text, image, audio, document, etc")
    texto: Optional[str] = None
    media_id: Optional[str] = None
    caption: Optional[str] = None
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    status: str
    meta_timestamp: datetime
    created_at: datetime
    celular: ChannelEndpoint


class ChannelWebhookPayload(BaseModel):
    """Payload normalizado que consume el servicio de webhooks de channel."""

    event_type: str = Field(..., description="message.received, message.status, etc")
    timestamp: datetime
    mensaje: ChannelMessage


class ChannelWebhookResponse(BaseModel):
    """Respuesta estandar de los endpoints de webhooks de channel."""

    status: str = Field(default="ok")
    message: Optional[str] = None
