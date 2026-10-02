from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import ClassVar, List, Optional

from sqlalchemy import BigInteger, Column, DateTime, Numeric, SmallInteger, func
from sqlmodel import Field

from app.models.base import Base


class ErpCashDiario(Base, table=True):
    __tablename__ = "erp_cash_diarios"

    __searchable_fields__: ClassVar[List[str]] = [
        "descripcion",
        "tipo_asiento",
        "nro_asiento",
        "nro_subcuenta",
        "centro_costo",
        "rubro",
        "cash",
    ]

    source_id: int = Field(
        sa_column=Column(BigInteger, nullable=False, unique=True, index=True),
        description="ID original del asiento enriquecido",
    )
    empresa_id: int = Field(index=True)
    fecha: date = Field(index=True)
    periodo_anio: int = Field(sa_column=Column(SmallInteger, nullable=False, index=True))
    periodo_mes: int = Field(sa_column=Column(SmallInteger, nullable=False, index=True))
    tipo_asiento: Optional[str] = Field(default=None, max_length=255)
    nro_asiento: Optional[str] = Field(default=None, max_length=255)
    nro_renglon: Optional[str] = Field(default=None, max_length=255)
    cuenta_codigo: int = Field(index=True)
    debe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric, nullable=False, server_default="0"),
    )
    haber: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric, nullable=False, server_default="0"),
    )
    descripcion: Optional[str] = Field(default=None)
    tipo_subcuenta: Optional[str] = Field(default=None, max_length=255)
    nro_subcuenta: Optional[str] = Field(default=None, max_length=255)
    centro_costo: Optional[str] = Field(default=None, max_length=255)
    cargado_en: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    )
    archivo_origen: Optional[str] = Field(default=None, max_length=255)
    rubro: Optional[str] = Field(default=None, max_length=255, index=True)
    cash: Optional[str] = Field(default=None, max_length=10, index=True)
    cuenta_cash_id: Optional[int] = Field(
        default=None,
        foreign_key="erp_cash_cuentas.id",
        index=True,
        description="FK al concepto cash resuelto para la cuenta",
    )

