"""
SQLModel entities for Meta WhatsApp API backend.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, SQLModel


class Empresa(SQLModel, table=True):
    __tablename__ = "empresas"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    nombre: str = Field(index=True)
    estado: str = Field(default="activa")
    webhook_secret: Optional[str] = Field(default=None)
    meta_app_id: Optional[str] = Field(default=None)
    meta_access_token: Optional[str] = Field(default=None, description="Long-lived token")
    meta_webhook_verify_token: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Celular(SQLModel, table=True):
    __tablename__ = "celulares"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    empresa_id: UUID = Field(foreign_key="empresas.id", index=True)
    alias: str
    phone_number: str = Field(description="Numero en formato E.164")
    meta_phone_number_id: str = Field(index=True, description="ID provisto por Meta")
    waba_id: Optional[str] = Field(default=None, description="WhatsApp Business Account ID")
    estado: str = Field(default="activo")
    estado_desde: datetime = Field(default_factory=datetime.utcnow)
    limite_mensual: Optional[int] = Field(default=0)
    ultimo_token_valido: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Contacto(SQLModel, table=True):
    __tablename__ = "contactos"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    empresa_id: UUID = Field(foreign_key="empresas.id", index=True)
    nombre: Optional[str] = None
    telefono: str = Field(index=True)
    pais: Optional[str] = None
    extra_data: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB),
        description="Datos adicionales del contacto"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Conversacion(SQLModel, table=True):
    __tablename__ = "conversaciones"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    empresa_id: UUID = Field(foreign_key="empresas.id", index=True)
    contacto_id: UUID = Field(foreign_key="contactos.id", index=True)
    celular_id: UUID = Field(foreign_key="celulares.id", index=True)
    canal: str = Field(default="whatsapp")
    estado: str = Field(default="abierta")
    contexto_meta: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB),
    )
    opened_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None


class Mensaje(SQLModel, table=True):
    __tablename__ = "mensajes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    conversacion_id: UUID = Field(foreign_key="conversaciones.id", index=True)
    empresa_id: UUID = Field(foreign_key="empresas.id", index=True)
    celular_id: UUID = Field(foreign_key="celulares.id", index=True)
    contacto_id: UUID = Field(foreign_key="contactos.id", index=True)
    meta_message_id: Optional[str] = Field(default=None, index=True)
    direccion: str = Field(default="out")
    tipo: str = Field(default="template")
    contenido: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    status: str = Field(default="queued")
    error_code: Optional[str] = None
    meta_payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None


class WebhookEvento(SQLModel, table=True):
    __tablename__ = "webhook_eventos"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    empresa_id: UUID = Field(foreign_key="empresas.id", index=True)
    tipo_evento: str
    meta_entry_id: Optional[str] = Field(default=None, index=True)
    raw_payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    procesado: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None


class PlantillaMeta(SQLModel, table=True):
    __tablename__ = "plantillas_meta"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    empresa_id: UUID = Field(foreign_key="empresas.id", index=True)
    nombre: str = Field(index=True)
    categoria: str
    idioma: str
    estado_meta: str
    variables: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    ultima_revision: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LogIntegracion(SQLModel, table=True):
    __tablename__ = "logs_integracion"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    empresa_id: UUID = Field(foreign_key="empresas.id", index=True)
    celular_id: Optional[UUID] = Field(default=None, foreign_key="celulares.id")
    scope: str = Field(default="send")
    intent: Optional[str] = None
    request_payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    response_payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    status_code: Optional[int] = None
    resultado: str = Field(default="ok")
    created_at: datetime = Field(default_factory=datetime.utcnow)
