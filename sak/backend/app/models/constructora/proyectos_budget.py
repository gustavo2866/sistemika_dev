from datetime import date
from decimal import Decimal
from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL, Integer, String
from sqlmodel import Field, Relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.proyecto import Proyecto
    from app.models.constructora.proyectos_conceptos import ProyectosConceptos
    from app.models.constructora.proyectos_macrorubros import ProyectosMacrorubros


class ProyectosBudget(Base, table=True):
    __tablename__ = "proyectos_budget"

    __searchable_fields__: ClassVar[List[str]] = ["descripcion"]
    __expanded_list_relations__: ClassVar[set[str]] = {
        "proyecto",
        "proyectos_concepto",
        "proyectos_macrorubro",
    }

    fecha: date = Field(description="Fecha del registro")
    proyecto_id: int = Field(foreign_key="proyectos.id", description="ID del proyecto")
    proyectos_concepto_id: int = Field(
        foreign_key="proyectos_conceptos.id",
        description="ID del concepto de proyecto",
    )
    proyectos_macrorubro_id: int = Field(
        foreign_key="proyectos_macrorubros.id",
        description="ID del macrorubro de proyecto",
    )
    importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe del registro",
    )
    descripcion: Optional[str] = Field(
        default=None,
        sa_column=Column(String(500), nullable=True),
        description="Descripcion del registro",
    )
    horas: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(10, 2), nullable=False, server_default="0"),
        description="Cantidad de horas",
    )
    empleados: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default="0"),
        description="Cantidad de empleados",
    )
    valor_hora: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Valor por hora",
    )

    proyecto: Optional["Proyecto"] = Relationship()
    proyectos_concepto: Optional["ProyectosConceptos"] = Relationship()
    proyectos_macrorubro: Optional["ProyectosMacrorubros"] = Relationship()

    def __repr__(self) -> str:
        return (
            f"ProyectosBudget(id={self.id}, fecha={self.fecha}, proyecto_id={self.proyecto_id}, "
            f"proyectos_concepto_id={self.proyectos_concepto_id}, "
            f"proyectos_macrorubro_id={self.proyectos_macrorubro_id})"
        )
