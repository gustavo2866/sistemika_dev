from typing import Optional
from sqlmodel import Field

from ..base import Base


class AdmConcepto(Base, table=True):
    """Conceptos administrativos"""
    
    __tablename__ = "adm_conceptos"
    __searchable_fields__ = ["nombre", "descripcion"]

    nombre: str = Field(max_length=200, description="Nombre del concepto", index=True)
    descripcion: Optional[str] = Field(default=None, max_length=500, description="Descripción del concepto")
    cuenta: str = Field(max_length=50, description="Código de cuenta contable", index=True)