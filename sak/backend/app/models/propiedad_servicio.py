from datetime import date
from typing import Optional, TYPE_CHECKING, ClassVar, List

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .propiedad import Propiedad
    from .servicio_tipo import ServicioTipo


class PropiedadServicio(Base, table=True):
    """Servicios vinculados a una propiedad."""

    __tablename__ = "propiedades_servicios"
    __auto_include_relations__: ClassVar[List[str]] = ["servicio_tipo"]
    __searchable_fields__: ClassVar[List[str]] = ["ref_cliente", "comentario"]

    propiedad_id: int = Field(
        foreign_key="propiedades.id",
        index=True,
        description="Propiedad a la que pertenece el servicio",
    )
    servicio_tipo_id: Optional[int] = Field(
        default=None,
        foreign_key="servicios_tipo.id",
        index=True,
        description="Tipo de servicio",
    )
    ref_cliente: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Referencia de cliente o número de cuenta en el servicio",
    )
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentario u observaciones sobre el servicio",
    )
    fecha: Optional[date] = Field(
        default=None,
        description="Fecha asociada al servicio",
    )
    activo: bool = Field(
        default=True,
        description="Indica si el servicio está activo",
    )

    propiedad: Optional["Propiedad"] = Relationship(back_populates="servicios")
    servicio_tipo: Optional["ServicioTipo"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"PropiedadServicio(id={self.id}, propiedad_id={self.propiedad_id})"
