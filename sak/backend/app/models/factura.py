from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import DECIMAL
from .base import Base
from .comprobante import Comprobante

if TYPE_CHECKING:
    from .proveedor import Proveedor
    from .tipo_operacion import TipoOperacion
    from .factura_detalle import FacturaDetalle
    from .factura_impuesto import FacturaImpuesto
    from .user import User


class EstadoFactura(str, Enum):
    PENDIENTE = "pendiente"
    PROCESADA = "procesada"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"
    PAGADA = "pagada"
    ANULADA = "anulada"


class Factura(Base, table=True):
    """Modelo para facturas"""

    __tablename__ = "facturas"

    __searchable_fields__ = ["numero", "punto_venta"]

    numero: str = Field(max_length=50, description="Numero de factura")
    punto_venta: str = Field(max_length=10, description="Punto de venta")
    tipo_comprobante: str = Field(max_length=20, description="Tipo de comprobante (A, B, C, etc.)")

    fecha_emision: str = Field(description="Fecha de emision (formato ISO: YYYY-MM-DD)")
    fecha_vencimiento: Optional[str] = Field(default=None, description="Fecha de vencimiento (formato ISO: YYYY-MM-DD)")
    fecha_recepcion: datetime = Field(default_factory=datetime.now, description="Fecha de recepcion en sistema")

    subtotal: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Subtotal sin impuestos")
    total_impuestos: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total de impuestos")
    total: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total general")

    estado: str = Field(default="pendiente", description="Estado de la factura")
    observaciones: Optional[str] = Field(default=None, description="Observaciones")

    nombre_archivo_pdf: Optional[str] = Field(default=None, max_length=500, description="Nombre del archivo PDF original")
    ruta_archivo_pdf: Optional[str] = Field(default=None, max_length=1000, description="Ruta del archivo PDF")

    comprobante_id: Optional[int] = Field(
        default=None,
        foreign_key="comprobantes.id",
        description="ID del comprobante asociado",
    )
    proveedor_id: int = Field(foreign_key="proveedores.id", description="ID del proveedor")
    tipo_operacion_id: int = Field(foreign_key="tipos_operacion.id", description="ID del tipo de operacion")
    usuario_responsable_id: int = Field(foreign_key="users.id", description="ID del usuario responsable del gasto")

    proveedor: "Proveedor" = Relationship(back_populates="facturas")
    comprobante: Optional["Comprobante"] = Relationship(back_populates="factura")
    tipo_operacion: "TipoOperacion" = Relationship(back_populates="facturas")
    usuario_responsable: "User" = Relationship()
    detalles: List["FacturaDetalle"] = Relationship(back_populates="factura")
    impuestos: List["FacturaImpuesto"] = Relationship(back_populates="factura")

    def __str__(self) -> str:
        return f"Factura(id={self.id}, numero='{self.numero}', proveedor_id={self.proveedor_id})"
