from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import ClassVar, List, Optional

from sqlalchemy import Column
from sqlalchemy import BigInteger
from sqlalchemy import DateTime
from sqlalchemy import Numeric
from sqlalchemy import SmallInteger
from sqlalchemy import text
from sqlmodel import Field

from app.models.base import Base


class ErpLibroDiario(Base, table=True):
    __tablename__ = "erp_libro_diario"

    __searchable_fields__: ClassVar[List[str]] = [
        "descripcion",
        "tipo_asiento",
        "nro_asiento",
        "nro_subcuenta",
        "centro_costo",
    ]

    source_id: int = Field(
        sa_column=Column(BigInteger, nullable=False, unique=True, index=True),
        description="ID original del asiento en la tabla externa libro_diario",
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
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("now()"),
        )
    )
    archivo_origen: Optional[str] = Field(default=None, max_length=255)
