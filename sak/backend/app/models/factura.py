from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, DECIMAL
from .base import Base
from .comprobante import Comprobante

if TYPE_CHECKING:
    from .proveedor import Proveedor
    from .tipo_operacion import TipoOperacion
    from .tipo_comprobante import TipoComprobante
    from .metodo_pago import MetodoPago
    from .propiedad import Propiedad
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
    id_tipocomprobante: int = Field(
        foreign_key="tipos_comprobante.id",
        description="Identificador del tipo de comprobante",
    )

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
    metodo_pago_id: int = Field(default=1, foreign_key="metodos_pago.id", description="ID del método de pago")
    registrado_por_id: int = Field(default=1, foreign_key="users.id", description="Usuario que registró la factura")
    propiedad_id: Optional[int] = Field(default=None, foreign_key="propiedades.id", description="Propiedad asociada si corresponde")

    proveedor: "Proveedor" = Relationship(back_populates="facturas")
    comprobante: Optional["Comprobante"] = Relationship(back_populates="factura")
    tipo_comprobante: "TipoComprobante" = Relationship(back_populates="facturas")
    metodo_pago: "MetodoPago" = Relationship(back_populates="facturas")
    propiedad: Optional["Propiedad"] = Relationship(back_populates="facturas")
    tipo_operacion: "TipoOperacion" = Relationship(back_populates="facturas")
    usuario_responsable: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "Factura.usuario_responsable_id"})
    registrado_por: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "Factura.registrado_por_id"})
    detalles: List["FacturaDetalle"] = Relationship(back_populates="factura")
    impuestos: List["FacturaImpuesto"] = Relationship(back_populates="factura")

    def __str__(self) -> str:
        return f"Factura(id={self.id}, numero='{self.numero}', proveedor_id={self.proveedor_id})"
