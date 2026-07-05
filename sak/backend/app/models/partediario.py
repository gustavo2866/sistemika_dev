from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL, Index, String, UniqueConstraint, text
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm.contacto import CRMContacto
    from .nomina import Nomina
    from .parte_diario_estado import ParteDiarioEstado


class EstadoParteDiario(str, Enum):
    BORRADOR = "borrador"   # generado por el agente, editable
    CONFIRMADO = "confirmado"  # confirmado por el agente o backoffice, listo para tarja
    CERRADO = "cerrado"  # tarja generada desde el parte diario


class OrigenDetalle(str, Enum):
    AGENTE = "agente"       # informado explícitamente por el encargado
    DEFAULT = "default"     # presente implícito generado al confirmar


class ParteDiario(Base, table=True):
    """Cabecera del parte diario de obra."""

    __tablename__ = "partes_diario"
    __table_args__ = (
        Index(
            "uq_partes_diario_proyecto_fecha_contacto_activo",
            "idproyecto",
            "fecha",
            "contacto_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )

    __searchable_fields__: ClassVar[List[str]] = ["descripcion"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles"}

    idproyecto: int = Field(
        foreign_key="proyectos.id",
        description="Proyecto asociado al parte diario",
    )
    contacto_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_contactos.id",
        description="Contacto encargado que reporto el parte diario",
    )
    fecha: date = Field(
        description="Fecha del parte diario",
    )
    estado: EstadoParteDiario = Field(
        default=EstadoParteDiario.BORRADOR,
        sa_column=Column(String(20), nullable=False),
        description="Estado del parte diario",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Descripción general de las novedades del día",
    )
    mensaje_origen_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_mensajes.id",
        description="Mensaje de WhatsApp que originó o confirmó este parte (trazabilidad con el agente)",
    )

    detalles: List["ParteDiarioDetalle"] = Relationship(
        back_populates="parte_diario",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    contacto: Optional["CRMContacto"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"ParteDiario(id={self.id}, proyecto={self.idproyecto}, fecha={self.fecha})"


class ParteDiarioDetalle(Base, table=True):
    """Detalle horario de un parte diario."""

    __tablename__ = "partes_diario_detalles"
    __table_args__ = (
        UniqueConstraint(
            "parte_diario_id",
            "idnomina",
            name="uq_partes_diario_detalles_parte_nomina",
        ),
    )

    __searchable_fields__: ClassVar[List[str]] = ["descripcion"]

    parte_diario_id: int = Field(
        foreign_key="partes_diario.id",
        description="Identificador del parte diario padre",
    )
    idnomina: Optional[int] = Field(
        default=None,
        foreign_key="nominas.id",
        description="Empleado asociado al parte diario (None si es persona no registrada en nómina)",
    )
    nombre_provisorio: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Nombre de la persona cuando aún no está registrada en nómina",
    )
    horas: Decimal = Field(
        sa_column=Column(DECIMAL(5, 2), nullable=False),
        description="Cantidad de horas trabajadas",
    )
    idestado: Optional[int] = Field(
        default=None,
        foreign_key="parte_diario_estados.id",
        description="Estado del empleado en el parte (presente, enfermedad, etc.)",
    )
    ingreso: Optional[datetime] = Field(
        default=None,
        description="Hora de ingreso del empleado",
    )
    egreso: Optional[datetime] = Field(
        default=None,
        description="Hora de egreso del empleado",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Observaciones o tareas realizadas",
    )
    origen: OrigenDetalle = Field(
        default=OrigenDetalle.AGENTE,
        sa_column=Column(String(10), nullable=False, server_default="agente"),
        description="Indica si la línea fue informada por el encargado (agente) o generada como presente implícito (default)",
    )

    parte_diario: "ParteDiario" = Relationship(back_populates="detalles")
    nomina: Optional["Nomina"] = Relationship()
    estado: Optional["ParteDiarioEstado"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"ParteDiarioDetalle(id={self.id}, parte_diario_id={self.parte_diario_id}, idnomina={self.idnomina})"
