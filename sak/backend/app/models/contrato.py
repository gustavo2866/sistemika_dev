from datetime import date
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .propiedad import Propiedad
    from .tipo_actualizacion import TipoActualizacion
    from .tipo_contrato import TipoContrato
    from .contrato_archivo import ContratoArchivo


class Contrato(Base, table=True):
    """Contrato de alquiler entre propietario e inquilino sobre una propiedad."""

    __tablename__ = "contratos"
    __auto_include_relations__: ClassVar[List[str]] = [
        "propiedad",
        "tipo_contrato",
        "tipo_actualizacion",
        "archivos",
    ]
    __expanded_list_relations__: ClassVar[set[str]] = {"archivos"}
    __searchable_fields__: ClassVar[List[str]] = [
        "inquilino_nombre",
        "inquilino_apellido",
        "inquilino_dni",
    ]

    # --- Relaciones principales ---
    propiedad_id: int = Field(foreign_key="propiedades.id", index=True, description="Propiedad del contrato")
    tipo_contrato_id: Optional[int] = Field(default=None, foreign_key="tipos_contrato.id", index=True, description="Tipo de contrato")
    tipo_actualizacion_id: Optional[int] = Field(default=None, foreign_key="tipos_actualizacion.id", description="Tipo de actualización pactada")

    # --- Vigencia ---
    fecha_inicio: date = Field(description="Fecha de inicio del contrato")
    fecha_vencimiento: date = Field(description="Fecha de vencimiento del contrato")
    fecha_renovacion: Optional[date] = Field(default=None, description="Próxima renovación pactada")
    duracion_meses: Optional[int] = Field(default=None, description="Duración en meses (calculado o manual)")

    # --- Económico ---
    valor_alquiler: float = Field(ge=0, description="Monto mensual de alquiler")
    expensas: Optional[float] = Field(default=None, ge=0, description="Monto mensual de expensas")
    deposito_garantia: Optional[float] = Field(default=None, description="Monto del depósito de garantía")
    moneda: str = Field(default="ARS", max_length=10, description="Moneda del contrato (ARS, USD, etc.)")

    # --- Inquilino ---
    inquilino_nombre: str = Field(max_length=200, description="Nombre del inquilino")
    inquilino_apellido: str = Field(max_length=200, description="Apellido del inquilino")
    inquilino_dni: Optional[str] = Field(default=None, max_length=20, description="DNI del inquilino")
    inquilino_cuit: Optional[str] = Field(default=None, max_length=20, description="CUIT del inquilino")
    inquilino_email: Optional[str] = Field(default=None, max_length=200, description="Email del inquilino")
    inquilino_telefono: Optional[str] = Field(default=None, max_length=50, description="Teléfono del inquilino")
    inquilino_domicilio: Optional[str] = Field(default=None, max_length=300, description="Domicilio del inquilino")

    # --- Garante 1 ---
    garante1_nombre: Optional[str] = Field(default=None, max_length=200)
    garante1_apellido: Optional[str] = Field(default=None, max_length=200)
    garante1_dni: Optional[str] = Field(default=None, max_length=20)
    garante1_cuit: Optional[str] = Field(default=None, max_length=20)
    garante1_email: Optional[str] = Field(default=None, max_length=200)
    garante1_telefono: Optional[str] = Field(default=None, max_length=50)
    garante1_domicilio: Optional[str] = Field(default=None, max_length=300)
    garante1_tipo_garantia: Optional[str] = Field(default=None, max_length=100, description="Tipo de garantía (Inmueble, Recibo sueldo, etc.)")

    # --- Garante 2 ---
    garante2_nombre: Optional[str] = Field(default=None, max_length=200)
    garante2_apellido: Optional[str] = Field(default=None, max_length=200)
    garante2_dni: Optional[str] = Field(default=None, max_length=20)
    garante2_cuit: Optional[str] = Field(default=None, max_length=20)
    garante2_email: Optional[str] = Field(default=None, max_length=200)
    garante2_telefono: Optional[str] = Field(default=None, max_length=50)
    garante2_domicilio: Optional[str] = Field(default=None, max_length=300)
    garante2_tipo_garantia: Optional[str] = Field(default=None, max_length=100)

    # --- Estado ---
    # Estados válidos: borrador | vigente | rescindido | finalizado
    # Nota: 'vencido' es una condición computable (vigente AND fecha_vencimiento < hoy), no un estado persistido.
    estado: str = Field(default="borrador", max_length=50, index=True, description="Estado del contrato: borrador|vigente|rescindido|finalizado")
    fecha_rescision: Optional[date] = Field(default=None, description="Fecha de rescisión (cuando estado=rescindido)")
    motivo_rescision: Optional[str] = Field(default=None, max_length=300, description="Motivo de rescisión")
    contrato_origen_id: Optional[int] = Field(default=None, foreign_key="contratos.id", description="ID del contrato anterior del que se originó este (renovación)")

    observaciones: Optional[str] = Field(default=None, description="Observaciones adicionales")
    lugar_celebracion: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Ciudad o lugar donde se firma el contrato (ej: San Miguel de Tucumán)",
    )

    # --- Relationships ---
    propiedad: Optional["Propiedad"] = Relationship()
    tipo_contrato: Optional["TipoContrato"] = Relationship()
    tipo_actualizacion: Optional["TipoActualizacion"] = Relationship()
    archivos: List["ContratoArchivo"] = Relationship(
        back_populates="contrato",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
