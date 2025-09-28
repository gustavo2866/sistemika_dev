from typing import List, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura

DEFAULT_METODOS_PAGO = (
    "Caja",
    "Cheque",
    "Pago Facil",
)


class MetodoPago(Base, table=True):
    """Catálogo de métodos de pago disponibles."""

    __tablename__ = "metodos_pago"

    nombre: str = Field(max_length=100, unique=True, index=True)

    facturas: List["Factura"] = Relationship(back_populates="metodo_pago")

    def __str__(self) -> str:  # pragma: no cover
        return f"MetodoPago(id={self.id}, nombre='{self.nombre}')"
