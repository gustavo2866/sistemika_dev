from datetime import date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL, ForeignKey
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .proyecto import Proyecto


class ProyectoAvance(Base, table=True):
    """Entidad para registrar avances de proyectos."""

    __tablename__ = "proyecto_avance"

    __searchable_fields__ = ["comentario"]

    proyecto_id: int = Field(
        sa_column=Column("proyecto_id", ForeignKey("proyectos.id"), nullable=False),
        description="ID del proyecto asociado",
    )
    horas: int = Field(
        description="Horas trabajadas en este registro de avance",
    )
    avance: Decimal = Field(
        sa_column=Column(DECIMAL(5, 2), nullable=False),
        description="Porcentaje de avance (0.00 a 100.00)",
    )
    importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe asociado al avance",
    )
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentarios sobre este avance",
    )
    fecha_registracion: date = Field(
        description="Fecha de registro del avance",
    )

    proyecto: Optional["Proyecto"] = Relationship(back_populates="avances")

    def __str__(self) -> str:  # pragma: no cover
        return (
            "ProyectoAvance("
            f"id={self.id}, proyecto_id={self.proyecto_id}, avance={self.avance}%"
            ")"
        )
