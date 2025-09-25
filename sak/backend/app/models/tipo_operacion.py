from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .factura import Factura

class TipoOperacion(Base, table=True):
    """Modelo para tipos de operación fiscal"""
    __tablename__ = "tipos_operacion"
    
    # Metadata para CRUD
    __searchable_fields__ = ["codigo", "descripcion"]
    
    # Campos básicos
    codigo: str = Field(max_length=10, description="Código de tipo de operación", unique=True)
    descripcion: str = Field(max_length=255, description="Descripción del tipo de operación")
    
    # Configuración fiscal
    requiere_iva: bool = Field(default=True, description="Si aplica IVA")
    porcentaje_iva_default: Optional[float] = Field(default=21.0, description="Porcentaje de IVA por defecto")
    
    # Configuración contable
    cuenta_contable: Optional[str] = Field(default=None, max_length=20, description="Cuenta contable asociada")
    
    # Estado
    activo: bool = Field(default=True, description="Si el tipo está activo")
    
    # Relaciones
    facturas: List["Factura"] = Relationship(back_populates="tipo_operacion")
    
    def __str__(self) -> str:
        return f"TipoOperacion(id={self.id}, codigo='{self.codigo}', descripcion='{self.descripcion}')"
