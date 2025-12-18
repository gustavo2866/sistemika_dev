"""  
Modelo para celulares/canales de WhatsApp Business configurados en Meta
"""
from typing import Optional, TYPE_CHECKING, List
from sqlmodel import Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from .crm_mensaje import CRMMensaje

class CRMCelular(Base, table=True):
    __tablename__ = "crm_celulares"
    __searchable_fields__ = ["alias", "numero_celular"]

    meta_celular_id: str = Field(
        max_length=255, 
        unique=True, 
        index=True, 
        nullable=False,
        description="ID del celular en Meta WhatsApp"
    )
    numero_celular: str = Field(
        max_length=50, 
        index=True, 
        nullable=False,
        description="Número de teléfono con formato internacional"
    )
    alias: Optional[str] = Field(
        default=None, 
        max_length=255,
        description="Nombre descriptivo del canal"
    )
    activo: bool = Field(default=True, description="Canal habilitado")
    
    # Relationships
    mensajes: List["CRMMensaje"] = Relationship(back_populates="celular")
