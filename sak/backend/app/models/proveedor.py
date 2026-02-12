from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .adm import AdmConcepto
    from .factura import Factura
    from .articulo import Articulo
    from .tipo_solicitud import TipoSolicitud
    from .departamento import Departamento
    from .metodo_pago import MetodoPago
    from .user import User
    from .tipo_comprobante import TipoComprobante
    from .taxes import TaxProfile

class Proveedor(Base, table=True):
    """Modelo para proveedores"""
    __tablename__ = "proveedores"
    
    # Metadata para CRUD
    __searchable_fields__ = ["nombre", "cuit", "razon_social"]
    
    # Campos básicos
    nombre: str = Field(max_length=255, description="Nombre comercial del proveedor")
    razon_social: str = Field(max_length=255, description="Razón social")
    cuit: str = Field(max_length=15, description="CUIT del proveedor", unique=True)
    
    # Datos de contacto
    telefono: Optional[str] = Field(default=None, max_length=20, description="Teléfono")
    email: Optional[str] = Field(default=None, max_length=255, description="Email")
    direccion: Optional[str] = Field(default=None, max_length=500, description="Dirección")
    
    # Datos bancarios
    cbu: Optional[str] = Field(default=None, max_length=22, description="CBU")
    alias_bancario: Optional[str] = Field(default=None, max_length=100, description="Alias bancario")

    # Concepto administrativo (opcional)
    adm_concepto_id: Optional[int] = Field(
        default=None,
        foreign_key="adm_conceptos.id",
        description="ID del concepto administrativo asociado",
    )
    
    # Tipo de comprobante por defecto (opcional)
    tipo_comprobante_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_comprobante.id",
        description="ID del tipo de comprobante por defecto",
    )
    
    # Perfil de impuestos (opcional)
    tax_profile_id: Optional[int] = Field(
        default=None,
        foreign_key="tax_profiles.id",
        description="ID del perfil de impuestos asociado",
    )
    
    # Términos de pago
    dias_vencimiento: Optional[int] = Field(
        default=None,
        description="Días de vencimiento para pagos",
    )
    
    # Estado
    activo: bool = Field(default=True, description="Si el proveedor está activo")
    
    # Campos default para inferencia
    default_tipo_solicitud_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_solicitud.id",
        description="Tipo de solicitud por defecto"
    )
    default_departamento_id: Optional[int] = Field(
        default=None,
        foreign_key="departamentos.id",
        description="Departamento por defecto"
    )
    default_metodo_pago_id: Optional[int] = Field(
        default=None,
        foreign_key="metodos_pago.id",
        description="Método de pago por defecto"
    )
    default_usuario_responsable_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        description="Usuario responsable por defecto"
    )
    default_articulos_id: Optional[int] = Field(
        default=None,
        foreign_key="articulos.id",
        description="Artículo por defecto"
    )
    
    # Relaciones
    concepto: Optional["AdmConcepto"] = Relationship()
    tipo_comprobante: Optional["TipoComprobante"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Proveedor.tipo_comprobante_id"}
    )
    tax_profile: Optional["TaxProfile"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Proveedor.tax_profile_id"}
    )
    facturas: List["Factura"] = Relationship(back_populates="proveedor")
    articulos: List["Articulo"] = Relationship(
        back_populates="proveedor",
        sa_relationship_kwargs={"foreign_keys": "[Articulo.proveedor_id]"}
    )
    
    # Relaciones para campos default
    default_tipo_solicitud: Optional["TipoSolicitud"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Proveedor.default_tipo_solicitud_id"}
    )
    default_departamento: Optional["Departamento"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Proveedor.default_departamento_id"}
    )
    default_metodo_pago: Optional["MetodoPago"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Proveedor.default_metodo_pago_id"}
    )
    default_usuario_responsable: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Proveedor.default_usuario_responsable_id"}
    )
    default_articulos: Optional["Articulo"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Proveedor.default_articulos_id"}
    )
    
    def __str__(self) -> str:
        return f"Proveedor(id={self.id}, nombre='{self.nombre}', cuit='{self.cuit}')"
