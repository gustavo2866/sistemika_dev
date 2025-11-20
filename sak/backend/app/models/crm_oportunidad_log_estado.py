from datetime import UTC, datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm_catalogos import CRMCondicionPago, CRMMotivoPerdida, Moneda
    from .crm_oportunidad import CRMOportunidad
    from .user import User


class CRMOportunidadLogEstado(Base, table=True):
    __tablename__ = "crm_oportunidad_log_estado"
    __searchable_fields__ = ["estado_nuevo", "estado_anterior"]

    oportunidad_id: int = Field(foreign_key="crm_oportunidades.id", index=True)
    estado_anterior: str = Field(max_length=20)
    estado_nuevo: str = Field(max_length=20)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    usuario_id: int = Field(foreign_key="users.id")
    fecha_registro: datetime = Field(default_factory=lambda: datetime.now(UTC))
    motivo_perdida_id: Optional[int] = Field(default=None, foreign_key="crm_motivos_perdida.id")
    monto: Optional[Decimal] = Field(default=None, sa_column=Column(DECIMAL(15, 2)))
    moneda_id: Optional[int] = Field(default=None, foreign_key="monedas.id")
    condicion_pago_id: Optional[int] = Field(default=None, foreign_key="crm_condiciones_pago.id")

    oportunidad: Optional["CRMOportunidad"] = Relationship(back_populates="logs_estado")
    motivo_perdida: Optional["CRMMotivoPerdida"] = Relationship()
    moneda: Optional["Moneda"] = Relationship()
    condicion_pago: Optional["CRMCondicionPago"] = Relationship()
    usuario: Optional["User"] = Relationship()
