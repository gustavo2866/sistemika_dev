from datetime import date
from decimal import Decimal
from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlalchemy import DECIMAL, Column
from sqlmodel import Field, Relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.erp.cuenta import ErpCuenta
    from app.models.proyecto import Proyecto


class ErpPresupuesto(Base, table=True):
    __tablename__ = "erp_presupuestos"

    __searchable_fields__: ClassVar[List[str]] = ["fecha"]
    __auto_include_relations__: ClassVar[set[str]] = {"proyecto", "erp_cuenta.rubro"}

    fecha: date = Field(
        description="Fecha del presupuesto",
        index=True,
    )
    proyecto_id: int = Field(
        foreign_key="proyectos.id",
        index=True,
        description="ID del proyecto asociado",
    )
    erp_cuenta_id: int = Field(
        foreign_key="erp_cuentas.id",
        index=True,
        description="ID de la cuenta ERP asociada",
    )
    egreso: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe de egreso",
    )
    ingres: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe de ingreso",
    )
    real_egreso: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe real de egreso",
    )
    real_ingreso: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Importe real de ingreso",
    )
    obreros_cantidad: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(10, 2), nullable=False, server_default="0"),
        description="Cantidad de obreros",
    )
    obreros_costo: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(14, 2), nullable=False, server_default="0"),
        description="Costo total de obreros",
    )

    proyecto: Optional["Proyecto"] = Relationship()
    erp_cuenta: Optional["ErpCuenta"] = Relationship()

    def __repr__(self) -> str:
        return (
            f"ErpPresupuesto(id={self.id}, fecha={self.fecha}, proyecto_id={self.proyecto_id}, "
            f"erp_cuenta_id={self.erp_cuenta_id})"
        )
