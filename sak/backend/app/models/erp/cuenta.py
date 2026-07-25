from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.erp.rubro import ErpRubro
    from app.models.constructora.proyectos_conceptos import ProyectosConceptos


class ErpCuenta(Base, table=True):
    __tablename__ = "erp_cuentas"

    __searchable_fields__: ClassVar[List[str]] = ["cod_cuenta", "descripcion"]

    rubro_id: int = Field(
        foreign_key="erp_rubros.id",
        index=True,
        description="ID del rubro",
    )
    nro_cuenta: int = Field(
        index=True,
        description="Número de cuenta",
    )
    cod_cuenta: str = Field(
        max_length=50,
        unique=True,
        index=True,
        description="Código de cuenta (ej: 5.01.01.001)",
    )
    descripcion: str = Field(
        max_length=500,
        description="Descripción de la cuenta",
    )
    activo: bool = Field(
        default=True,
        index=True,
        description="Indica si la cuenta está activa",
    )
    proyectos_concepto_id: Optional[int] = Field(
        default=None,
        foreign_key="proyectos_conceptos.id",
        index=True,
        description="ID del concepto de proyectos asociado",
    )

    # Relationship
    rubro: Optional["ErpRubro"] = Relationship(back_populates="cuentas")
    proyectos_concepto: Optional["ProyectosConceptos"] = Relationship()

    def __repr__(self) -> str:
        return (
            f"ErpCuenta(id={self.id}, rubro_id={self.rubro_id}, "
            f"proyectos_concepto_id={self.proyectos_concepto_id}, "
            f"cod_cuenta='{self.cod_cuenta}', descripcion='{self.descripcion}')"
        )
