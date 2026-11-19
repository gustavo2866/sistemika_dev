from typing import ClassVar, List

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field

from app.models.base import Base


class ErpCashSubcta(Base, table=True):
    __tablename__ = "erp_cash_subctas"
    __table_args__ = (
        UniqueConstraint("tpo_subcta", "nro_subcta", name="uq_erp_cash_subctas_tipo_numero"),
        CheckConstraint("estado IN ('activa', 'error', 'bloqueada')", name="ck_cash_subcta_estado"),
    )

    __searchable_fields__: ClassVar[List[str]] = ["nro_subcta", "descripcion", "categoria"]

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
    estado: str = Field(default="activa", max_length=10, index=True)
    categoria: str | None = Field(
        default=None,
        max_length=50,
        index=True,
        description="Categoria asociada a la subcuenta",
    )

    def __repr__(self) -> str:
        return (
            f"ErpCashSubcta(id={self.id}, tpo_subcta={self.tpo_subcta}, "
            f"nro_subcta={self.nro_subcta}, descripcion='{self.descripcion}')"
        )
