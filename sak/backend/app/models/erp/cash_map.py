from typing import ClassVar, List, Optional

from sqlmodel import Field

from app.models.base import Base


class ErpCashMap(Base, table=True):
    __tablename__ = "erp_cash_map"

    __searchable_fields__: ClassVar[List[str]] = ["nro_cta", "moneda", "categoria"]
    __calculated_fields__: ClassVar[List[str]] = ["cuenta_nombre"]

    nro_cta: int = Field(
        index=True,
        description="Numero de cuenta ERP a mapear",
    )
    moneda: str = Field(
        max_length=10,
        index=True,
        description="Moneda asociada al mapeo",
    )
    categoria: Optional[str] = Field(
        default=None,
        max_length=50,
        index=True,
        description="Categoria asociada al mapeo cash",
    )
    map_debe_id: int = Field(
        foreign_key="erp_cash_cuentas.id",
        index=True,
        description="FK al concepto cash para el debe",
    )
    map_haber_id: int = Field(
        foreign_key="erp_cash_cuentas.id",
        index=True,
        description="FK al concepto cash para el haber",
    )

    def __repr__(self) -> str:
        return (
            f"ErpCashMap(id={self.id}, nro_cta={self.nro_cta}, moneda='{self.moneda}', "
            f"categoria='{self.categoria}', map_debe_id={self.map_debe_id}, "
            f"map_haber_id={self.map_haber_id})"
        )
