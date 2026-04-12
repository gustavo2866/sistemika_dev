from typing import Any, ClassVar, Dict, List, Optional

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field

from .base import Base


class TipoContrato(Base, table=True):
    """Catálogo de tipos de contrato con template JSONB de artículos."""

    __tablename__ = "tipos_contrato"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "descripcion"]

    nombre: str = Field(max_length=120, unique=True, index=True, description="Nombre del tipo de contrato")
    descripcion: Optional[str] = Field(default=None, max_length=500, description="Descripción del tipo")
    activo: bool = Field(default=True, description="Si el tipo está activo")
    template: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
        description="Template JSONB con los artículos del contrato",
    )

    def __str__(self) -> str:
        return f"TipoContrato(id={self.id}, nombre='{self.nombre}')"
