from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import DECIMAL
from .base import Base

if TYPE_CHECKING:
    from .factura import Factura

class FacturaDetalle(Base, table=True):
    """Modelo para detalles de factura (líneas de productos/servicios)"""
    __tablename__ = "factura_detalles"
    
    # Metadata para CRUD
    __searchable_fields__ = ["descripcion", "codigo_producto"]
    
    # Información del producto/servicio
    codigo_producto: Optional[str] = Field(default=None, max_length=50, description="Código del producto")
    descripcion: str = Field(max_length=500, description="Descripción del producto/servicio")
    
    # Cantidades y precios
    cantidad: Decimal = Field(sa_column=Column(DECIMAL(10, 3)), description="Cantidad")
    unidad_medida: Optional[str] = Field(default=None, max_length=10, description="Unidad de medida")
    precio_unitario: Decimal = Field(sa_column=Column(DECIMAL(15, 4)), description="Precio unitario")
    
    # Importes
    subtotal: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Subtotal (cantidad * precio_unitario)")
    porcentaje_descuento: Optional[Decimal] = Field(default=None, sa_column=Column(DECIMAL(5, 2)), description="Porcentaje de descuento")
    importe_descuento: Optional[Decimal] = Field(default=None, sa_column=Column(DECIMAL(15, 2)), description="Importe de descuento")
    
    # Impuestos
    porcentaje_iva: Decimal = Field(sa_column=Column(DECIMAL(5, 2)), description="Porcentaje de IVA aplicado")
    importe_iva: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Importe de IVA")
    
    # Total
    total_linea: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total de la línea")
    
    # Orden
    orden: int = Field(description="Orden de la línea en la factura")
    
    # Foreign key
    factura_id: int = Field(foreign_key="facturas.id", description="ID de la factura")
    
    # Relación
    factura: "Factura" = Relationship(back_populates="detalles")
    
    def __str__(self) -> str:
        return f"FacturaDetalle(id={self.id}, descripcion='{self.descripcion}', cantidad={self.cantidad})"
