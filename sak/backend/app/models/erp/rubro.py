from typing import ClassVar, List, Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.erp.cuenta import ErpCuenta


class ErpRubro(Base, table=True):
    __tablename__ = "erp_rubros"

    __searchable_fields__: ClassVar[List[str]] = ["nombre"]
    __expanded_list_relations__: ClassVar[set[str]] = {"cuentas"}

    nombre: str = Field(
        max_length=120,
        unique=True,
        index=True,
        description="Nombre del rubro",
    )
    activo: bool = Field(
        default=True,
        index=True,
        description="Indica si el rubro está activo",
    )

    # Relationship
    cuentas: Optional[List["ErpCuenta"]] = Relationship(
        back_populates="rubro",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    def __repr__(self) -> str:
        return f"ErpRubro(id={self.id}, nombre='{self.nombre}', activo={self.activo})"
