from typing import Optional, List, TYPE_CHECKING
from datetime import date, datetime
from decimal import Decimal

from sqlmodel import Field, Relationship
from pydantic import field_validator
from sqlalchemy import Column, DECIMAL

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura
    from .vacancia import Vacancia
    from .crm_catalogos import CRMTipoOperacion
    from .crm_oportunidad import CRMOportunidad
    from .emprendimiento import Emprendimiento

DEFAULT_PROPIEDADES = (
    (1, 'Casa Central', 'Departamento', 'Inversiones SA', '1-recibida', 3, 85.5, 450000, 120000, '2020-03-15'),
    (2, 'Depósito Norte', 'Galpón', 'Logística SRL', '1-recibida', None, 500.0, 800000, 50000, '2019-06-01'),
    (3, 'Oficina Microcentro', 'Oficina', 'Inmobiliaria SA', '1-recibida', 2, 65.0, 350000, 80000, '2021-11-20'),
    (4, 'Local Comercial 45', 'Local', 'Retail Partners', '1-recibida', 1, 45.0, 280000, 60000, '2022-02-10'),
    (5, 'Terreno Ruta 9', 'Terreno', 'Desarrollos SRL', '1-recibida', None, 1200.0, None, None, '2023-01-05'),
)


class Propiedad(Base, table=True):
    """Catálogo de propiedades sobre las que se pueden imputar facturas."""

    __tablename__ = 'propiedades'

    nombre: str = Field(max_length=255, unique=True, index=True)
    tipo: str = Field(max_length=100, description='Tipo de propiedad')
    propietario: str = Field(max_length=255, description='Propietario o responsable')
    estado: str = Field(
        default='1-recibida',
        max_length=20,
        description='Estado actual: 1-recibida, 2-en_reparacion, 3-disponible, 4-alquilada, 5-retirada'
    )
    
    # Características físicas
    ambientes: Optional[int] = Field(
        default=None, 
        description="Cantidad de ambientes de la propiedad",
        ge=0
    )
    
    metros_cuadrados: Optional[float] = Field(
        default=None, 
        description="Superficie en metros cuadrados",
        ge=0
    )
    
    # Datos económicos
    valor_alquiler: Optional[float] = Field(
        default=None,
        description="Valor mensual del alquiler en pesos",
        ge=0
    )
    
    expensas: Optional[float] = Field(
        default=None,
        description="Valor mensual de expensas en pesos",
        ge=0
    )
    
    # Datos de contrato
    fecha_ingreso: Optional[date] = Field(
        default=None,
        description="Fecha original de ingreso de la propiedad al sistema"
    )
    
    vencimiento_contrato: Optional[date] = Field(
        default=None,
        description="Fecha de vencimiento del contrato actual (si está alquilada)"
    )
    
    # Control de estado
    estado_fecha: date = Field(
        default_factory=date.today,
        description="Fecha del último cambio de estado"
    )
    
    estado_comentario: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Comentario sobre el cambio de estado"
    )
    tipo_operacion_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_tipos_operacion.id",
        index=True,
        description="Tipo de operación asociado",
    )
    emprendimiento_id: Optional[int] = Field(
        default=None,
        foreign_key="emprendimientos.id",
        index=True,
        description="Emprendimiento al que pertenece",
    )
    costo_propiedad: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(15, 2), nullable=True),
        description="Costo de adquisición/construcción",
    )
    costo_moneda_id: Optional[int] = Field(
        default=None,
        foreign_key="monedas.id",
        description="Moneda del costo informado",
    )
    precio_venta_estimado: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(15, 2), nullable=True),
        description="Precio estimado de venta",
    )
    precio_moneda_id: Optional[int] = Field(
        default=None,
        foreign_key="monedas.id",
        description="Moneda del precio estimado",
    )

    facturas: List['Factura'] = Relationship(back_populates='propiedad')
    vacancias: List['Vacancia'] = Relationship(
        back_populates='propiedad',
        sa_relationship_kwargs={'cascade': 'all, delete-orphan'}
    )
    tipo_operacion: Optional['CRMTipoOperacion'] = Relationship()
    emprendimiento: Optional['Emprendimiento'] = Relationship()
    oportunidades: List['CRMOportunidad'] = Relationship(back_populates="propiedad")
    
    __searchable_fields__ = ['nombre', 'tipo', 'propietario', 'estado']
    __expanded_list_relations__ = []
    
    @field_validator('ambientes')
    @classmethod
    def validar_ambientes(cls, v):
        if v is not None and v < 0:
            raise ValueError('Ambientes debe ser >= 0')
        return v
    
    @field_validator('metros_cuadrados')
    @classmethod
    def validar_metros(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Metros cuadrados debe ser > 0')
        return v
    
    @field_validator('costo_propiedad', 'precio_venta_estimado')
    @classmethod
    def validar_importes(cls, v):
        if v is not None and v < 0:
            raise ValueError('Los importes deben ser mayores o iguales a 0')
        return v

    def __str__(self) -> str:  # pragma: no cover
        return f"Propiedad(id={self.id}, nombre='{self.nombre}')"
