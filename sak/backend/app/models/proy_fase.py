from __future__ import annotations

from typing import Optional

from sqlmodel import Field

from .base import Base


class ProyFase(Base, table=True):
    """Entidad de fases de proyectos para organizar etapas de construcción."""

    __tablename__ = "proy_fases"

    __searchable_fields__ = ["nombre"]

    nombre: str = Field(
        max_length=100,
        description="Nombre de la fase del proyecto"
    )
    orden: int = Field(
        description="Orden de secuencia de la fase"
    )
    activo: bool = Field(
        default=True,
        description="Indica si la fase está activa"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción detallada de la fase"
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"ProyFase(id={self.id}, nombre='{self.nombre}', orden={self.orden})"
