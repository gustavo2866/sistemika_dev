from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.item import Item

class User(Base, table=True):
    """Modelo para usuarios del sistema"""
    __tablename__ = "users"
    
    # Metadata para CRUD
    __searchable_fields__ = ["nombre"]  # Solo nombre para búsqueda general (q)
    
    # Campos de negocio
    nombre: str = Field(max_length=100, description="Nombre completo del usuario")
    telefono: Optional[str] = Field(default=None, max_length=20, description="Número de teléfono")
    email: str = Field(max_length=255, description="Correo electrónico", unique=True)
    url_foto: Optional[str] = Field(default=None, max_length=500, description="URL de la foto de perfil")
    
    # Relaciones
    items: List["Item"] = Relationship(back_populates="user")
    
    def __str__(self) -> str:
        return f"User(id={self.id}, nombre='{self.nombre}', email='{self.email}')"
    
    def __repr__(self) -> str:
        return self.__str__()
