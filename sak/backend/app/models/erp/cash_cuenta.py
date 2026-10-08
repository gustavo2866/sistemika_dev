from typing import ClassVar, List, Optional

from sqlalchemy import CHAR, Column
from sqlmodel import Field

from app.models.base import Base


def infer_cash_cuenta_tipo(descripcion: str | None) -> str | None:
    normalized = str(descripcion or "").strip().upper()
    if normalized.startswith("ING"):
        return "Ingreso"
    if normalized.startswith("EGR"):
        return "Egreso"
    if normalized.startswith("FON"):
        return "Fondo"
    return None


class ErpCashCuenta(Base, table=True):
    __tablename__ = "erp_cash_cuentas"

    __searchable_fields__: ClassVar[List[str]] = ["descripcion", "tipo"]

    tipo: Optional[str] = Field(
        default=None,
        sa_column=Column(CHAR(20), nullable=True, index=True),
        description="Tipo de cuenta cash: Ingreso, Egreso o Fondo",
    )

    descripcion: str = Field(
        max_length=255,
        unique=True,
        index=True,
        description="Descripcion del concepto cash",
    )

    def __init__(self, **data):
        super().__init__(**data)
        if not self.tipo:
            self.tipo = infer_cash_cuenta_tipo(self.descripcion)

    def __repr__(self) -> str:
        return (
            f"ErpCashCuenta(id={self.id}, descripcion='{self.descripcion}', "
            f"tipo='{self.tipo}')"
        )
