from typing import List, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura

DEFAULT_TIPO_COMPROBANTE_NAMES = (
    "Factura A",
    "Factura B",
    "Factura C",
    "Factura M",
    "NC A",
    "NC B",
    "NC C",
)


class TipoComprobante(Base, table=True):
    """Catalogo de tipos de comprobante (Factura A, Nota de Credito, etc.)."""

    __tablename__ = "tipos_comprobante"

    name: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="Descripcion legible del tipo de comprobante",
    )

    facturas: List["Factura"] = Relationship(back_populates="tipo_comprobante")

    def __str__(self) -> str:  # pragma: no cover - representacion auxiliar
        return f"TipoComprobante(id={self.id}, name='{self.name}')"
