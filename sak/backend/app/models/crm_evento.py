from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import event
from sqlmodel import Field, Relationship

from .base import Base, current_utc_time
from .enums import EstadoEvento
from .crm_catalogos import CRMTipoEvento, CRMMotivoEvento

if TYPE_CHECKING:
    from .crm_oportunidad import CRMOportunidad
    from .user import User
    from .crm_contacto import CRMContacto


class CRMEvento(Base, table=True):
    """
    Eventos/Actividades del CRM vinculados a oportunidades.
    
    Representa cualquier interacción con el cliente: llamadas, visitas,
    reuniones, emails, mensajes, notas, etc.
    """
    __tablename__ = "crm_eventos"
    __searchable_fields__ = ["titulo", "resultado"]
    __expanded_list_relations__ = {"asignado_a", "oportunidad"}
    __auto_include_relations__ = [
        "asignado_a",
        "oportunidad",
        "oportunidad.contacto",
        "contacto",
        "tipo_catalogo",
        "motivo_catalogo",
    ]

    # Campos obligatorios
    oportunidad_id: int = Field(
        foreign_key="crm_oportunidades.id",
        index=True,
        description="Oportunidad a la que pertenece el evento"
    )
    contacto_id: int = Field(
        foreign_key="crm_contactos.id",
        index=True,
        description="Contacto asociado al evento"
    )
    tipo_id: int = Field(
        foreign_key="crm_tipos_evento.id",
        description="Tipo histórico del evento (catálogo)"
    )
    motivo_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_motivos_evento.id",
        description="Motivo histórico del evento (catálogo) - requerido solo en oportunidades perdidas"
    )
    titulo: str = Field(
        max_length=255,
        description="Título/resumen breve del evento"
    )
    fecha_evento: Optional[datetime] = Field(
        default=None,
        description="Fecha y hora del evento (programada o realizada)",
        index=True,
        nullable=True,
    )
    estado_evento: str = Field(
        default=EstadoEvento.PENDIENTE.value,
        max_length=20,
        description="Estado: 1-pendiente, 2-realizado, 3-cancelado, 4-reagendar",
        index=True
    )
    asignado_a_id: int = Field(
        foreign_key="users.id",
        description="Usuario asignado/responsable del evento"
    )
    fecha_estado: Optional[datetime] = Field(
        default=None,
        index=True,
        nullable=True,
        description="Fecha del último cambio de estado"
    )
    
    # Campos opcionales
    descripcion: str = Field(
        default="",
        description="Descripcion detallada del evento"
    )
    resultado: Optional[str] = Field(
        default=None,
        description="Resultado del evento (obligatorio al cerrar)"
    )
    
    # Relaciones
    oportunidad: "CRMOportunidad" = Relationship(back_populates="eventos")
    contacto: "CRMContacto" = Relationship()
    tipo_catalogo: CRMTipoEvento = Relationship(sa_relationship_kwargs={"lazy": "joined"})
    motivo_catalogo: CRMMotivoEvento = Relationship(sa_relationship_kwargs={"lazy": "joined"})
    asignado_a: Optional["User"] = Relationship()
    
    def set_estado(self, nuevo_estado: str) -> None:
        """Actualiza el estado y la fecha_estado automáticamente."""
        self.estado_evento = nuevo_estado
        self.fecha_estado = current_utc_time()
    
    def __repr__(self) -> str:
        return f"<CRMEvento {self.id}: {self.titulo} ({self.estado_evento})>"
    
    def to_dict_extended(self) -> dict:
        """Serialización extendida con datos relacionados"""
        base_dict = self.model_dump()
        
        # Agregar datos de relaciones si están cargadas
        if self.oportunidad:
            base_dict["oportunidad"] = {
                "id": self.oportunidad.id,
                "estado": self.oportunidad.estado,
                "contacto_id": self.oportunidad.contacto_id,
            }
        
        if self.asignado_a:
            base_dict["asignado_a"] = {
                "id": self.asignado_a.id,
                "nombre": self.asignado_a.nombre,
                "email": self.asignado_a.email,
            }
        
        return base_dict


# Event listeners para actualizar fecha_estado automáticamente
@event.listens_for(CRMEvento, 'before_update')
def receive_before_update(mapper, connection, target):
    """Actualiza fecha_estado cuando cambia el estado del evento."""
    state = target._sa_instance_state
    history = state.get_history('estado_evento', True)
    
    if history.has_changes():
        target.fecha_estado = current_utc_time()


@event.listens_for(CRMEvento, 'before_insert')
def receive_before_insert(mapper, connection, target):
    """Establece fecha_estado en la creación del evento."""
    if target.fecha_estado is None:
        target.fecha_estado = current_utc_time()
