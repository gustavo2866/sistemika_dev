from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .user import User

class Item(Base, table=True):
    name: str
    description: Optional[str] = None
    
    # Foreign key para relación con User
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", description="ID del usuario propietario")
    
    # Relación
    user: Optional["User"] = Relationship(back_populates="items")
    
    # Metadatos para filtrado
    __searchable_fields__ = ["name"]


