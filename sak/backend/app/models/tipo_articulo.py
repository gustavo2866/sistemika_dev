"""
Modelo para Tipo de Artículo
"""
from typing import TYPE_CHECKING, ClassVar, List, Optional
from sqlmodel import Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from .articulo import Articulo
    from .adm import AdmConcepto


class TipoArticulo(Base, table=True):
    """
    Modelo de tabla TipoArticulo
    
    Representa los diferentes tipos de artículos parametrizables.
    Define categorías como Material, Ferretería, Herramienta, etc.
    """
    __tablename__ = "tipos_articulo"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "descripcion"]
    
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
    adm_concepto_id: int = Field(
        foreign_key="adm_conceptos.id",
        description="ID del concepto administrativo asociado",
    )
    activo: bool = Field(
        default=True,
        description="Indica si el tipo de artículo está activo"
    )

    # Relationships
    articulos: List["Articulo"] = Relationship(back_populates="tipo_articulo_rel")
    concepto: Optional["AdmConcepto"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"TipoArticulo(id={self.id}, nombre='{self.nombre}', concepto_id={self.adm_concepto_id})"
