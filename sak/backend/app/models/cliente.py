"""
Modelo para clientes/empresas receptoras de facturas xxx
"""

from typing import Optional
from sqlmodel import SQLModel, Field


class ClienteBase(SQLModel):
    """Modelo base para clientes"""
    razon_social: str = Field(index=True, description="Razón social completa")
    cuit: str = Field(unique=True, index=True, description="CUIT formato XX-XXXXXXXX-X")
    direccion: Optional[str] = Field(default=None, description="Domicilio completo")
    condicion_iva: Optional[str] = Field(default=None, description="Responsable Inscripto, Monotributista, etc.")
    email: Optional[str] = Field(default=None, description="Email de contacto")
    telefono: Optional[str] = Field(default=None, description="Teléfono de contacto")
    activo: bool = Field(default=True, description="Cliente activo")


class Cliente(ClienteBase, table=True):
    """Modelo de cliente para la base de datos"""
    __tablename__ = "clientes"
    
    id: Optional[int] = Field(default=None, primary_key=True)


class ClienteCreate(ClienteBase):
    """Modelo para crear cliente"""
    pass


class ClienteUpdate(SQLModel):
    """Modelo para actualizar cliente"""
    razon_social: Optional[str] = None
    cuit: Optional[str] = None
    direccion: Optional[str] = None
    condicion_iva: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    activo: Optional[bool] = None


class ClienteRead(ClienteBase):
    """Modelo para leer cliente"""
    id: int
