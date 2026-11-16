from typing import TYPE_CHECKING, ClassVar, List, Optional
from decimal import Decimal

from sqlalchemy import CHAR, Column, Numeric
from sqlmodel import Field, Relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.metodo_proyeccion import MetodoProyeccion


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
    id_metodo_proyeccion: Optional[int] = Field(
        default=None,
        foreign_key="metodo_proyeccion.id",
        index=True,
        description="Método de proyección asociado a la cuenta, si aplica",
    )

    cuenta_cash_referencia_id: Optional[int] = Field(
        default=None, foreign_key="erp_cash_cuentas.id", index=True,
        description="Cuenta cuyo proyectado del mismo mes sirve como base relacional",
    )
    porcentaje: Optional[Decimal] = Field(
        default=None, sa_column=Column(Numeric(12, 6), nullable=True),
        description="Porcentaje relacional: 5 significa 5 %",
    )
    metodo_proyeccion: Optional["MetodoProyeccion"] = Relationship(back_populates="cash_cuentas")

    def __init__(self, **data):
        super().__init__(**data)
        if not self.tipo:
            self.tipo = infer_cash_cuenta_tipo(self.descripcion)

    def __repr__(self) -> str:
        return (
            f"ErpCashCuenta(id={self.id}, descripcion='{self.descripcion}', "
            f"tipo='{self.tipo}')"
        )
