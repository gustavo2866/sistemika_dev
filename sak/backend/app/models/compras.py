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


class EstadoPoFactura(str, Enum):
    PENDIENTE = "pendiente"
    PROCESADA = "procesada"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"
    PAGADA = "pagada"
    ANULADA = "anulada"


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


class PoFactura(Base, table=True):
    """Factura de compras (modulo PO)."""

    __tablename__ = "po_facturas"

    __searchable_fields__ = ["numero", "punto_venta"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles", "totales"}

    numero: str = Field(max_length=50, description="Numero de factura")
    punto_venta: str = Field(max_length=10, description="Punto de venta")
    id_tipocomprobante: int = Field(
        foreign_key="tipos_comprobante.id",
        description="Identificador del tipo de comprobante",
    )

    fecha_emision: str = Field(description="Fecha de emision (formato ISO: YYYY-MM-DD)")
    fecha_vencimiento: Optional[str] = Field(default=None, description="Fecha de vencimiento (formato ISO: YYYY-MM-DD)")

    subtotal: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Subtotal sin impuestos")
    total_impuestos: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total de impuestos")
    total: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total general")

    estado: str = Field(default="pendiente", description="Estado de la factura")
    observaciones: Optional[str] = Field(default=None, description="Observaciones")

    nombre_archivo_pdf: Optional[str] = Field(default=None, max_length=500, description="Nombre del archivo PDF original")
    ruta_archivo_pdf: Optional[str] = Field(default=None, max_length=1000, description="Ruta del archivo PDF")

    comprobante_id: Optional[int] = Field(
        default=None,
        foreign_key="comprobantes.id",
        description="ID del comprobante asociado",
    )
    proveedor_id: int = Field(foreign_key="proveedores.id", description="ID del proveedor")
    usuario_responsable_id: int = Field(foreign_key="users.id", description="ID del usuario responsable del gasto")
    metodo_pago_id: int = Field(default=1, foreign_key="metodos_pago.id", description="ID del metodo de pago")
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="Centro de costo asociado (opcional)"
    )
    tipo_solicitud_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_solicitud.id",
        description="Tipo de solicitud asociado (opcional)"
    )
    departamento_id: Optional[int] = Field(
        default=None,
        foreign_key="departamentos.id",
        description="Departamento asociado (opcional)"
    )
    tipo_compra: Optional[TipoCompra] = Field(
        default=None,
        sa_column=Column(String(20), nullable=True),
        description="Tipo de compra: directa o normal (opcional)"
    )
    oportunidad_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_oportunidades.id",
        description="ID de la oportunidad CRM asociada"
    )

    proveedor: "Proveedor" = Relationship()
    comprobante: Optional["Comprobante"] = Relationship()
    tipo_comprobante: "TipoComprobante" = Relationship()
    metodo_pago: "MetodoPago" = Relationship()
    usuario_responsable: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "PoFactura.usuario_responsable_id"})
    centro_costo: Optional["CentroCosto"] = Relationship()
    tipo_solicitud: Optional["TipoSolicitud"] = Relationship()
    departamento: Optional["Departamento"] = Relationship()
    detalles: List["PoFacturaDetalle"] = Relationship(
        back_populates="factura",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    totales: List["PoFacturaTotal"] = Relationship(
        back_populates="factura",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class PoFacturaDetalle(Base, table=True):
    """Detalle de factura (modulo PO)."""

    __tablename__ = "po_factura_detalles"

    __searchable_fields__ = ["descripcion", "codigo_producto"]

    codigo_producto: Optional[str] = Field(default=None, max_length=50, description="Codigo del producto")
    descripcion: str = Field(max_length=500, description="Descripcion del producto/servicio")
    cantidad: Decimal = Field(sa_column=Column(DECIMAL(10, 3)), description="Cantidad")
    unidad_medida: Optional[str] = Field(default=None, max_length=10, description="Unidad de medida")
    precio_unitario: Decimal = Field(sa_column=Column(DECIMAL(15, 4)), description="Precio unitario")
    subtotal: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Subtotal (cantidad * precio_unitario)")
    porcentaje_descuento: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(5, 2)),
        description="Porcentaje de descuento",
    )
    importe_descuento: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(15, 2)),
        description="Importe de descuento",
    )
    porcentaje_iva: Decimal = Field(sa_column=Column(DECIMAL(5, 2)), description="Porcentaje de IVA aplicado")
    importe_iva: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Importe de IVA")
    total_linea: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total de la linea")
    orden: int = Field(description="Orden del item")

    factura_id: int = Field(foreign_key="po_facturas.id", description="ID de la factura")
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
        description="ID de la oportunidad CRM asociada"
    )

    factura: "PoFactura" = Relationship(back_populates="detalles")
    articulo: Optional["Articulo"] = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()


class PoFacturaTotal(Base, table=True):
    """Totales de factura (modulo PO)."""

    __tablename__ = "po_factura_totales"

    __searchable_fields__ = ["descripcion"]

    factura_id: int = Field(foreign_key="po_facturas.id", description="ID de la factura")
    concepto_id: int = Field(foreign_key="adm_conceptos.id", description="ID del concepto")
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="Centro de costo asociado (opcional)",
    )
    tipo: str = Field(
        sa_column=Column(String(20), nullable=False),
        description="Tipo de total (subtotal o impuesto)",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Descripcion libre del total",
    )
    importe: Decimal = Field(
        sa_column=Column(DECIMAL(15, 2), nullable=False),
        description="Importe del total",
    )

    factura: "PoFactura" = Relationship(back_populates="totales")
    concepto: "AdmConcepto" = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()


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


class PoOrderDetail(Base, table=True):
    """Items asociados a una orden (modulo PO) - Similar a PoSolicitudDetalle."""

    __tablename__ = "po_order_details"

    __searchable_fields__ = ["descripcion"]
    __auto_include_relations__: ClassVar[List[str]] = ["articulo"]

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


class EstadoPoInvoice(str, Enum):
    """Estados de la factura PO."""
    BORRADOR = "borrador"
    EMITIDA = "emitida"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"
    RECIBIDA = "recibida"
    CERRADA = "cerrada"
    ANULADA = "anulada"


class PoInvoice(Base, table=True):
    """Factura de compras basada en orden de compra (modulo PO)."""

    __tablename__ = "po_invoices"

    __searchable_fields__ = ["titulo"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles"}

    titulo: str = Field(max_length=50, description="Titulo de factura")

    estado: str = Field(
        default="borrador",
        sa_column=Column(String(20), nullable=False),
        description="Estado de la factura",
    )
    observaciones: Optional[str] = Field(default=None, description="Observaciones")

    subtotal: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Subtotal sin impuestos")
    total_impuestos: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total de impuestos")
    total: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total general")

    proveedor_id: int = Field(foreign_key="proveedores.id", description="ID del proveedor")
    usuario_responsable_id: int = Field(foreign_key="users.id", description="ID del usuario responsable")
    metodo_pago_id: int = Field(default=1, foreign_key="metodos_pago.id", description="ID del metodo de pago")
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="Centro de costo asociado (opcional)"
    )
    tipo_solicitud_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_solicitud.id",
        description="Tipo de solicitud asociado (opcional)"
    )
    
    fecha: Optional[date] = Field(
        default=None,
        description="Fecha de la factura"
    )
    fecha_estado: Optional[datetime] = Field(
        default=None,
        description="Fecha del ultimo estado"
    )

    proveedor: "Proveedor" = Relationship()
    metodo_pago: "MetodoPago" = Relationship()
    usuario_responsable: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "PoInvoice.usuario_responsable_id"})
    centro_costo: Optional["CentroCosto"] = Relationship()
    tipo_solicitud: Optional["TipoSolicitud"] = Relationship()
    detalles: List["PoInvoiceDetalle"] = Relationship(
        back_populates="invoice",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class PoInvoiceDetalle(Base, table=True):
    """Detalle de factura basada en orden de compra."""

    __tablename__ = "po_invoice_detalles"

    __searchable_fields__ = ["descripcion"]

    descripcion: str = Field(max_length=500, description="Descripcion del producto/servicio")
    cantidad: Decimal = Field(sa_column=Column(DECIMAL(10, 3)), description="Cantidad")
    unidad_medida: Optional[str] = Field(default=None, max_length=10, description="Unidad de medida")
    precio_unitario: Decimal = Field(sa_column=Column(DECIMAL(15, 4)), description="Precio unitario")
    subtotal: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Subtotal (cantidad * precio_unitario)")
    porcentaje_descuento: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(5, 2)),
        description="Porcentaje de descuento",
    )
    importe_descuento: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(DECIMAL(15, 2)),
        description="Importe de descuento",
    )
    porcentaje_iva: Decimal = Field(sa_column=Column(DECIMAL(5, 2)), description="Porcentaje de IVA aplicado")
    importe_iva: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Importe de IVA")
    total_linea: Decimal = Field(sa_column=Column(DECIMAL(15, 2)), description="Total de la linea")

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
    po_solicitud_id: Optional[int] = Field(
        default=None,
        foreign_key="po_solicitudes.id",
        description="ID de la solicitud asociada (opcional)"
    )
    orden_compra_detalle_id: Optional[int] = Field(
        default=None,
        foreign_key="po_orden_compra_detalles.id",
        description="ID del detalle de orden de compra asociado (opcional)"
    )

    # Relationships
    invoice: "PoInvoice" = Relationship(back_populates="detalles")
    articulo: Optional["Articulo"] = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()
    # Relaciones omitidas: PoSolicitud y PoOrdenCompraDetalle no están definidas en este proyecto.
