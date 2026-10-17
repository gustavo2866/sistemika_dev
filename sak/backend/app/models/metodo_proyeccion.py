from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlalchemy import CheckConstraint, Column, DECIMAL, String, UniqueConstraint
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from app.models.erp.cash_cuenta import ErpCashCuenta


class FuncionProyeccion(str, Enum):
    PROMEDIO = "PROMEDIO"
    SUMA = "SUMA"
    MAX = "MAX"
    MIN = "MIN"
    ULTIMO = "ULTIMO"


class MetodoProyeccion(Base, table=True):
    """Catalogo de métodos de proyección."""

    __tablename__ = "metodo_proyeccion"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "descripcion"]
    __auto_include_relations__: ClassVar[List[str]] = ["detalles", "cuentas"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles", "cuentas"}

    nombre: str = Field(max_length=200, unique=True, index=True, description="Nombre del método de proyección")
    descripcion: Optional[str] = Field(default=None, max_length=1000, description="Descripción del método")
    activo: bool = Field(default=True, description="Indica si el método está activo")

    detalles: List["MetodoProyeccionDetalle"] = Relationship(
        back_populates="metodo_proyeccion",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    cuentas: List["MetodoProyeccionCuenta"] = Relationship(
        back_populates="metodo_proyeccion",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    cash_cuentas: List["ErpCashCuenta"] = Relationship(back_populates="metodo_proyeccion")


class MetodoProyeccionCuenta(Base, table=True):
    """Cuenta ERP vinculada a un método de proyección."""

    __tablename__ = "metodo_proyeccion_cuenta"
    __table_args__ = (
        UniqueConstraint("id_metodo_proyeccion", "nro_cuenta", name="uq_metodo_proyeccion_cuenta"),
    )

    id_metodo_proyeccion: int = Field(
        foreign_key="metodo_proyeccion.id",
        description="Método de proyección asociado",
        index=True,
    )
    nro_cuenta: int = Field(
        index=True,
        description="Número de cuenta ERP asociado al método",
    )
    activo: bool = Field(default=True, description="Indica si la cuenta participa en el método")

    metodo_proyeccion: "MetodoProyeccion" = Relationship(back_populates="cuentas")


class MetodoProyeccionDetalle(Base, table=True):
    """Regla de cálculo por mes de destino dentro de un método de proyección."""

    __tablename__ = "metodo_proyeccion_detalle"
    __table_args__ = (
        CheckConstraint("mes_destino BETWEEN 1 AND 12", name="ck_metodo_proyeccion_detalle_mes_destino"),
        CheckConstraint("mes_base_desde <= mes_base_hasta", name="ck_metodo_proyeccion_detalle_mes_base_rango"),
    )

    id_metodo_proyeccion: int = Field(
        foreign_key="metodo_proyeccion.id",
        description="Método de proyección asociado",
        index=True,
    )
    mes_destino: int = Field(
        ge=1,
        le=12,
        description="Mes objetivo del cálculo (1 a 12)",
    )
    mes_base_desde: int = Field(
        description="Mes base inicial relativo, por ejemplo -6",
    )
    mes_base_hasta: int = Field(
        description="Mes base final relativo, por ejemplo -1",
    )
    funcion: Optional[FuncionProyeccion] = Field(
        default=None,
        sa_column=Column(String(20), nullable=True),
        description="Función de agregación aplicada sobre la base",
    )
    factor: Decimal = Field(
        default=Decimal("1.00"),
        sa_column=Column(DECIMAL(10, 4), nullable=False, server_default="1"),
        description="Factor multiplicador aplicado al cálculo",
    )

    metodo_proyeccion: "MetodoProyeccion" = Relationship(back_populates="detalles")
