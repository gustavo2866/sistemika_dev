from __future__ import annotations

from datetime import date, datetime
from typing import ClassVar, List, Optional

from pydantic import field_validator
from sqlalchemy import CheckConstraint, Column, DateTime, Index, Integer, String, text
from sqlmodel import Field

from app.models.base import Base


class ErpCashPeriodo(Base, table=True):
    """Estado operativo de cada periodo mensual del CashFlow."""

    __tablename__ = "erp_cash_periodos"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('ABIERTO', 'CERRADO')",
            name="ck_erp_cash_periodos_estado_valid",
        ),
        CheckConstraint(
            "movimientos_count >= 0",
            name="ck_erp_cash_periodos_movimientos_count_nonnegative",
        ),
        CheckConstraint(
            "saldos_count >= 0",
            name="ck_erp_cash_periodos_saldos_count_nonnegative",
        ),
        Index(
            "uq_erp_cash_periodos_activo_fecha_periodo",
            "fecha_periodo",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )

    __searchable_fields__: ClassVar[List[str]] = ["estado"]

    fecha_periodo: date = Field(
        index=True,
        description="Primer dia del mes controlado",
    )
    estado: str = Field(
        default="ABIERTO",
        sa_column=Column(
            String(20),
            nullable=False,
            index=True,
            server_default=text("'ABIERTO'"),
        ),
        description="Estado operativo del periodo: ABIERTO o CERRADO",
    )
    ultima_sincronizacion: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
        description="Fecha y hora de la ultima sincronizacion",
    )
    movimientos_count: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default=text("0")),
        description="Cantidad de movimientos sincronizados",
    )
    saldos_count: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default=text("0")),
        description="Cantidad de saldos sincronizados",
    )
    cerrado_en: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
        description="Fecha y hora en que se cerro el periodo",
    )
    cerrado_por_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        index=True,
        description="Usuario que cerro el periodo",
    )

    @field_validator("fecha_periodo")
    @classmethod
    def validar_fecha_inicio_mes(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("fecha_periodo debe ser el primer dia del mes")
        return value

    @field_validator("estado", mode="before")
    @classmethod
    def normalizar_estado(cls, value: object) -> str:
        estado = str(value or "").strip().upper()
        if estado not in {"ABIERTO", "CERRADO"}:
            raise ValueError("estado debe ser ABIERTO o CERRADO")
        return estado

    def __repr__(self) -> str:
        return (
            f"ErpCashPeriodo(id={self.id}, fecha_periodo={self.fecha_periodo}, "
            f"estado='{self.estado}')"
        )
