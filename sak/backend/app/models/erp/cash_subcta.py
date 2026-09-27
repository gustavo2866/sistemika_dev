from typing import ClassVar, List

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from app.models.base import Base


class ErpCashSubcta(Base, table=True):
    __tablename__ = "erp_cash_subctas"
    __table_args__ = (
        UniqueConstraint("tpo_subcta", "nro_subcta", name="uq_erp_cash_subctas_tipo_numero"),
    )

    __searchable_fields__: ClassVar[List[str]] = ["descripcion", "categoria"]

    tpo_subcta: int = Field(
        index=True,
        description="Tipo de subcuenta cash",
    )
    descripcion: str = Field(
        max_length=255,
        index=True,
        description="Descripcion de la subcuenta cash",
    )
    nro_subcta: int = Field(
        index=True,
        description="Numero de subcuenta cash",
    )
    categoria: str = Field(
        max_length=50,
        index=True,
        description="Categoria asociada a la subcuenta",
    )

    def __repr__(self) -> str:
        return (
            f"ErpCashSubcta(id={self.id}, tpo_subcta={self.tpo_subcta}, "
            f"nro_subcta={self.nro_subcta}, descripcion='{self.descripcion}')"
        )