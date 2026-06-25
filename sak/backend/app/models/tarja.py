from datetime import date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlalchemy import Column, DECIMAL, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .nomina import Nomina
    from .parte_diario_estado import ParteDiarioEstado
    from .partediario import ParteDiarioDetalle


class EstadoTarja(str, Enum):
    BORRADOR = "borrador"
    CERRADO = "cerrado"


class Tarja(Base, table=True):
    """Cabecera de tarja consolidada por proyecto y rango de fechas."""

    __tablename__ = "tarjas"

    __searchable_fields__: ClassVar[List[str]] = ["descripcion"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles", "novedades"}

    idproyecto: int = Field(
        foreign_key="proyectos.id",
        description="Proyecto asociado a la tarja",
    )
    fechainicio: date = Field(
        description="Fecha de inicio del rango de la tarja",
    )
    fechafinal: date = Field(
        description="Fecha de fin del rango de la tarja",
    )
    estado: EstadoTarja = Field(
        default=EstadoTarja.BORRADOR,
        sa_column=Column(String(20), nullable=False),
        description="Estado de la tarja",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Descripcion general de la tarja",
    )

    detalles: List["TarjaDetalle"] = Relationship(
        back_populates="tarja",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    novedades: List["TarjaNovedad"] = Relationship(
        back_populates="tarja",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class TarjaDetalle(Base, table=True):
    """Detalle diario por empleado dentro de una tarja."""

    __tablename__ = "tarja_detalles"
    __table_args__ = (
        UniqueConstraint("tarja_id", "idnomina", "fecha", name="uq_tarja_detalles_tarja_nomina_fecha"),
    )

    __searchable_fields__: ClassVar[List[str]] = ["descripcion"]

    tarja_id: int = Field(
        foreign_key="tarjas.id",
        description="Tarja cabecera a la que pertenece el detalle",
    )
    idnomina: Optional[int] = Field(
        default=None,
        foreign_key="nominas.id",
        description="Empleado asociado al detalle de tarja",
    )
    fecha: date = Field(
        description="Fecha del detalle dentro de la tarja",
    )
    idestado: Optional[int] = Field(
        default=None,
        foreign_key="parte_diario_estados.id",
        description="Estado diario del empleado",
    )
    horas: Decimal = Field(
        sa_column=Column(DECIMAL(5, 2), nullable=False),
        description="Cantidad de horas del detalle",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Observaciones del detalle",
    )
    parte_diario_detalle_id: Optional[int] = Field(
        default=None,
        foreign_key="partes_diario_detalles.id",
        description="Referencia opcional al detalle de parte diario de origen",
    )

    tarja: "Tarja" = Relationship(back_populates="detalles")
    nomina: Optional["Nomina"] = Relationship()
    estado: Optional["ParteDiarioEstado"] = Relationship()
    parte_diario_detalle: Optional["ParteDiarioDetalle"] = Relationship()


class TarjaNovedad(Base, table=True):
    """Resumen de novedades y ajustes de una tarja."""

    __tablename__ = "tarja_novedades"
    __table_args__ = (
        UniqueConstraint("tarja_id", name="uq_tarja_novedades_tarja"),
    )

    tarja_id: int = Field(
        foreign_key="tarjas.id",
        description="Tarja cabecera a la que pertenecen las novedades",
    )
    horas_enfermedad_justif: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(8, 2), nullable=False, server_default="0"),
        description="Total de horas justificadas por enfermedad",
    )
    presentismo: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe de presentismo",
    )
    premio: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe de premio",
    )
    observaciones: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Observaciones adicionales de la novedad",
    )
    documentos: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
        description="Listado de URLs de certificados u otros documentos",
    )

    tarja: "Tarja" = Relationship(back_populates="novedades")
