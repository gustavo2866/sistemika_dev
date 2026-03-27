from datetime import date
from decimal import Decimal
from typing import ClassVar, Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .proyecto import Proyecto


class ProyPresupuesto(Base, table=True):
    """Entidad de presupuestos por proyecto y fecha."""

    __tablename__ = "proy_presupuestos"

    __searchable_fields__ = ["fecha"]
    __expanded_list_relations__: ClassVar[set[str]] = {"proyecto"}

    proyecto_id: int = Field(
        foreign_key="proyectos.id",
        description="ID del proyecto asociado"
    )
    fecha: date = Field(
        description="Fecha del presupuesto"
    )
    mo_propia: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Mano de obra propia"
    )
    mo_terceros: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Mano de obra de terceros"
    )
    materiales: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Costo de materiales"
    )
    horas: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(10, 2), nullable=False, server_default="0"),
        description="Cantidad de horas"
    )
    metros: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(10, 2), nullable=False, server_default="0"),
        description="Cantidad de metros"
    )
    importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe total del presupuesto"
    )

    # Relaciones
    proyecto: Optional["Proyecto"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"ProyPresupuesto(id={self.id}, proyecto_id={self.proyecto_id}, fecha={self.fecha})"