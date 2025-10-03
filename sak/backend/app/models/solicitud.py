from datetime import date
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Column, String
from sqlmodel import Field, Relationship

from .base import Base
from .user import User

if TYPE_CHECKING:
    from .solicitud_detalle import SolicitudDetalle


class TipoSolicitud(str, Enum):
    NORMAL = "normal"
    DIRECTA = "directa"


class Solicitud(Base, table=True):
    """Modelo principal para solicitudes de compra"""

    __tablename__ = "solicitudes"

    __searchable_fields__ = ["tipo", "comentario"]

    tipo: TipoSolicitud = Field(
        default=TipoSolicitud.NORMAL,
        sa_column=Column(String(20), nullable=False),
        description="Tipo de solicitud"
    )
    fecha_necesidad: date = Field(description="Fecha en la que se requiere la solicitud")
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentario adicional del solicitante"
    )
    solicitante_id: int = Field(
        foreign_key="users.id",
        description="Identificador del usuario solicitante"
    )

    solicitante: User = Relationship(back_populates="solicitudes")
    detalles: List["SolicitudDetalle"] = Relationship(
        back_populates="solicitud",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"Solicitud(id={self.id}, tipo='{self.tipo}', solicitante_id={self.solicitante_id})"
