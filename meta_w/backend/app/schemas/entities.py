"""
Pydantic / SQLModel schemas for API serialization.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlmodel import SQLModel


class EmpresaBase(SQLModel):
    nombre: str
    estado: Optional[str] = "activa"
    webhook_secret: Optional[str] = None
    meta_app_id: Optional[str] = None
    meta_access_token: Optional[str] = None
    meta_webhook_verify_token: Optional[str] = None


class EmpresaCreate(EmpresaBase):
    pass


class EmpresaRead(EmpresaBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class CelularBase(SQLModel):
    empresa_id: UUID
    alias: str
    phone_number: str
    meta_phone_number_id: str
    waba_id: Optional[str] = None
    estado: Optional[str] = "activo"
    limite_mensual: Optional[int] = 0


class CelularCreate(CelularBase):
    pass


class CelularRead(CelularBase):
    id: UUID
    estado_desde: datetime
    created_at: datetime


class ContactoBase(SQLModel):
    empresa_id: UUID
    nombre: Optional[str] = None
    telefono: str
    pais: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class ContactoCreate(ContactoBase):
    pass


class ContactoRead(ContactoBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class MensajeBase(SQLModel):
    empresa_id: UUID
    celular_id: UUID
    contacto_id: UUID
    conversacion_id: UUID
    direccion: str
    tipo: str
    status: str
    meta_message_id: Optional[str] = None
    contenido: Dict[str, Any]


class MensajeRead(MensajeBase):
    id: UUID
    created_at: datetime
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None


class TemplateMessageRequest(SQLModel):
    empresa_id: UUID
    celular_id: UUID
    contacto_id: Optional[UUID] = None
    telefono_destino: Optional[str] = None
    template_name: str
    language_code: str = "en_US"
    components: Optional[List[Dict[str, Any]]] = None


class WebhookVerifyResponse(SQLModel):
    challenge: str


class WebhookEventCreate(SQLModel):
    empresa_id: UUID
    payload: Dict[str, Any]
