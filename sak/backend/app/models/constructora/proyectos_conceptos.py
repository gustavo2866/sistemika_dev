from typing import ClassVar, List

from sqlalchemy import CheckConstraint
from sqlmodel import Field

from app.models.base import Base


class ProyectosConceptos(Base, table=True):
    __tablename__ = "proyectos_conceptos"
    __table_args__ = (CheckConstraint("signo IN (1, -1)", name="ck_proyectos_conceptos_signo"),)

    __searchable_fields__: ClassVar[List[str]] = ["nombre"]

    nombre: str = Field(max_length=120, unique=True, index=True, description="Nombre del concepto")
    activo: bool = Field(default=True, index=True, description="Indica si el concepto esta activo")
    signo: int = Field(default=1, description="Signo del concepto: 1 o -1")

    def __repr__(self) -> str:
        return f"ProyectosConceptos(id={self.id}, nombre='{self.nombre}', activo={self.activo}, signo={self.signo})"
