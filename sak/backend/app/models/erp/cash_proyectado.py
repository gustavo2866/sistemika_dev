from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import ClassVar, List, Optional

from pydantic import field_validator
from sqlalchemy import CheckConstraint, Column, DECIMAL, Index, String, text
from sqlmodel import Field

from app.models.base import Base


class ErpCashProyectado(Base, table=True):
    __tablename__ = "erp_cash_proyectado"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('PROYECCION', 'PRESUPUESTO', 'COMPROMETIDO', 'AJUSTE')",
            name="ck_erp_cash_proyectado_tipo_valid",
        ),
        Index(
            "uq_erp_cash_proyectado_activo_cuenta_periodo_tipo",
            "cuenta_cash_id",
            "fecha_periodo",
            "tipo",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )

    __searchable_fields__: ClassVar[List[str]] = ["tipo", "observacion"]

    cuenta_cash_id: int = Field(
        foreign_key="erp_cash_cuentas.id",
        index=True,
        description="FK a la cuenta financiera",
    )
    fecha_periodo: date = Field(
        index=True,
        description="Primer dia del mes proyectado",
    )
    tipo: str = Field(
        sa_column=Column(String(30), nullable=False, index=True),
        description="Tipo de importe proyectado",
    )
    importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(18, 2), nullable=False, server_default=text("0")),
        description="Importe proyectado para la cuenta y periodo",
    )
    observacion: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
        description="Observacion opcional",
    )

    @field_validator("fecha_periodo")
    @classmethod
    def validar_fecha_inicio_mes(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("fecha_periodo debe ser el primer dia del mes")
        return value

    def __repr__(self) -> str:
        return (
            f"ErpCashProyectado(id={self.id}, cuenta_cash_id={self.cuenta_cash_id}, "
            f"fecha_periodo={self.fecha_periodo}, tipo='{self.tipo}', importe={self.importe})"
        )
