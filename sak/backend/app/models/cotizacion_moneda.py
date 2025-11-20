from datetime import date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL, Index, UniqueConstraint
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm_catalogos import Moneda


class CotizacionMoneda(Base, table=True):
    __tablename__ = "cotizacion_moneda"
    __table_args__ = (
        UniqueConstraint(
            "moneda_origen_id",
            "moneda_destino_id",
            "fecha_vigencia",
            name="uq_cotizacion_monedas_fecha",
        ),
        Index(
            "idx_cotizacion_moneda_lookup",
            "moneda_origen_id",
            "moneda_destino_id",
            "fecha_vigencia",
        ),
    )

    moneda_origen_id: int = Field(foreign_key="monedas.id", index=True)
    moneda_destino_id: int = Field(foreign_key="monedas.id", index=True)
    tipo_cambio: Decimal = Field(sa_column=Column(DECIMAL(18, 6), nullable=False))
    fecha_vigencia: date = Field(description="Fecha desde la cual aplica la cotización")
    fuente: Optional[str] = Field(default=None, max_length=100, description="Fuente (BCRA, mercado, etc.)")

    moneda_origen: Optional["Moneda"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "cotizacion_moneda.c.moneda_origen_id"}
    )
    moneda_destino: Optional["Moneda"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "cotizacion_moneda.c.moneda_destino_id"}
    )
