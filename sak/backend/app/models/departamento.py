"""
Modelo para Departamento
"""
from typing import Optional
from sqlmodel import Field
from app.models.base import Base


class Departamento(Base, table=True):
    """
    Modelo de tabla Departamento
    
    Representa los diferentes departamentos de la empresa
    que pueden generar solicitudes.
    """
    __tablename__ = "departamentos"
    __searchable_fields__ = ["nombre", "descripcion"]
    
    nombre: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="Nombre del departamento (único)"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción del departamento"
    )
    activo: bool = Field(
        default=True,
        description="Indica si el departamento está activo"
    )
