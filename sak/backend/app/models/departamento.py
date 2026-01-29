"""
Modelo para Departamento
"""
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from .centro_costo import CentroCosto
    from .user import User


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
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="ID del centro de costo asociado"
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

    # Relationships
    centro_costo: Optional["CentroCosto"] = Relationship(back_populates="departamentos")
    usuarios: List["User"] = Relationship(back_populates="departamento")
