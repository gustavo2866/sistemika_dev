from typing import Optional, List, TYPE_CHECKING, ClassVar
from datetime import date, datetime, UTC
from decimal import Decimal

from sqlmodel import Field, Relationship
from pydantic import field_validator
from sqlalchemy import Column, DECIMAL

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura
    from .crm_catalogos import CRMTipoOperacion
    from .crm_oportunidad import CRMOportunidad
    from .emprendimiento import Emprendimiento
    from .user import User
    from .tipo_propiedad import TipoPropiedad
    from .propietario import Propietario
    from .tipo_actualizacion import TipoActualizacion

DEFAULT_PROPIEDADES = (
    (1, 'Casa Central', 'Departamento', 'Inversiones SA', 3, 85.5, 450000, 120000, '2020-03-15'),
    (2, 'Depósito Norte', 'Galpón', 'Logística SRL', None, 500.0, 800000, 50000, '2019-06-01'),
    (3, 'Oficina Microcentro', 'Oficina', 'Inmobiliaria SA', 2, 65.0, 350000, 80000, '2021-11-20'),
    (4, 'Local Comercial 45', 'Local', 'Retail Partners', 1, 45.0, 280000, 60000, '2022-02-10'),
    (5, 'Terreno Ruta 9', 'Terreno', 'Desarrollos SRL', None, 1200.0, None, None, '2023-01-05'),
)


class PropiedadesStatus(Base, table=True):
    """Estados de propiedades."""

    __tablename__ = "propiedades_status"

    __searchable_fields__ = ["nombre", "descripcion"]

    nombre: str = Field(
        max_length=50,
        description="Nombre del estado",
        nullable=False,
        unique=True,
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Descripción del estado",
    )
    orden: int = Field(
        description="Orden de visualización",
        nullable=False,
    )
    activo: bool = Field(
        default=True,
        description="Si el estado está activo",
    )
    es_inicial: bool = Field(
        default=False,
        description="Si es el estado inicial por defecto",
    )
    es_final: bool = Field(
        default=False,
        description="Si es un estado final",
    )

    propiedades: List["Propiedad"] = Relationship(back_populates="propiedad_status")


class PropiedadesLogStatus(Base, table=True):
    """Log de cambios de estado de propiedades."""

    __tablename__ = "propiedades_log_status"

    __searchable_fields__ = ["estado_nuevo", "estado_anterior", "motivo"]

    propiedad_id: int = Field(foreign_key="propiedades.id", index=True, description="ID de la propiedad")
    estado_anterior_id: Optional[int] = Field(
        default=None,
        foreign_key="propiedades_status.id",
        description="ID del estado anterior (null para primer estado)"
    )
    estado_nuevo_id: int = Field(
        foreign_key="propiedades_status.id",
        description="ID del nuevo estado"
    )
    estado_anterior: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Nombre del estado anterior (para referencia)"
    )
    estado_nuevo: str = Field(
        max_length=50,
        description="Nombre del nuevo estado (para referencia)"
    )
    fecha_cambio: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Fecha y hora del cambio de estado"
    )
    usuario_id: int = Field(
        foreign_key="users.id",
        description="ID del usuario que realizó el cambio"
    )
    motivo: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Motivo del cambio de estado"
    )
    observaciones: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Observaciones adicionales del cambio"
    )

    # Relaciones
    propiedad: Optional["Propiedad"] = Relationship(back_populates="logs_estado")
    estado_anterior_ref: Optional["PropiedadesStatus"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "PropiedadesLogStatus.estado_anterior_id"}
    )
    estado_nuevo_ref: Optional["PropiedadesStatus"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "PropiedadesLogStatus.estado_nuevo_id"}
    )
    usuario: Optional["User"] = Relationship()


class Propiedad(Base, table=True):
    """Catálogo de propiedades sobre las que se pueden imputar facturas."""

    __tablename__ = 'propiedades'
    REALIZADA_ALERT_DAYS: ClassVar[int] = 60

    nombre: str = Field(max_length=255, index=True)
    tipo_propiedad_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_propiedad.id",
        index=True,
        description="Referencia al catálogo de tipos de propiedad"
    )
    propietario: str = Field(max_length=255, description='Propietario o responsable')
    
    # FK a propietario (nueva relación sin eliminar el campo actual)
    propietario_id: Optional[int] = Field(
        default=None,
        foreign_key="propietarios.id",
        index=True,
        description="ID del propietario desde la tabla propietarios"
    )
    
    # FK a tipo de actualización/renovación
    tipo_actualizacion_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_actualizacion.id",
        index=True,
        description="Tipo de actualización/renovación de contratos"
    )
    
    # Fecha de renovación
    fecha_renovacion: Optional[date] = Field(
        default=None,
        description="Fecha de la próxima renovación del contrato"
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
    fecha_inicio_contrato: Optional[date] = Field(
        default=None,
        description="Fecha de inicio del contrato actual"
    )
    
    vencimiento_contrato: Optional[date] = Field(
        default=None,
        description="Fecha de vencimiento del contrato actual (si está alquilada)"
    )
    
    # Campos de vacancia
    vacancia_activa: bool = Field(
        default=False,
        description="Indica si la propiedad está actualmente vacante"
    )
    
    vacancia_fecha: Optional[date] = Field(
        default=None,
        description="Fecha desde la cual la propiedad está vacante"
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
    
    contacto_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_contactos.id",
        index=True,
        description="Contacto propietario o interesado principal",
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
    propiedad_status_id: Optional[int] = Field(
        default=None,
        foreign_key="propiedades_status.id",
        index=True,
        description="Estado de la propiedad desde tabla de estados",
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
    tipo_propiedad: Optional['TipoPropiedad'] = Relationship(back_populates="propiedades")
    propietario_ref: Optional['Propietario'] = Relationship()
    tipo_actualizacion: Optional['TipoActualizacion'] = Relationship()
    tipo_operacion: Optional['CRMTipoOperacion'] = Relationship()
    emprendimiento: Optional['Emprendimiento'] = Relationship()
    propiedad_status: Optional['PropiedadesStatus'] = Relationship(back_populates="propiedades")
    logs_estado: List['PropiedadesLogStatus'] = Relationship(
        back_populates='propiedad',
        sa_relationship_kwargs={'cascade': 'all, delete-orphan'}
    )
    oportunidades: List['CRMOportunidad'] = Relationship(back_populates="propiedad")
    
    __searchable_fields__ = ['nombre', 'propietario']
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
    
    def actualizar_campos_vacancia(self, nuevo_estado_orden: int, fecha_cambio: Optional[date] = None) -> None:
        """
        Actualiza los campos de vacancia segun reglas de negocio.

        Reglas actuales:
        - Orden 1 (Recibida): vacancia_activa = true y vacancia_fecha = fecha_cambio.
        - Orden 4 (Realizada): vacancia_activa = false y vacancia_fecha = null.
        - Otros estados: no modificar vacancia.
        """
        if fecha_cambio is None:
            fecha_cambio = date.today()

        if nuevo_estado_orden == 1:
            self.vacancia_activa = True
            self.vacancia_fecha = fecha_cambio
        elif nuevo_estado_orden == 4:
            self.vacancia_activa = False
            self.vacancia_fecha = None


    def esta_vacante(self) -> bool:
        """
        Determina si la propiedad esta actualmente vacante basandose en su estado.

        Returns:
            bool: True si la propiedad esta vacante
        """
        if self.propiedad_status and hasattr(self.propiedad_status, 'orden'):
            return self.propiedad_status.orden == 1
        return False

    def __str__(self) -> str:  # pragma: no cover
        return f"Propiedad(id={self.id}, nombre='{self.nombre}')"
