"""
Schemas para webhooks de Meta WhatsApp
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID


class WebhookContacto(BaseModel):
    """Información de contacto en webhook de Meta"""
    profile: Optional[Dict[str, Any]] = None
    wa_id: str = Field(..., description="WhatsApp ID del contacto")


class WebhookValue(BaseModel):
    """Value object en webhook de Meta"""
    messaging_product: str = Field(default="whatsapp")
    metadata: Dict[str, Any] = Field(..., description="Contiene phone_number_id")
    contacts: Optional[List[WebhookContacto]] = None
    messages: Optional[List[Dict[str, Any]]] = None
    statuses: Optional[List[Dict[str, Any]]] = None


class WebhookEntry(BaseModel):
    """Entry object en webhook de Meta"""
    id: str = Field(..., description="empresa_id de Meta WhatsApp")
    changes: List[Dict[str, Any]]


class WebhookEventPayload(BaseModel):
    """Payload completo del webhook de Meta WhatsApp"""
    object: str = Field(default="whatsapp_business_account")
    entry: List[WebhookEntry]


class WebhookResponse(BaseModel):
    """Respuesta estándar del webhook"""
    status: str = Field(default="ok")
    message: Optional[str] = None


class MensajeWebhook(BaseModel):
    """Datos del mensaje en webhook"""
    id: str = Field(..., description="ID del mensaje en Meta")
    from_: str = Field(..., alias="from", description="Número del remitente")
    timestamp: str
    type: str = Field(..., description="Tipo de mensaje: text, image, etc")
    text: Optional[Dict[str, Any]] = None
    image: Optional[Dict[str, Any]] = None
    document: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = Field(
        None,
        description="Si es respuesta a otro mensaje, contiene el mensaje_id (UUID de SAK)"
    )


class StatusWebhook(BaseModel):
    """Datos de status en webhook"""
    id: str = Field(..., description="ID del mensaje en Meta")
    status: str = Field(..., description="Estado: sent, delivered, read, failed")
    timestamp: str
    recipient_id: str = Field(..., description="Número del destinatario")
    conversation: Optional[Dict[str, Any]] = None
    pricing: Optional[Dict[str, Any]] = None
    errors: Optional[List[Dict[str, Any]]] = None


class CRMCelularCreate(BaseModel):
    """Schema para crear un CRMCelular"""
    meta_celular_id: str = Field(..., max_length=255)
    numero_celular: str = Field(..., max_length=50)
    alias: Optional[str] = Field(None, max_length=255)
    activo: bool = Field(default=True)


class CRMCelularUpdate(BaseModel):
    """Schema para actualizar un CRMCelular"""
    alias: Optional[str] = Field(None, max_length=255)
    activo: Optional[bool] = None


class CRMCelularResponse(BaseModel):
    """Schema de respuesta para CRMCelular"""
    id: int
    meta_celular_id: str
    numero_celular: str
    alias: Optional[str]
    activo: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WebhookLogResponse(BaseModel):
    """Schema de respuesta para WebhookLog"""
    id: int
    evento: str
    payload: Dict[str, Any]
    response_status: Optional[int]
    error_message: Optional[str]
    procesado: bool
    fecha_recepcion: datetime
    
    class Config:
        from_attributes = True
