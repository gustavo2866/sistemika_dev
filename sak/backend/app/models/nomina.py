from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import DECIMAL, Column, String
from sqlmodel import Field

from .base import Base


class CategoriaNomina(str, Enum):
    OFICIAL = "oficial"
    MEDIO_OFICIAL = "medio_oficial"
    AYUDANTE = "ayudante"
    ADMINISTRATIVO = "administrativo"


class Nomina(Base, table=True):
    """Datos de empleados para la gestion de nominas."""

    __tablename__ = "nominas"

    __searchable_fields__ = ["nombre", "apellido", "dni", "email"]

    nombre: str = Field(max_length=120, description="Nombre del empleado")
    apellido: str = Field(max_length=120, description="Apellido del empleado")
    dni: str = Field(
        max_length=20,
        unique=True,
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
    categoria: CategoriaNomina = Field(
        default=CategoriaNomina.AYUDANTE,
        sa_column=Column(String(32), nullable=False),
        description="Categoria laboral del empleado",
    )
    idproyecto: Optional[int] = Field(
        default=None,
        foreign_key="proyectos.id",
        description="Proyecto asociado al empleado",
    )
    activo: bool = Field(
        default=True,
        description="Indicador de empleado activo en la nomina",
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"Nomina(id={self.id}, nombre='{self.nombre} {self.apellido}', categoria='{self.categoria}')"
