from typing import Optional

from sqlmodel import Field

from .base import Base


class Setting(Base, table=True):
    __tablename__ = "settings"
    __searchable_fields__ = ["clave", "descripcion"]

    id: Optional[int] = Field(default=None, primary_key=True)
    clave: str = Field(max_length=100, unique=True, index=True, nullable=False)
    valor: str = Field(max_length=500, nullable=False)
    descripcion: Optional[str] = Field(default=None, max_length=255)
