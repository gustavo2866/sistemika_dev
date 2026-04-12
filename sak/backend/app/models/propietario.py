from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .adm.conceptos import AdmConcepto
    from .centro_costo import CentroCosto


class Propietario(Base, table=True):
    """Propietarios para gestión de inmuebles y contratos."""

    __tablename__ = "propietarios"

    __searchable_fields__: ClassVar[List[str]] = ["nombre", "dni", "cuit", "comentario"]

    nombre: str = Field(
        max_length=200,
        index=True,
        description="Nombre completo o razón social del propietario"
    )

    # --- Datos identificatorios ---
    dni: Optional[str] = Field(
        default=None,
        max_length=20,
        description="DNI del propietario (personas físicas)",
    )
    cuit: Optional[str] = Field(
        default=None,
        max_length=20,
        description="CUIT / CUIL del propietario",
    )
    tipo_persona: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Tipo de persona: 'fisica' o 'juridica'",
    )

    # --- Datos de contacto ---
    domicilio: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Domicilio legal del propietario",
    )
    localidad: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Localidad / ciudad del propietario",
    )
    provincia: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Provincia del propietario",
    )
    email: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Email de contacto del propietario",
    )
    telefono: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Teléfono de contacto del propietario",
    )

    # FK a conceptos
    adm_concepto_id: Optional[int] = Field(
        default=None,
        foreign_key="adm_conceptos.id",
        description="ID del concepto administrativo asociado"
    )
    
    # FK a centro costo
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="ID del centro de costo asociado"
    )
    
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentarios adicionales sobre el propietario"
    )
    
    activo: bool = Field(
        default=True,
        description="Indica si el propietario está activo"
    )

    # Relationships
    adm_concepto: Optional["AdmConcepto"] = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()

    def __str__(self) -> str:  # pragma: no cover
        return f"Propietario(id={self.id}, nombre='{self.nombre}', activo={self.activo})"