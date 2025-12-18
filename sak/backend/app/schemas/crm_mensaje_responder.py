"""
Schemas para responder mensajes de WhatsApp
"""
from pydantic import BaseModel, Field
from typing import Optional


class ResponderMensajeRequest(BaseModel):
    """Request para responder un mensaje de WhatsApp"""
    texto: str = Field(..., min_length=1, max_length=4096, description="Texto de respuesta")
    template_fallback_name: Optional[str] = Field(
        default="notificacion_general",
        description="Template a usar si está fuera de ventana 24h"
    )
    template_fallback_language: Optional[str] = Field(
        default="es_AR",
        description="Idioma del template fallback"
    )


class ResponderMensajeResponse(BaseModel):
    """Response al responder mensaje"""
    mensaje_id: int = Field(..., description="ID del mensaje de respuesta creado")
    status: str = Field(..., description="Estado del envío (sent, queued, failed)")
    meta_message_id: Optional[str] = Field(None, description="ID del mensaje en Meta")
    error_message: Optional[str] = Field(None, description="Mensaje de error si falló")
