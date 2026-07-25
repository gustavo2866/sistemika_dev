from typing import ClassVar, List, Optional

from sqlmodel import Field

from app.models.base import Base


class ErpCuentaTipo(Base, table=True):
    __tablename__ = "erp_cuenta_tipos"

    __searchable_fields__: ClassVar[List[str]] = ["nombre", "descripcion", "cuenta"]

    nombre: str = Field(
        max_length=200,
        index=True,
        description="Nombre del tipo de cuenta",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción del tipo de cuenta",
    )
    cuenta: str = Field(
        max_length=50,
        index=True,
        description="Código de cuenta contable",
    )
    es_impuesto: bool = Field(
        default=False,
        index=True,
        description="Indica si el tipo de cuenta es de impuestos",
    )

    def __repr__(self) -> str:
        return (
            f"ErpCuentaTipo(id={self.id}, nombre='{self.nombre}', "
            f"cuenta='{self.cuenta}', es_impuesto={self.es_impuesto})"
        )
