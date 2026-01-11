"""
Modelo para Tipo de Solicitud
"""
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from .tipo_articulo import TipoArticulo


class TipoSolicitud(Base, table=True):
    """
    Modelo de tabla TipoSolicitud
    
    Representa los diferentes tipos de solicitudes parametrizables.
    Cada tipo puede tener configuraciones específicas como filtros de artículos,
    valores default, etc.
    """
    __tablename__ = "tipos_solicitud"
    __searchable_fields__ = ["nombre", "descripcion"]
    
    nombre: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="Nombre del tipo de solicitud (único)"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción del tipo de solicitud"
    )
    tipo_articulo_filter: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Filtro para tipo de artículo (string simple - DEPRECATED)"
    )
    tipo_articulo_filter_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_articulo.id",
        description="ID del tipo de artículo para filtrar"
    )
    articulo_default_id: Optional[int] = Field(
        default=None,
        foreign_key="articulos.id",
        description="ID del artículo por defecto (opcional)"
    )
    departamento_default_id: Optional[int] = Field(
        default=None,
        foreign_key="departamentos.id",
        description="ID del departamento por defecto (opcional)"
    )
    activo: bool = Field(
        default=True,
        description="Indica si el tipo de solicitud está activo"
    )

    # Relationships
    tipo_articulo_filter_rel: Optional["TipoArticulo"] = Relationship()
