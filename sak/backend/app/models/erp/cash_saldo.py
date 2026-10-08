from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import ClassVar, List, Optional

from sqlalchemy import BigInteger, Column, DateTime, Numeric, SmallInteger, func
from sqlmodel import Field

from app.models.base import Base


class ErpCashSaldo(Base, table=True):
    __tablename__ = "erp_cash_saldos"

    __searchable_fields__: ClassVar[List[str]] = [
        "nivel",
        "tipo_subcuenta",
        "nro_subcuenta",
        "centro_costo",
    ]

    source_id: int = Field(
        sa_column=Column(BigInteger, nullable=False, unique=True, index=True),
        description="ID original del saldo en la tabla externa libro_mayor",
    )
    empresa_id: int = Field(index=True)
    periodo_anio: int = Field(sa_column=Column(SmallInteger, nullable=False, index=True))
    periodo_mes: int = Field(sa_column=Column(SmallInteger, nullable=False, index=True))
    nivel: str = Field(max_length=10, index=True)
    cuenta_codigo: int = Field(index=True)
    tipo_subcuenta: Optional[str] = Field(default=None, max_length=50)
    nro_subcuenta: Optional[str] = Field(default=None, max_length=50)
    centro_costo: Optional[str] = Field(default=None, max_length=20)
    total_debe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric, nullable=False, server_default="0"),
    )
    total_haber: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric, nullable=False, server_default="0"),
    )
    saldo_periodo: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric, nullable=False, server_default="0"),
    )
    saldo_acumulado: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric, nullable=False, server_default="0"),
    )
    recalculado_en: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        )
    )
    saldo_anterior: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric, nullable=False, server_default="0"),
    )
    fecha_periodo: Optional[date] = Field(default=None)

    def __repr__(self) -> str:
        return (
            f"ErpCashSaldo(id={self.id}, source_id={self.source_id}, empresa_id={self.empresa_id}, "
            f"periodo={self.periodo_anio:04d}-{self.periodo_mes:02d}, cuenta_codigo={self.cuenta_codigo})"
        )