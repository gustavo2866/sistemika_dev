from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .compras import PoOrder


class PoOrderArchivo(Base, table=True):
    """Archivos adjuntos a una orden de compra."""

    __tablename__ = "po_orders_archivos"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "tipo"]

    order_id: int = Field(foreign_key="po_orders.id", index=True, description="Orden de compra a la que pertenece el archivo")
    nombre: str = Field(max_length=300, description="Nombre descriptivo del archivo")
    tipo: Optional[str] = Field(default=None, max_length=100, description="Tipo de archivo: cotizacion|factura|contrato|otro")
    archivo_url: str = Field(max_length=500, description="Path relativo o URL del archivo almacenado")
    mime_type: Optional[str] = Field(default=None, max_length=100, description="Tipo MIME del archivo")
    tamanio_bytes: Optional[int] = Field(default=None, description="Tamaño del archivo en bytes")

    order: Optional["PoOrder"] = Relationship(back_populates="archivos")
