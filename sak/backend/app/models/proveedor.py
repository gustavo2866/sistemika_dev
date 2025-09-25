from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .factura import Factura

class Proveedor(Base, table=True):
    """Modelo para proveedores"""
    __tablename__ = "proveedores"
    
    # Metadata para CRUD
    __searchable_fields__ = ["nombre", "cuit", "razon_social"]
    
    # Campos básicos
    nombre: str = Field(max_length=255, description="Nombre comercial del proveedor")
    razon_social: str = Field(max_length=255, description="Razón social")
    cuit: str = Field(max_length=15, description="CUIT del proveedor", unique=True)
    
    # Datos de contacto
    telefono: Optional[str] = Field(default=None, max_length=20, description="Teléfono")
    email: Optional[str] = Field(default=None, max_length=255, description="Email")
    direccion: Optional[str] = Field(default=None, max_length=500, description="Dirección")
    
    # Datos bancarios
    cbu: Optional[str] = Field(default=None, max_length=22, description="CBU")
    alias_bancario: Optional[str] = Field(default=None, max_length=100, description="Alias bancario")
    
    # Estado
    activo: bool = Field(default=True, description="Si el proveedor está activo")
    
    # Relaciones
    facturas: List["Factura"] = Relationship(back_populates="proveedor")
    
    def __str__(self) -> str:
        return f"Proveedor(id={self.id}, nombre='{self.nombre}', cuit='{self.cuit}')"
