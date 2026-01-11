"""
Modelo para Tipo de Artículo
"""
from typing import TYPE_CHECKING, ClassVar, List, Optional
from sqlmodel import Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from .articulo import Articulo


class TipoArticulo(Base, table=True):
    """
    Modelo de tabla TipoArticulo
    
    Representa los diferentes tipos de artículos parametrizables.
    Define categorías como Material, Ferretería, Herramienta, etc.
    """
    __tablename__ = "tipos_articulo"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "descripcion", "codigo_contable"]
    
    nombre: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="Nombre del tipo de artículo (único)"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción detallada del tipo de artículo"
    )
    codigo_contable: str = Field(
        max_length=50,
        index=True,
        description="Código contable del tipo de artículo"
    )
    activo: bool = Field(
        default=True,
        description="Indica si el tipo de artículo está activo"
    )

    # Relationships
    articulos: List["Articulo"] = Relationship(back_populates="tipo_articulo_rel")

    def __str__(self) -> str:  # pragma: no cover
        return f"TipoArticulo(id={self.id}, nombre='{self.nombre}', codigo='{self.codigo_contable}')"