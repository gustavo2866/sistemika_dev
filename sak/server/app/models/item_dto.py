from typing import Optional
from pydantic import BaseModel

class ItemDTO(BaseModel):
    """DTO para Item - Solo campos de negocio para el frontend"""
    id: int
    name: str
    description: Optional[str] = None

class ItemCreateDTO(BaseModel):
    """DTO para crear Item - Solo campos editables"""
    name: str
    description: Optional[str] = None

class ItemUpdateDTO(BaseModel):
    """DTO para actualizar Item - Solo campos editables"""
    name: str
    description: Optional[str] = None

class ItemWithAuditDTO(BaseModel):
    """DTO con campos de auditoría - Solo para casos específicos (admin, logs, etc.)"""
    id: int
    name: str
    description: Optional[str] = None
    created_at: str
    updated_at: str
    version: int
