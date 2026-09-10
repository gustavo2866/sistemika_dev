from datetime import date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlalchemy import Boolean, Column, DECIMAL, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm.contacto import CRMContacto
    from .nomina import Nomina
    from .nomina_catalogos import NominaCategoria, NominaTarea
    from .parte_diario_estado import ParteDiarioEstado
    from .partediario import ParteDiarioDetalle


class EstadoTarja(str, Enum):
    BORRADOR = "borrador"
    CERRADO = "cerrado"


class Tarja(Base, table=True):
    """Cabecera de tarja consolidada por proyecto y rango de fechas."""

    __tablename__ = "tarjas"
    __table_args__ = (
        UniqueConstraint("idproyecto", "contacto_id", "fechainicio", "fechafinal", name="uq_tarjas_proyecto_contacto_rango"),
    )

    __searchable_fields__: ClassVar[List[str]] = ["descripcion"]
    __auto_include_relations__: ClassVar[List[str]] = [
        "detalles.nomina.proyecto",
        "detalles.estado",
        "nomina_registros",
    ]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles", "nomina_registros"}

    idproyecto: int = Field(
        foreign_key="proyectos.id",
        description="Proyecto asociado a la tarja",
    )
    contacto_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_contactos.id",
        description="Contacto encargado que reporto la tarja",
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
    nomina_registros: List["TarjaNomina"] = Relationship(
        back_populates="tarja",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    contacto: Optional["CRMContacto"] = Relationship()


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


class TarjaNomina(Base, table=True):
    """Registro de nómina asociado a una tarja."""

    __tablename__ = "tarja_nomina"
    __table_args__ = (
        UniqueConstraint("tarja_id", "nomina_id", name="uq_tarja_nomina_tarja_nomina"),
    )
    # El endpoint expone las referencias como campos calculados resueltos en lote.
    # Evita que GenericCRUD agregue selectinload para todas las relaciones.
    __auto_include_relations__: ClassVar[List[str]] = []
    __calculated_fields__: ClassVar[List[str]] = [
        "empleado",
        "dni",
        "categoria_codigo",
        "actividad_codigo",
        "obra",
        "encargado",
        "tarja_fecha_desde",
        "tarja_fecha_hasta",
        "proyecto_id",
        "encargado_id",
        "tipo_novedad",
        "editable",
        *[f"D{day:02d}" for day in range(1, 16)],
    ]

    tarja_id: int = Field(
        foreign_key="tarjas.id",
        description="Tarja cabecera a la que pertenece el registro de nómina",
    )
    nomina_id: Optional[int] = Field(
        default=None,
        foreign_key="nominas.id",
        description="Empleado de nomina asociado al registro",
    )
    nomina_categoria_id: Optional[int] = Field(
        default=None,
        foreign_key="nomina_categorias.id",
        description="Categoria de nomina asociada",
    )
    nomina_tarea_id: Optional[int] = Field(
        default=None,
        foreign_key="nomina_tareas.id",
        description="Tarea de nomina asociada",
    )
    horas_justificadas: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(8, 2), nullable=False, server_default="0"),
        description="Total de horas justificadas",
    )
    presentismo: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
        description="Indica si corresponde presentismo",
    )
    presentismo_importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe por presentismo",
    )
    adicional_importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe adicional",
    )
    premio: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
        description="Indica si corresponde premio",
    )
    premio_importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe de premio",
    )
    viatico: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
        description="Indica si corresponde viatico",
    )
    viatico_importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe por viatico",
    )
    sueldo_importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe de sueldo",
    )
    mejora_importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe por mejora",
    )
    cargas_importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 2), nullable=False, server_default="0"),
        description="Importe por cargas",
    )
    fecha_desde: date = Field(
        description="Fecha de inicio del período asociado",
    )
    fecha_hasta: date = Field(
        description="Fecha de fin del período asociado",
    )
    observaciones: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Observaciones adicionales del registro de nómina",
    )
    documentos: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
        description="Listado de URLs de certificados u otros documentos",
    )

    tarja: "Tarja" = Relationship(back_populates="nomina_registros")
    nomina: Optional["Nomina"] = Relationship()
    nomina_categoria: Optional["NominaCategoria"] = Relationship()
    nomina_tarea: Optional["NominaTarea"] = Relationship()
