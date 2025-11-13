from datetime import date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlalchemy import Column, String, DECIMAL
from sqlmodel import Field, Relationship

from .base import Base
from .user import User

if TYPE_CHECKING:
    from .solicitud_detalle import SolicitudDetalle
    from .centro_costo import CentroCosto


class EstadoSolicitud(str, Enum):
    """Estados posibles de una solicitud"""
    PENDIENTE = "pendiente"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"
    EN_PROCESO = "en_proceso"
    FINALIZADA = "finalizada"


class Solicitud(Base, table=True):
    """Modelo principal para solicitudes de compra"""

    __tablename__ = "solicitudes"

    __searchable_fields__: ClassVar[List[str]] = ["comentario"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles", "centro_costo"}

    tipo_solicitud_id: int = Field(
        foreign_key="tipos_solicitud.id",
        description="Identificador del tipo de solicitud"
    )
    departamento_id: int = Field(
        foreign_key="departamentos.id",
        description="Identificador del departamento"
    )
    estado: EstadoSolicitud = Field(
        default=EstadoSolicitud.PENDIENTE,
        sa_column=Column(String(20), nullable=False),
        description="Estado de la solicitud"
    )
    total: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(15, 2), nullable=False, server_default="0"),
        description="Total de la solicitud (calculado por frontend)"
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
    centro_costo_id: int = Field(
        foreign_key="centros_costo.id",
        description="Centro de costo al que se imputa la solicitud"
    )

    solicitante: User = Relationship(back_populates="solicitudes")
    centro_costo: "CentroCosto" = Relationship(back_populates="solicitudes")
    detalles: List["SolicitudDetalle"] = Relationship(
        back_populates="solicitud",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"Solicitud(id={self.id}, estado='{self.estado}', solicitante_id={self.solicitante_id})"
