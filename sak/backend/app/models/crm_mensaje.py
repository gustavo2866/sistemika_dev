from datetime import datetime
from typing import Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel

from .base import Base
from .enums import EstadoMensaje, PrioridadMensaje, CanalMensaje, TipoMensaje


class CRMMensaje(Base, table=True):
    __tablename__ = "crm_mensajes"
    __searchable_fields__ = ["asunto", "contenido"]
    __expanded_list_relations__ = set()
    model_config = SQLModel.model_config

    tipo: str = Field(default=TipoMensaje.ENTRADA.value, max_length=20, index=True)
    canal: str = Field(default=CanalMensaje.WHATSAPP.value, max_length=30, index=True)
    contacto_id: Optional[int] = Field(default=None, foreign_key="crm_contactos.id", index=True)
    contacto_referencia: Optional[str] = Field(
        default=None, max_length=255, description="Valor externo segun canal (tel/email/handle)", index=True
    )
    contacto_nombre_propuesto: Optional[str] = Field(default=None, max_length=255)
    oportunidad_generar: bool = Field(default=False)
    evento_id: Optional[int] = Field(default=None, foreign_key="crm_eventos.id", index=True)
    estado: str = Field(default=EstadoMensaje.NUEVO.value, max_length=30, index=True)
    prioridad: str = Field(default=PrioridadMensaje.MEDIA.value, max_length=20, index=True)
    asunto: Optional[str] = Field(default=None, max_length=255)
    contenido: Optional[str] = Field(default=None)
    adjuntos: list[dict] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        description="Listado de adjuntos referenciados",
    )
    origen_externo_id: Optional[str] = Field(default=None, max_length=255, index=True)
    metadata_json: dict = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSON, nullable=False, server_default="{}"),
        description="Datos extra, incluyendo sugerencias LLM",
        alias="metadata",
    )
    responsable_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)

    def set_estado(self, nuevo_estado: str) -> None:
        self.estado = nuevo_estado
