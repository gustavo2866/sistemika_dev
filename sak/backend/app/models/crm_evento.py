from datetime import datetime, date
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base
from .enums import EstadoEvento

if TYPE_CHECKING:
    from .crm_catalogos import CRMOrigenLead, CRMMotivoEvento, CRMTipoEvento
    from .crm_contacto import CRMContacto
    from .crm_oportunidad import CRMOportunidad
    from .user import User


class CRMEvento(Base, table=True):
    __tablename__ = "crm_eventos"
    __searchable_fields__ = ["descripcion", "proximo_paso"]
    __expanded_list_relations__ = {"contacto", "tipo", "motivo", "asignado_a", "oportunidad"}

    contacto_id: int = Field(foreign_key="crm_contactos.id", index=True)
    tipo_id: int = Field(foreign_key="crm_tipos_evento.id")
    motivo_id: int = Field(foreign_key="crm_motivos_evento.id")
    fecha_evento: datetime = Field(description="Fecha del evento", index=True)
    descripcion: str = Field(max_length=2000)
    asignado_a_id: int = Field(foreign_key="users.id")
    oportunidad_id: Optional[int] = Field(default=None, foreign_key="crm_oportunidades.id", index=True)
    origen_lead_id: Optional[int] = Field(default=None, foreign_key="crm_origenes_lead.id")
    proximo_paso: Optional[str] = Field(default=None, max_length=500)
    fecha_compromiso: Optional[date] = Field(default=None)
    estado_evento: str = Field(
        default=EstadoEvento.PENDIENTE.value,
        max_length=20,
        description="Estado del evento",
        index=True,
    )

    contacto: Optional["CRMContacto"] = Relationship(back_populates="eventos")
    tipo: Optional["CRMTipoEvento"] = Relationship(back_populates="eventos")
    motivo: Optional["CRMMotivoEvento"] = Relationship(back_populates="eventos")
    asignado_a: Optional["User"] = Relationship()
    oportunidad: Optional["CRMOportunidad"] = Relationship(back_populates="eventos")
    origen_lead: Optional["CRMOrigenLead"] = Relationship(back_populates="eventos")
