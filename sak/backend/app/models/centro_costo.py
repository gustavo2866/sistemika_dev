from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .solicitud import Solicitud


class CentroCosto(Base, table=True):
    """Centros de costo para imputación de solicitudes y facturas."""

    __tablename__ = "centros_costo"

    __searchable_fields__: ClassVar[List[str]] = ["nombre", "codigo_contable", "tipo"]

    nombre: str = Field(
        max_length=200,
        unique=True,
        index=True,
        description="Nombre del centro de costo"
    )
    tipo: str = Field(
        max_length=50,
        index=True,
        description="Tipo: Proyecto, Propiedad, Socios, General"
    )
    codigo_contable: str = Field(
        max_length=50,
        index=True,
        description="Código contable del centro de costo"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Descripción detallada del centro de costo"
    )
    activo: bool = Field(
        default=True,
        description="Indica si el centro de costo está activo"
    )

    # Relationships
    solicitudes: List["Solicitud"] = Relationship(back_populates="centro_costo")

    def __str__(self) -> str:  # pragma: no cover
        return f"CentroCosto(id={self.id}, nombre='{self.nombre}', tipo='{self.tipo}')"
