from typing import Optional, Dict, Any, List, ClassVar
from datetime import datetime
from sqlmodel import SQLModel, Field

class Base(SQLModel):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    version: int = Field(default=1, nullable=False)
    
    # Metadata para configuración del CRUD
    __searchable_fields__: ClassVar[List[str]] = []  # Campos donde buscar con "q"

STAMP_FIELDS = {"id", "created_at", "updated_at", "deleted_at", "version"}

def campos_editables(model_cls: type[SQLModel]) -> set[str]:
    """Campos editables por el usuario (para formularios de edición)"""
    return set(model_cls.model_fields.keys()) - STAMP_FIELDS

def campos_respuesta(model_cls: type[SQLModel], include_id: bool = True) -> set[str]:
    """Campos para incluir en respuestas al frontend (visualización)"""
    campos = campos_editables(model_cls)
    if include_id:
        campos.add('id')
    return campos

def filtrar_respuesta(obj: SQLModel, context: str = "display") -> Dict[str, Any]:
    """
    Filtra un objeto para respuesta al frontend
    
    Args:
        obj: Objeto a filtrar
        context: 'display' (incluye id) o 'edit' (solo campos editables)
    """
    if context == "edit":
        # Solo campos editables (para formularios)
        campos_validos = campos_editables(type(obj))
    else:
        # Campos editables + id (para visualización)
        campos_validos = campos_respuesta(type(obj), include_id=True)
    
    obj_dict = obj.model_dump()
    return {k: v for k, v in obj_dict.items() if k in campos_validos} 


