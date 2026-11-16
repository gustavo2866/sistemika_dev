from datetime import date
from decimal import Decimal
from typing import ClassVar, List

from pydantic import field_validator
from sqlalchemy import CheckConstraint, Column, DECIMAL
from sqlmodel import Field

from app.models.base import Base


class ErpIndice(Base, table=True):
    """Valor diario de un indice utilizado por el ERP."""

    __tablename__ = "erp_indice"
    __table_args__ = (
        CheckConstraint(
            "codigo IN ('ICC', 'IPC', 'DOL')",
            name="ck_erp_indice_codigo_valid",
        ),
    )
    __searchable_fields__: ClassVar[List[str]] = ["codigo"]

    codigo: str = Field(
        max_length=3,
        index=True,
        description="Codigo del indice: ICC, IPC o DOL",
    )
    fecha: date = Field(
        index=True,
        description="Fecha correspondiente al valor del indice",
    )
    valor: Decimal = Field(
        sa_column=Column(DECIMAL(18, 6), nullable=False),
        description="Valor del indice con seis decimales",
    )

    @field_validator("codigo", mode="before")
    @classmethod
    def normalizar_codigo(cls, value: object) -> str:
        codigo = str(value or "").strip().upper()
        if codigo not in {"ICC", "IPC", "DOL"}:
            raise ValueError("codigo debe ser ICC, IPC o DOL")
        return codigo

    def __repr__(self) -> str:
        return (
            f"ErpIndice(id={self.id}, codigo={self.codigo!r}, "
            f"fecha={self.fecha}, valor={self.valor})"
        )
