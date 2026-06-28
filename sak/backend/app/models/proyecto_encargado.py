from datetime import date
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Index, text
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm.contacto import CRMContacto
    from .proyecto import Proyecto


class ProyectoEncargado(Base, table=True):
    """Contacto encargado habilitado para operar un proyecto."""

    __tablename__ = "proyecto_encargados"
    __expanded_list_relations__ = {"proyecto", "contacto"}
    __table_args__ = (
        Index(
            "uq_proyecto_encargados_proyecto_contacto_active",
            "proyecto_id",
            "contacto_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_proyecto_encargados_proyecto_activo", "proyecto_id", "activo"),
        Index("ix_proyecto_encargados_contacto_activo", "contacto_id", "activo"),
    )

    proyecto_id: int = Field(
        foreign_key="proyectos.id",
        description="Proyecto asociado al encargado",
    )
    contacto_id: int = Field(
        foreign_key="crm_contactos.id",
        description="Contacto CRM encargado habilitado para operar el proyecto",
    )
    principal: bool = Field(
        default=False,
        description="Indica si es el encargado principal del proyecto",
    )
    activo: bool = Field(
        default=True,
        description="Indica si la asignacion esta activa",
    )
    desde: Optional[date] = Field(
        default=None,
        description="Fecha de inicio de la asignacion",
    )
    hasta: Optional[date] = Field(
        default=None,
        description="Fecha de fin de la asignacion",
    )
    notas: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Notas de la asignacion",
    )

    proyecto: Optional["Proyecto"] = Relationship(back_populates="encargados")
    contacto: Optional["CRMContacto"] = Relationship()
