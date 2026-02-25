from typing import ClassVar, List, Optional

from sqlmodel import Field

from .base import Base


class TipoActualizacion(Base, table=True):
    """Tipos de actualización para contratos y tarifas."""

    __tablename__ = "tipos_actualizacion"

    __searchable_fields__: ClassVar[List[str]] = ["nombre"]

    nombre: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="Nombre del tipo de actualización"
    )
    
    cantidad_meses: int = Field(
        description="Cantidad de meses para la actualización"
    )
    
    activa: bool = Field(
        default=True,
        description="Indica si el tipo de actualización está activa"
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"TipoActualizacion(id={self.id}, nombre='{self.nombre}', meses={self.cantidad_meses})"