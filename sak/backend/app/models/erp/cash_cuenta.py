from typing import ClassVar, List

from sqlmodel import Field

from app.models.base import Base


class ErpCashCuenta(Base, table=True):
    __tablename__ = "erp_cash_cuentas"

    __searchable_fields__: ClassVar[List[str]] = ["descripcion"]

    descripcion: str = Field(
        max_length=255,
        unique=True,
        index=True,
        description="Descripcion del concepto cash",
    )

    def __repr__(self) -> str:
        return f"ErpCashCuenta(id={self.id}, descripcion='{self.descripcion}')"