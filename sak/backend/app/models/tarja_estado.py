from typing import ClassVar, List

from sqlmodel import Field

from .base import Base


class TarjaEstado(Base, table=True):
    """Tabla de estados posibles para el detalle de tarja."""

    __tablename__ = "tarja_estados"

    __searchable_fields__: ClassVar[List[str]] = ["nombre", "abreviatura"]

    abreviatura: str = Field(
        max_length=10,
        unique=True,
        index=True,
        description="Abreviatura del estado (ej: P, ENF, ACC)",
    )
    nombre: str = Field(
        max_length=100,
        description="Descripcion completa del estado",
    )
    activo: bool = Field(
        default=True,
        description="Indica si el estado esta disponible para usar",
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"TarjaEstado(id={self.id}, abreviatura='{self.abreviatura}', nombre='{self.nombre}')"
