from datetime import date
from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .nomina import Nomina
    from .partediario import ParteDiarioDetalle


class NominaLicencia(Base, table=True):
    __tablename__ = "nomina_licencias"
    __searchable_fields__: ClassVar[List[str]] = ["tipo_novedad", "comentario"]
    __auto_include_relations__: ClassVar[List[str]] = ["nomina"]

    nomina_id: int = Field(
        foreign_key="nominas.id",
        index=True,
        description="Empleado al que pertenece el registro de licencia",
    )
    tipo_novedad: str = Field(
        max_length=10,
        index=True,
        description="Tipo de novedad asociada: ACC, ENF o VAC",
    )
    fecha_desde: date = Field(
        description="Fecha de inicio de la licencia",
    )
    fecha_hasta: Optional[date] = Field(
        default=None,
        description="Fecha de fin de la licencia",
    )
    comentario: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Comentario o detalle asociado a la licencia",
    )
    documentos: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
        description="Listado de URLs de comprobantes o documentos asociados",
    )

    nomina: Optional["Nomina"] = Relationship()
    partes_diario_detalles: List["ParteDiarioDetalle"] = Relationship(back_populates="nomina_licencia")
