from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, JSON, event
from sqlmodel import Field, SQLModel, Relationship

from .base import Base, current_utc_time
from .enums import EstadoMensaje, PrioridadMensaje, CanalMensaje, TipoMensaje

if TYPE_CHECKING:
    from .crm_oportunidad import CRMOportunidad
    from .crm_contacto import CRMContacto


class CRMMensaje(Base, table=True):
    __tablename__ = "crm_mensajes"
    __searchable_fields__ = ["asunto", "contenido"]
    __expanded_list_relations__ = {"contacto"}
    __auto_include_relations__ = ["contacto", "oportunidad"]
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
    fecha_mensaje: datetime = Field(default_factory=current_utc_time, index=True, nullable=False)
    fecha_estado: Optional[datetime] = Field(default=None, index=True, nullable=True)
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
    oportunidad_id: Optional[int] = Field(
        default=None, foreign_key="crm_oportunidades.id", index=True
    )
    contacto: Optional["CRMContacto"] = Relationship(back_populates="mensajes")
    oportunidad: Optional["CRMOportunidad"] = Relationship(back_populates="mensajes")

    def set_estado(self, nuevo_estado: str) -> None:
        self.estado = nuevo_estado
        self.fecha_estado = current_utc_time()


# Event listener para actualizar fecha_estado automáticamente cuando cambie el estado
@event.listens_for(CRMMensaje, 'before_update')
def receive_before_update(mapper, connection, target):
    """Actualiza fecha_estado cuando cambia el estado del mensaje."""
    state = target._sa_instance_state
    history = state.get_history('estado', True)
    
    if history.has_changes():
        target.fecha_estado = current_utc_time()


# Event listener para establecer fecha_estado en la creación
@event.listens_for(CRMMensaje, 'before_insert')
def receive_before_insert(mapper, connection, target):
    """Establece fecha_estado en la creación del mensaje."""
    if target.fecha_estado is None:
        target.fecha_estado = current_utc_time()
