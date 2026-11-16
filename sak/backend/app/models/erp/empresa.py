from typing import ClassVar, List

from sqlmodel import Field

from app.models.base import Base


class ErpEmpresa(Base, table=True):
    """Catálogo maestro de empresas del ERP."""

    __tablename__ = "erp_empresas"
    __searchable_fields__: ClassVar[List[str]] = [
        "empresa_nombre",
        "grupo",
    ]

    empresa_id: int = Field(
        unique=True,
        index=True,
        description="ID de la empresa en el sistema ERP",
    )
    empresa_nombre: str = Field(
        max_length=255,
        index=True,
        description="Nombre de la empresa",
    )
    grupo: str = Field(
        default="otros",
        max_length=50,
        index=True,
        description="Grupo o clasificación de la empresa",
    )

    def __repr__(self) -> str:
        return (
            f"ErpEmpresa(id={self.id}, empresa_id={self.empresa_id}, "
            f"empresa_nombre={self.empresa_nombre!r}, grupo={self.grupo!r})"
        )
