from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User

class Tarea(Base, table=True):
    """Modelo para tareas del sistema"""
    __tablename__ = "tareas"
    
    # Metadata para CRUD
    __searchable_fields__ = ["titulo", "descripcion"]
    
    # Campos de negocio
    titulo: str = Field(max_length=200, description="Título de la tarea")
    descripcion: Optional[str] = Field(default=None, description="Descripción detallada")
    estado: str = Field(default="pendiente", max_length=50, description="Estado de la tarea")
    prioridad: str = Field(default="media", max_length=20, description="Prioridad de la tarea")
    fecha_vencimiento: Optional[str] = Field(default=None, description="Fecha límite (ISO format)")
    
    # Relación con Usuario
    user_id: int = Field(foreign_key="users.id", description="ID del usuario asignado")
    user: "User" = Relationship(back_populates="tareas")
    
    def __str__(self) -> str:
        return f"Tarea(id={self.id}, titulo='{self.titulo}', estado='{self.estado}')"
    
    def __repr__(self) -> str:
        return self.__str__()
