from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, DECIMAL
from sqlmodel import Field

from .base import Base


class Proyecto(Base, table=True):
    """Entidad de proyectos para planificar obras o iniciativas."""

    __tablename__ = "proyectos"

    __searchable_fields__ = ["nombre", "estado"]

    nombre: str = Field(
        max_length=150,
        description="Nombre del proyecto"
    )
    fecha_inicio: Optional[date] = Field(
        default=None,
        description="Fecha de inicio del proyecto"
    )
    fecha_final: Optional[date] = Field(
        default=None,
        description="Fecha estimada de finalizacion del proyecto"
    )
    estado: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Estado actual del proyecto"
    )
    importe_mat: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe previsto para materiales"
    )
    importe_mo: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe previsto para mano de obra"
    )
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentarios adicionales sobre el proyecto"
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"Proyecto(id={self.id}, nombre='{self.nombre}')"
