from datetime import date
from decimal import Decimal
from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .proyecto_avance import ProyectoAvance
    from .crm import CRMOportunidad
    from .user import User


class Proyecto(Base, table=True):
    """Entidad de proyectos para planificar obras o iniciativas."""

    __tablename__ = "proyectos"

    __searchable_fields__ = ["nombre", "estado"]
    __expanded_list_relations__: ClassVar[set[str]] = {"avances"}
    __auto_include_relations__: ClassVar[List[str]] = ["avances"]

    nombre: str = Field(
        max_length=150,
        description="Nombre del proyecto",
    )
    fecha_inicio: Optional[date] = Field(
        default=None,
        description="Fecha de inicio del proyecto",
    )
    fecha_final: Optional[date] = Field(
        default=None,
        description="Fecha estimada de finalizacion del proyecto",
    )
    estado: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Estado actual del proyecto",
    )
    centro_costo: Optional[int] = Field(
        default=None,
        description="Centro de costo asociado al proyecto",
    )
    importe_mat: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe previsto para materiales",
    )
    importe_mo: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe previsto para mano de obra",
    )
    terceros: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe previsto para terceros",
    )
    herramientas: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe previsto para herramientas",
    )
    superficie: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(5, 2)),
        description="Porcentaje de superficie (0.00 a 100.00)",
    )
    ingresos: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Ingresos proyectados del proyecto",
    )
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentarios adicionales sobre el proyecto",
    )
    oportunidad_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_oportunidades.id",
        description="ID de la oportunidad CRM asociada (opcional)"
    )
    responsable_id: int = Field(
        foreign_key="users.id",
        description="Usuario responsable del proyecto"
    )

    # Relaciones
    avances: List["ProyectoAvance"] = Relationship(
        back_populates="proyecto",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    oportunidad: Optional["CRMOportunidad"] = Relationship()
    responsable: Optional["User"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"Proyecto(id={self.id}, nombre='{self.nombre}')"
