from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import DECIMAL
from .base import Base

if TYPE_CHECKING:
    from .factura import Factura

class FacturaImpuesto(Base, table=True):
    """Modelo para impuestos de factura (IVA, percepciones, retenciones, etc.)"""
    __tablename__ = "factura_impuestos"
    
    # Metadata para CRUD
    __searchable_fields__ = ["tipo_impuesto", "descripcion"]
    
    # Tipo de impuesto
    tipo_impuesto: str = Field(max_length=50, description="Tipo de impuesto (IVA, IIBB, Ganancias, etc.)")
    descripcion: str = Field(max_length=255, description="Descripción del impuesto")
    
    # Base y porcentaje
    base_imponible: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Base imponible")
    porcentaje: Decimal = Field(sa_column=Column(DECIMAL(5, 4)), description="Porcentaje del impuesto")
    
    # Importes
    importe: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Importe del impuesto")
    
    # Clasificación
    es_retencion: bool = Field(default=False, description="Si es una retención")
    es_percepcion: bool = Field(default=False, description="Si es una percepción")
    
    # Datos adicionales
    codigo_afip: Optional[str] = Field(default=None, max_length=20, description="Código AFIP del impuesto")
    numero_certificado: Optional[str] = Field(default=None, max_length=50, description="Número de certificado (para retenciones)")
    
    # Foreign key
    factura_id: int = Field(foreign_key="facturas.id", description="ID de la factura")
    
    # Relación
    factura: "Factura" = Relationship(back_populates="impuestos")
    
    def __str__(self) -> str:
        return f"FacturaImpuesto(id={self.id}, tipo='{self.tipo_impuesto}', importe={self.importe})"
