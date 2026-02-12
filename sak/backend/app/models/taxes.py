from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .adm import AdmConcepto
    from .user import User


class TaxProfile(Base, table=True):
    """Perfil de impuestos - Cabecera"""
    __tablename__ = "tax_profiles"
    
    __searchable_fields__ = ["nombre", "descripcion"]
    __auto_include_relations__ = ["details.concepto"]
    __expanded_list_relations__: ClassVar[set[str]] = {"details"}
    
    nombre: str = Field(
        max_length=255,
        description="Nombre del perfil de impuestos",
        nullable=False
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción del perfil"
    )
    activo: bool = Field(
        default=True,
        description="Estado activo/inactivo"
    )
    
    # Relaciones
    details: List["TaxProfileDetail"] = Relationship(back_populates="profile")


class TaxProfileDetail(Base, table=True):
    """Perfil de impuestos - Detalle"""
    __tablename__ = "tax_profile_details"
    
    __auto_include_relations__ = ["concepto"]
    
    profile_id: int = Field(foreign_key="tax_profiles.id")
    concepto_id: int = Field(foreign_key="adm_conceptos.id")
    porcentaje: Decimal = Field(
        max_digits=5,
        decimal_places=2,
        description="Porcentaje del impuesto"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Descripción del detalle"
    )
    activo: bool = Field(
        default=True,
        description="Estado activo/inactivo"
    )
    fecha_vigencia: date = Field(
        description="Fecha de vigencia del impuesto"
    )
    
    # Relaciones
    profile: "TaxProfile" = Relationship(back_populates="details")
    concepto: Optional["AdmConcepto"] = Relationship()
