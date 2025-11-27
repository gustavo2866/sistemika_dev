from datetime import UTC, datetime, date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL, Index
from sqlmodel import Field, Relationship

from .base import Base
from .enums import EstadoOportunidad

if TYPE_CHECKING:
    from .crm_catalogos import (
        CRMCondicionPago,
        CRMMotivoPerdida,
        CRMTipoOperacion,
        Moneda,
    )
    from .crm_contacto import CRMContacto
    from .crm_evento import CRMEvento
    from .crm_mensaje import CRMMensaje
    from .crm_oportunidad_log_estado import CRMOportunidadLogEstado
    from .emprendimiento import Emprendimiento
    from .propiedad import Propiedad
    from .user import User


class CRMOportunidad(Base, table=True):
    __tablename__ = "crm_oportunidades"
    __searchable_fields__ = ["descripcion_estado"]
    __expanded_list_relations__ = {
        "contacto",
        "tipo_operacion",
        "propiedad",
        "moneda",
        "condicion_pago",
        "responsable",
    }
    __table_args__ = (
        Index("idx_crm_oportunidad_estado_fecha", "estado", "fecha_estado"),
        Index("idx_crm_oportunidad_tipo_estado", "tipo_operacion_id", "estado", "created_at"),
    )

    contacto_id: int = Field(foreign_key="crm_contactos.id", index=True)
    tipo_operacion_id: int = Field(foreign_key="crm_tipos_operacion.id", index=True)
    emprendimiento_id: Optional[int] = Field(
        default=None, foreign_key="emprendimientos.id", index=True
    )
    propiedad_id: int = Field(foreign_key="propiedades.id", index=True)
    estado: str = Field(
        default=EstadoOportunidad.ABIERTA.value,
        max_length=20,
        description="Estado del pipeline",
        index=True,
    )
    fecha_estado: datetime = Field(default_factory=lambda: datetime.now(UTC))
    motivo_perdida_id: Optional[int] = Field(default=None, foreign_key="crm_motivos_perdida.id")
    monto: Optional[Decimal] = Field(
        default=None, sa_column=Column(DECIMAL(15, 2), nullable=True)
    )
    moneda_id: Optional[int] = Field(default=None, foreign_key="monedas.id")
    condicion_pago_id: Optional[int] = Field(default=None, foreign_key="crm_condiciones_pago.id")
    probabilidad: Optional[int] = Field(default=None, ge=0, le=100)
    fecha_cierre_estimada: Optional[date] = Field(default=None)
    responsable_id: int = Field(foreign_key="users.id")
    descripcion_estado: Optional[str] = Field(default=None, max_length=1000)
    cotizacion_aplicada: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(18, 6), nullable=True),
        description="Tipo de cambio utilizado en Ganada/Reserva",
    )

    contacto: Optional["CRMContacto"] = Relationship(back_populates="oportunidades")
    tipo_operacion: Optional["CRMTipoOperacion"] = Relationship(back_populates="oportunidades")
    emprendimiento: Optional["Emprendimiento"] = Relationship(back_populates="oportunidades")
    propiedad: Optional["Propiedad"] = Relationship(back_populates="oportunidades")
    motivo_perdida: Optional["CRMMotivoPerdida"] = Relationship(back_populates="oportunidades")
    moneda: Optional["Moneda"] = Relationship(back_populates="oportunidades")
    condicion_pago: Optional["CRMCondicionPago"] = Relationship(back_populates="oportunidades")
    responsable: Optional["User"] = Relationship()
    logs_estado: list["CRMOportunidadLogEstado"] = Relationship(
        back_populates="oportunidad",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    eventos: list["CRMEvento"] = Relationship(back_populates="oportunidad")
    mensajes: list["CRMMensaje"] = Relationship(back_populates="oportunidad")

    def __str__(self) -> str:  # pragma: no cover
        return f"CRMOportunidad(id={self.id}, estado='{self.estado}')"
