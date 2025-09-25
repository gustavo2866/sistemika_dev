from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .user import User

class Paises(Base, table=True):
    __tablename__ = "paises"
    
    name: str

    # Relación inversa: un país puede tener varios usuarios
    users: list["User"] = Relationship(back_populates="pais")

    # Metadatos para filtrado
    __searchable_fields__ = ["name"]