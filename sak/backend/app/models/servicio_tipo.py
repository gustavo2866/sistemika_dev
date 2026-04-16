from typing import Optional

from sqlmodel import Field

from .base import Base


class ServicioTipo(Base, table=True):
    """Catálogo de tipos de servicio."""

    __tablename__ = "servicios_tipo"
    __searchable_fields__ = ["nombre", "url"]

    nombre: str = Field(max_length=200, description="Nombre del tipo de servicio")
    url: Optional[str] = Field(default=None, max_length=500, description="URL del servicio")
    activo: bool = Field(default=True, description="Indica si el tipo está activo")

    def __str__(self) -> str:  # pragma: no cover
        return f"ServicioTipo(id={self.id}, nombre='{self.nombre}')"
