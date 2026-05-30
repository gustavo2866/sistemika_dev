from typing import ClassVar, List

from sqlmodel import Field

from .base import Base


class ParteDiarioEstado(Base, table=True):
    """Tabla de estados posibles para el detalle de parte diario."""

    __tablename__ = "parte_diario_estados"

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
        return f"ParteDiarioEstado(id={self.id}, abreviatura='{self.abreviatura}', nombre='{self.nombre}')"
