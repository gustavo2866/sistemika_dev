from datetime import date
from decimal import Decimal
from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlalchemy import DECIMAL, Column
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm.contacto import CRMContacto
    from .nomina_catalogos import NominaCategoria, NominaTarea
    from .proyecto import Proyecto


class Nomina(Base, table=True):
    """Datos de empleados para la gestion de nominas."""

    __tablename__ = "nominas"

    __searchable_fields__ = ["nombre", "apellido", "dni", "email", "nro_legajo"]
    __auto_include_relations__: ClassVar[List[str]] = ["proyecto", "nomina_categoria", "nomina_tarea"]

    nombre: str = Field(max_length=120, description="Nombre del empleado")
    apellido: str = Field(max_length=120, description="Apellido del empleado")
    dni: str = Field(
        max_length=20,
        index=True,
        description="Documento de identidad",
    )
    email: Optional[str] = Field(
        default=None,
        max_length=255,
        unique=True,
        description="Correo de contacto",
    )
    telefono: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Telefono de contacto",
    )
    direccion: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Direccion principal",
    )
    fecha_nacimiento: Optional[date] = Field(
        default=None,
        description="Fecha de nacimiento del empleado",
    )
    fecha_ingreso: Optional[date] = Field(
        default=None,
        description="Fecha de ingreso a la empresa",
    )
    fecha_egreso: Optional[date] = Field(
        default=None,
        description="Fecha de egreso de la empresa",
    )
    nro_legajo: Optional[str] = Field(
        default=None,
        max_length=10,
        description="Numero de legajo del empleado",
    )
    salario_mensual: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(12, 2)),
        description="Salario bruto mensual",
    )
    url_foto: Optional[str] = Field(
        default=None,
        max_length=500,
        description="URL de la fotografia del empleado",
    )
    nomina_categoria_id: Optional[int] = Field(
        default=None,
        foreign_key="nomina_categorias.id",
        description="Categoria laboral del empleado",
    )
    nomina_tarea_id: Optional[int] = Field(
        default=None,
        foreign_key="nomina_tareas.id",
        description="Tarea principal del empleado",
    )
    idproyecto: Optional[int] = Field(
        default=None,
        foreign_key="proyectos.id",
        description="Proyecto asociado al empleado",
    )
    encargado_contacto_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_contactos.id",
        description="Contacto encargado al que reporta el empleado",
    )
    activo: bool = Field(
        default=True,
        description="Indicador de empleado activo en la nomina",
    )

    proyecto: Optional["Proyecto"] = Relationship()
    nomina_categoria: Optional["NominaCategoria"] = Relationship()
    nomina_tarea: Optional["NominaTarea"] = Relationship()
    encargado_contacto: Optional["CRMContacto"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"Nomina(id={self.id}, nombre='{self.nombre} {self.apellido}')"
