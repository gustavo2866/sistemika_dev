from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlalchemy import Column, DECIMAL, String
from sqlmodel import Field, Relationship

from .base import Base, current_utc_time
from .enums import TipoCompra

if TYPE_CHECKING:
    from .articulo import Articulo
    from .adm import AdmConcepto
    from .centro_costo import CentroCosto
    from .comprobante import Comprobante
    from .crm.oportunidad import CRMOportunidad
    from .departamento import Departamento
    from .metodo_pago import MetodoPago
    from .propiedad import Propiedad
    from .proveedor import Proveedor
    from .tipo_comprobante import TipoComprobante
    from .tipo_operacion import TipoOperacion
    from .tipo_solicitud import TipoSolicitud
    from .user import User


class PoOrderStatus(Base, table=True):
    """Estados de órdenes (modulo PO)."""

    __tablename__ = "po_order_status"

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

    orders: List["PoOrder"] = Relationship(back_populates="order_status")


class PoOrder(Base, table=True):
    """Orden (modulo PO) - Similar a PoSolicitud."""

    __tablename__ = "po_orders"

    __searchable_fields__: ClassVar[List[str]] = ["titulo", "comentario"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles"}
    __auto_include_relations__: ClassVar[List[str]] = ["proveedor", "solicitante", "tipo_solicitud", "order_status", "detalles"]

    titulo: str = Field(
        max_length=200,
        description="Título de la orden",
        nullable=False,
    )
    tipo_solicitud_id: int = Field(
        foreign_key="tipos_solicitud.id",
        description="Identificador del tipo de solicitud",
    )
    departamento_id: Optional[int] = Field(
        default=None,
        foreign_key="departamentos.id",
        description="Identificador del departamento",
    )
    order_status_id: int = Field(
        foreign_key="po_order_status.id",
        description="Identificador del estado de la orden",
    )
    metodo_pago_id: int = Field(
        default=1,
        foreign_key="metodos_pago.id",
        description="Identificador del método de pago",
    )
    tipo_compra: TipoCompra = Field(
        default=TipoCompra.NORMAL,
        sa_column=Column(String(20), nullable=False, server_default="normal"),
        description="Tipo de compra: directa o normal"
    )
    total: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(15, 2), nullable=False, server_default="0"),
        description="Total estimado de la orden",
    )
    fecha_necesidad: Optional[date] = Field(
        default=None,
        description="Fecha requerida"
    )
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentario adicional",
    )
    solicitante_id: int = Field(
        foreign_key="users.id",
        description="Identificador del usuario solicitante",
    )
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="Centro de costo imputado",
    )
    oportunidad_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_oportunidades.id",
        index=True,
        description="Oportunidad CRM asociada",
    )
    proveedor_id: Optional[int] = Field(
        default=None,
        foreign_key="proveedores.id",
        index=True,
        description="Proveedor sugerido",
    )

    solicitante: "User" = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()
    proveedor: Optional["Proveedor"] = Relationship()
    tipo_solicitud: Optional["TipoSolicitud"] = Relationship()
    departamento: Optional["Departamento"] = Relationship()
    metodo_pago: "MetodoPago" = Relationship()
    order_status: "PoOrderStatus" = Relationship(back_populates="orders")
    detalles: List["PoOrderDetail"] = Relationship(
        back_populates="order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    status_logs: List["PoOrderStatusLog"] = Relationship(
        back_populates="order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class PoOrderDetail(Base, table=True):
    """Items asociados a una orden (modulo PO) - Similar a PoSolicitudDetalle."""

    __tablename__ = "po_order_details"

    __searchable_fields__ = ["descripcion"]
    __auto_include_relations__: ClassVar[List[str]] = ["articulo"]
    __calculated_fields__: ClassVar[List[str]] = ["cantidad_facturada_calc"]
    __agg_calculated__ = {
        "cantidad_facturada_calc": {
            "op": "sum",
            "source": "PoInvoiceDetail",
            "fk": "poOrderDetail_id",
            "field": "cantidad",
        }
    }

    order_id: int = Field(
        foreign_key="po_orders.id",
        description="Orden a la que pertenece el detalle",
    )
    articulo_id: Optional[int] = Field(
        default=None,
        foreign_key="articulos.id",
        description="Articulo sugerido",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripcion de la necesidad",
    )
    unidad_medida: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Unidad de medida solicitada",
    )
    cantidad: Decimal = Field(
        sa_column=Column(DECIMAL(12, 3), nullable=False),
        description="Cantidad solicitada",
    )
    precio: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(15, 2), nullable=False, server_default="0"),
        description="Precio unitario",
    )
    importe: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(15, 2), nullable=False, server_default="0"),
        description="Importe total (cantidad x precio)",
    )
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="Centro de costo asociado (opcional)"
    )
    oportunidad_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_oportunidades.id",
        description="ID de la oportunidad CRM asociada (opcional)"
    )
    cantidad_facturada: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(10, 3), nullable=False, server_default="0"),
        description="Cantidad facturada"
    )

    order: "PoOrder" = Relationship(back_populates="detalles")
    articulo: Optional["Articulo"] = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()
    oportunidad: Optional["CRMOportunidad"] = Relationship()


class PoOrderStatusLog(Base, table=True):
    """Log de cambios de estado de órdenes de compra (modulo PO)."""

    __tablename__ = "po_order_status_log"

    __searchable_fields__ = ["comentario"]
    __auto_include_relations__: ClassVar[List[str]] = [
        "status_anterior",
        "status_nuevo",
        "usuario",
    ]

    order_id: int = Field(
        foreign_key="po_orders.id",
        index=True,
        description="Orden de compra asociada",
    )
    status_anterior_id: Optional[int] = Field(
        default=None,
        foreign_key="po_order_status.id",
        description="Estado anterior (null = creación inicial)",
    )
    status_nuevo_id: int = Field(
        foreign_key="po_order_status.id",
        description="Estado nuevo",
    )
    usuario_id: int = Field(
        foreign_key="users.id",
        description="Usuario que realizó el cambio",
    )
    comentario: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Observación o motivo del cambio",
    )
    fecha_registro: date = Field(
        default_factory=lambda: __import__('datetime').date.today(),
        description="Fecha del cambio de estado",
    )

    order: Optional["PoOrder"] = Relationship(back_populates="status_logs")
    status_anterior: Optional["PoOrderStatus"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "PoOrderStatusLog.status_anterior_id", "lazy": "select"}
    )
    status_nuevo: Optional["PoOrderStatus"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "PoOrderStatusLog.status_nuevo_id", "lazy": "select"}
    )
    usuario: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "PoOrderStatusLog.usuario_id"}
    )


class EstadoPoInvoice(str, Enum):
    """Estados de la factura PO."""
    BORRADOR = "borrador"
    EMITIDA = "emitida"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"
    RECIBIDA = "recibida"
    CERRADA = "cerrada"
    ANULADA = "anulada"


class PoInvoiceStatus(Base, table=True):
    """Estados de facturas (modulo PO)."""

    __tablename__ = "po_invoice_status"

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

    invoices: List["PoInvoice"] = Relationship(back_populates="invoice_status")


class PoInvoiceStatusFin(Base, table=True):
    """Estados financieros de facturas (modulo PO)."""

    __tablename__ = "po_invoice_status_fin"

    __searchable_fields__ = ["nombre", "descripcion"]

    nombre: str = Field(
        max_length=50,
        description="Nombre del estado financiero",
        nullable=False,
        unique=True,
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Descripción del estado financiero",
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

    invoices: List["PoInvoice"] = Relationship(back_populates="invoice_status_fin")


class PoInvoice(Base, table=True):
    """Factura de compras basada en orden de compra (modulo PO)."""

    __tablename__ = "po_invoices"

    __searchable_fields__ = ["titulo", "numero"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles", "taxes"}
    __auto_include_relations__: ClassVar[List[str]] = [
        "proveedor",
        "usuario_responsable",
        "invoice_status",
        "invoice_status_fin",
        "detalles",
        "taxes",
    ]

    titulo: str = Field(max_length=50, description="Titulo de factura")
    numero: str = Field(max_length=50, description="Numero de factura")
    fecha_emision: str = Field(description="Fecha de emision (formato ISO: YYYY-MM-DD)")
    fecha_vencimiento: Optional[str] = Field(default=None, description="Fecha de vencimiento (formato ISO: YYYY-MM-DD)")
    fecha_pago: Optional[date] = Field(default=None, description="Fecha de pago")
    observaciones: Optional[str] = Field(default=None, description="Observaciones")
    
    # Importes
    subtotal: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Subtotal sin impuestos")
    total_impuestos: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total de impuestos")
    total: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total general")

    # Foreign keys principales
    proveedor_id: int = Field(foreign_key="proveedores.id", description="ID del proveedor")
    usuario_responsable_id: int = Field(foreign_key="users.id", description="ID del usuario responsable")
    invoice_status_id: int = Field(
        foreign_key="po_invoice_status.id",
        description="ID del estado de la factura",
    )
    invoice_status_fin_id: Optional[int] = Field(
        default=None,
        foreign_key="po_invoice_status_fin.id",
        description="ID del estado financiero de la factura",
    )
    fecha_estado: Optional[datetime] = Field(
        default=None,
        description="Fecha del ultimo estado"
    )
    
    # Foreign keys adicionales (según estructura real de la DB)
    id_tipocomprobante: Optional[int] = Field(
        default=None,
        foreign_key="tipos_comprobante.id",
        description="Identificador del tipo de comprobante",
    )
    nombre_archivo_pdf: Optional[str] = Field(default=None, max_length=255, description="Nombre del archivo PDF")
    ruta_archivo_pdf: Optional[str] = Field(default=None, max_length=500, description="Ruta del archivo PDF")
    comprobante_id: Optional[int] = Field(
        default=None,
        foreign_key="comprobantes.id",
        description="ID del comprobante asociado"
    )
    metodo_pago_id: Optional[int] = Field(
        default=1,
        foreign_key="metodos_pago.id",
        description="ID del método de pago"
    )
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="ID del centro de costo"
    )
    tipo_solicitud_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_solicitud.id",
        description="ID del tipo de solicitud"
    )
    oportunidad_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_oportunidades.id",
        description="ID de la oportunidad CRM asociada"
    )

    # Relaciones
    proveedor: "Proveedor" = Relationship()
    usuario_responsable: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "PoInvoice.usuario_responsable_id"})
    invoice_status: "PoInvoiceStatus" = Relationship(back_populates="invoices")
    invoice_status_fin: Optional["PoInvoiceStatusFin"] = Relationship(back_populates="invoices")
    detalles: List["PoInvoiceDetail"] = Relationship(
        back_populates="invoice",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    taxes: List["PoInvoiceTax"] = Relationship(
        back_populates="invoice",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class PoInvoiceDetail(Base, table=True):
    """Detalle de factura basada en orden de compra."""

    __tablename__ = "po_invoice_detalles"

    __searchable_fields__ = ["descripcion"]

    descripcion: Optional[str] = Field(default=None, max_length=500, description="Descripcion del producto/servicio")
    cantidad: Decimal = Field(sa_column=Column(DECIMAL(10, 3)), description="Cantidad")
    precio_unitario: Decimal = Field(sa_column=Column(DECIMAL(15, 4)), description="Precio unitario")
    importe: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Importe (cantidad * precio_unitario)")

    # Foreign keys
    invoice_id: int = Field(foreign_key="po_invoices.id", description="ID de la factura")
    articulo_id: Optional[int] = Field(
        default=None,
        foreign_key="articulos.id",
        description="ID del articulo (opcional)",
    )
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="Centro de costo asociado (opcional)"
    )
    oportunidad_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_oportunidades.id",
        description="ID de la oportunidad CRM asociada (opcional)"
    )
    poOrderDetail_id: Optional[int] = Field(
        default=None,
        foreign_key="po_order_details.id",
        description="ID del detalle de orden asociado (opcional)"
    )

    # Relationships
    invoice: "PoInvoice" = Relationship(back_populates="detalles")
    articulo: Optional["Articulo"] = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()
    oportunidad: Optional["CRMOportunidad"] = Relationship()
    poOrderDetail: Optional["PoOrderDetail"] = Relationship()
    # Relaciones omitidas: PoSolicitud y PoOrdenCompraDetalle no están definidas en este proyecto.



class PoInvoiceTax(Base, table=True):
    """Impuestos de factura basada en orden de compra (modulo PO)."""

    __tablename__ = "po_invoice_taxes"

    __searchable_fields__ = ["descripcion"]

    invoice_id: int = Field(foreign_key="po_invoices.id", description="ID de la factura")
    descripcion: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Descripcion libre del impuesto",
    )
    importe: Decimal = Field(
        sa_column=Column(DECIMAL(15, 2), nullable=False),
        description="Importe del impuesto",
    )
    importe_base: Decimal = Field(
        sa_column=Column(DECIMAL(15, 2), nullable=False),
        description="Importe base sobre el cual se calcula el impuesto",
    )
    porcentaje: Decimal = Field(
        sa_column=Column(DECIMAL(5, 2), nullable=False),
        description="Porcentaje del impuesto",
    )
    
    # Foreign key a concepto
    concepto_id: Optional[int] = Field(
        default=None,
        foreign_key="adm_conceptos.id",
        description="ID del concepto administrativo asociado",
    )

    # Relaciones
    invoice: "PoInvoice" = Relationship(back_populates="taxes")
    concepto: Optional["AdmConcepto"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "PoInvoiceTax.concepto_id"}
    )


