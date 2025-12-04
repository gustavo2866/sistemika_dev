from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, JSON
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm_catalogos import CRMOrigenLead
    from .crm_oportunidad import CRMOportunidad
    from .crm_mensaje import CRMMensaje
    from .user import User


class CRMContacto(Base, table=True):
    __tablename__ = "crm_contactos"
    __searchable_fields__ = ["nombre_completo", "email"]
    __expanded_list_relations__ = {"origen_lead", "responsable"}

    nombre_completo: str = Field(max_length=255, description="Nombre completo del contacto", index=True)
    telefonos: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        description="Listado de teléfonos normalizados",
    )
    email: Optional[str] = Field(default=None, max_length=255, description="Email del contacto", index=True)
    red_social: Optional[str] = Field(default=None, max_length=255, description="Usuario/red social")
    origen_lead_id: Optional[int] = Field(default=None, foreign_key="crm_origenes_lead.id")
    responsable_id: int = Field(foreign_key="users.id")
    notas: Optional[str] = Field(default=None, max_length=1000)

    origen_lead: Optional["CRMOrigenLead"] = Relationship(back_populates="contactos")
    responsable: Optional["User"] = Relationship()
    oportunidades: list["CRMOportunidad"] = Relationship(back_populates="contacto")
    mensajes: list["CRMMensaje"] = Relationship(back_populates="contacto")

    def __str__(self) -> str:  # pragma: no cover
        return f"CRMContacto(id={self.id}, nombre='{self.nombre_completo}')"
