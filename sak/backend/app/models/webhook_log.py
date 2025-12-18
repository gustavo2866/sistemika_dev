"""
Modelo para auditoría y debugging de webhooks recibidos
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, JSON, Text
from sqlmodel import Field
from app.models.base import Base, current_utc_time

class WebhookLog(Base, table=True):
    __tablename__ = "webhook_logs"

    evento: str = Field(max_length=100, index=True, nullable=False)
    payload: dict = Field(
        sa_column=Column(JSON, nullable=False),
        description="Payload completo recibido"
    )
    response_status: Optional[int] = Field(default=None, description="HTTP status de respuesta")
    error_message: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="Mensaje de error si falla procesamiento"
    )
    procesado: bool = Field(default=False, description="Si se procesó exitosamente")
    fecha_recepcion: datetime = Field(
        default_factory=current_utc_time,
        index=True,
        nullable=False
    )
