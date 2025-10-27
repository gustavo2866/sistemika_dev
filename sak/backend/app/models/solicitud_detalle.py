from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DECIMAL, Column
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .articulo import Articulo
    from .solicitud import Solicitud

# comentario
class SolicitudDetalle(Base, table=True):
    """Items asociados a una solicitud"""

    __tablename__ = "solicitud_detalles"

    __searchable_fields__ = ["descripcion"]

    solicitud_id: int = Field(
        foreign_key="solicitudes.id",
        description="Solicitud a la que pertenece el detalle"
    )
    articulo_id: Optional[int] = Field(
        default=None,
        foreign_key="articulos.id",
        description="Articulo sugerido"
    )
    descripcion: str = Field(
        max_length=500,
        description="Descripcion de la necesidad"
    )
    unidad_medida: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Unidad de medida solicitada"
    )
    cantidad: Decimal = Field(
        sa_column=Column(DECIMAL(12, 3), nullable=False),
        description="Cantidad solicitada"
    )

    solicitud: "Solicitud" = Relationship(back_populates="detalles")
    articulo: Optional["Articulo"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"SolicitudDetalle(id={self.id}, solicitud_id={self.solicitud_id}, descripcion='{self.descripcion}')"
