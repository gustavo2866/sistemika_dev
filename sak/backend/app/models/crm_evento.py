from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base
from .enums import EstadoEvento, TipoEvento

if TYPE_CHECKING:
    from .crm_oportunidad import CRMOportunidad
    from .user import User


class CRMEvento(Base, table=True):
    """
    Eventos/Actividades del CRM vinculados a oportunidades.
    
    Representa cualquier interacción con el cliente: llamadas, visitas,
    reuniones, emails, mensajes, notas, etc.
    """
    __tablename__ = "crm_eventos"
    __searchable_fields__ = ["titulo", "resultado"]
    __expanded_list_relations__ = {"asignado_a", "oportunidad"}
    
    # Campos obligatorios
    oportunidad_id: int = Field(
        foreign_key="crm_oportunidades.id", 
        index=True,
        description="Oportunidad a la que pertenece el evento"
    )
    titulo: str = Field(
        max_length=255, 
        description="Título/resumen breve del evento"
    )
    tipo_evento: str = Field(
        max_length=20, 
        description="Tipo de evento: llamada, reunion, visita, email, whatsapp, otro",
        index=True
    )
    fecha_evento: datetime = Field(
        description="Fecha y hora del evento (programada o realizada)",
        index=True
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
    
    # Campos opcionales
    resultado: Optional[str] = Field(
        default=None,
        description="Resultado del evento (obligatorio al cerrar)"
    )
    
    # Relaciones
    oportunidad: "CRMOportunidad" = Relationship(back_populates="eventos")
    asignado_a: Optional["User"] = Relationship()
    
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
