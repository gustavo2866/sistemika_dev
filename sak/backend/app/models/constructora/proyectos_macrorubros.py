from typing import ClassVar, List

from sqlmodel import Field

from app.models.base import Base


class ProyectosMacrorubros(Base, table=True):
    __tablename__ = "proyectos_macrorubros"

    __searchable_fields__: ClassVar[List[str]] = ["nombre"]

    nombre: str = Field(max_length=120, unique=True, index=True, description="Nombre del macrorubro")
    activo: bool = Field(default=True, index=True, description="Indica si el macrorubro esta activo")

    def __repr__(self) -> str:
        return f"ProyectosMacrorubros(id={self.id}, nombre='{self.nombre}', activo={self.activo})"
