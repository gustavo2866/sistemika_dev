from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm_oportunidad import CRMOportunidad


class TipoPropiedad(Base, table=True):
    """Catálogo de tipos de propiedad."""

    __tablename__ = "tipos_propiedad"
    __searchable_fields__ = ["nombre"]

    nombre: str = Field(max_length=100, description="Nombre del tipo de propiedad")
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True, description="Indica si el tipo está activo")

    oportunidades: list["CRMOportunidad"] = Relationship(back_populates="tipo_propiedad")

    def __str__(self) -> str:  # pragma: no cover
        return f"TipoPropiedad(id={self.id}, nombre='{self.nombre}')"
