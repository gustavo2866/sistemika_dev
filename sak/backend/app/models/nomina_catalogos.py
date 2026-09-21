from typing import ClassVar, List

from sqlalchemy import CHAR, Column
from sqlmodel import Field

from .base import Base


class NominaCategoria(Base, table=True):
    __tablename__ = "nomina_categorias"
    __searchable_fields__: ClassVar[List[str]] = ["codigo", "descripcion"]

    codigo: str = Field(
        sa_column=Column(CHAR(5), nullable=False, unique=True, index=True),
        description="Codigo unico de la categoria",
    )
    descripcion: str = Field(
        max_length=255,
        description="Descripcion de la categoria",
    )
    activa: bool = Field(
        default=True,
        description="Indica si la categoria esta activa",
    )


class NominaTarea(Base, table=True):
    __tablename__ = "nomina_tareas"
    __searchable_fields__: ClassVar[List[str]] = ["codigo", "descripcion"]

    codigo: str = Field(
        sa_column=Column(CHAR(5), nullable=False, unique=True, index=True),
        description="Codigo unico de la tarea",
    )
    descripcion: str = Field(
        max_length=255,
        description="Descripcion de la tarea",
    )
    activa: bool = Field(
        default=True,
        description="Indica si la tarea esta activa",
    )
