from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Any, ClassVar, Dict, List, Optional

from sqlalchemy import Column, DECIMAL, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.articulo import Articulo
    from app.models.centro_costo import CentroCosto
    from app.models.compras import PoOrder, PoOrderDetail
    from app.models.crm.mensaje import CRMMensaje
    from app.models.crm.oportunidad import CRMOportunidad
    from app.models.crm.contacto import CRMContacto
    from app.models.tipo_solicitud import TipoSolicitud
    from app.models.user import User


class PedidoObraEstado(str, Enum):
    BORRADOR = "borrador"
    CERRADO = "cerrado"
    EMITIDO = "emitido"
    CANCELADO = "cancelado"


class PedidoObraOrigen(str, Enum):
    AGENTE = "agente"
    MANUAL = "manual"


class PedidoObraDetalleEstado(str, Enum):
    ACTIVA = "activa"
    CANCELADA = "cancelada"


class PedidoObraDetalleOrigen(str, Enum):
    AGENTE = "agente"
    MANUAL = "manual"


class ConstructoraPedido(Base, table=True):
    """Pedido de obra confirmado, revisable antes de generar PO."""

    __tablename__ = "constructora_pedidos"
    __table_args__ = (
        UniqueConstraint("mensaje_origen_id", name="uq_constructora_pedidos_mensaje_origen"),
    )

    __searchable_fields__: ClassVar[List[str]] = ["titulo", "observaciones"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles"}
    __auto_include_relations__: ClassVar[List[str]] = [
        "contacto",
        "solicitante",
        "responsable_revision",
        "detalles",
    ]

    oportunidad_id: int = Field(
        foreign_key="crm_oportunidades.id",
        description="Oportunidad asociada al pedido",
    )
    contacto_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_contactos.id",
        description="Contacto solicitante (opcional)",
    )
    mensaje_origen_id: Optional[int] = Field(
        default=None,
        foreign_key="crm_mensajes.id",
        description="Mensaje del agente que origino este pedido",
    )
    estado: PedidoObraEstado = Field(
        default=PedidoObraEstado.BORRADOR,
        sa_column=Column(String(20), nullable=False, server_default="borrador"),
        description="Estado del pedido",
    )
    origen: PedidoObraOrigen = Field(
        default=PedidoObraOrigen.MANUAL,
        sa_column=Column(String(20), nullable=False, server_default="manual"),
        description="Origen del pedido: agente (desde chat) o manual (backoffice)",
    )
    titulo: str = Field(
        max_length=300,
        description="Titulo descriptivo del pedido",
    )
    observaciones: Optional[str] = Field(
        default=None,
        description="Observaciones adicionales",
    )
    solicitante_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        description="Usuario solicitante",
    )
    responsable_revision_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        description="Usuario responsable de revisar el pedido",
    )
    fecha_confirmacion_agente: Optional[datetime] = Field(
        default=None,
        description="Fecha en que el agente confirmo el pedido",
    )
    fecha_revision: Optional[datetime] = Field(
        default=None,
        description="Fecha en que el ingeniero marco el pedido como confirmado",
    )
    fecha_generacion_po: Optional[datetime] = Field(
        default=None,
        description="Fecha en que se generaron las po_orders",
    )
    metadata_json: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column("metadata", type_=JSONB, nullable=True),
        description="Datos extra (referencia agente, pedido_obra_id, etc.)",
    )

    # Relaciones
    detalles: List["ConstructoraPedidoDetalle"] = Relationship(
        back_populates="pedido",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    solicitante: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ConstructoraPedido.solicitante_id]"},
    )
    responsable_revision: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ConstructoraPedido.responsable_revision_id]"},
    )
    contacto: Optional["CRMContacto"] = Relationship()


class ConstructoraPedidoDetalle(Base, table=True):
    """Linea editable de un pedido de obra."""

    __tablename__ = "constructora_pedido_detalles"

    __searchable_fields__: ClassVar[List[str]] = ["descripcion", "descripcion_original"]

    pedido_id: int = Field(
        foreign_key="constructora_pedidos.id",
        description="Pedido al que pertenece esta linea",
    )
    articulo_id: Optional[int] = Field(
        default=None,
        foreign_key="articulos.id",
        description="Articulo asignado (requerido para generar PO)",
    )
    tipo_solicitud_id: Optional[int] = Field(
        default=None,
        foreign_key="tipos_solicitud.id",
        description="Tipo de solicitud (requerido para generar PO, agrupa lineas por PO)",
    )
    descripcion_original: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Texto detectado por el agente (inmutable)",
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripcion editable por el ingeniero",
    )
    unidad_medida: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Unidad de medida",
    )
    estado: PedidoObraDetalleEstado = Field(
        default=PedidoObraDetalleEstado.ACTIVA,
        sa_column=Column(String(20), nullable=False, server_default="activa"),
        description="Estado de la linea del pedido",
    )
    origen: PedidoObraDetalleOrigen = Field(
        default=PedidoObraDetalleOrigen.MANUAL,
        sa_column=Column(String(20), nullable=False, server_default="manual"),
        description="Origen de la linea: agente o manual",
    )
    cantidad: Decimal = Field(
        sa_column=Column(DECIMAL(12, 3), nullable=False),
        description="Cantidad aceptada/editable",
    )
    cantidad_original: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(12, 3), nullable=False, server_default="0"),
        description="Cantidad original detectada en la solicitud",
    )
    centro_costo_id: Optional[int] = Field(
        default=None,
        foreign_key="centros_costo.id",
        description="Centro de costo (opcional)",
    )
    po_order_id: Optional[int] = Field(
        default=None,
        foreign_key="po_orders.id",
        description="PO generada para esta linea",
    )
    po_order_detail_id: Optional[int] = Field(
        default=None,
        foreign_key="po_order_details.id",
        description="Detalle de PO generado para esta linea",
    )
    orden: int = Field(
        default=0,
        description="Orden de visualizacion de la linea",
    )
    metadata_json: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column("metadata", type_=JSONB, nullable=True),
        description="Datos extra (agent_item_id, etc.)",
    )

    # Relaciones
    pedido: Optional["ConstructoraPedido"] = Relationship(back_populates="detalles")
    articulo: Optional["Articulo"] = Relationship()
    tipo_solicitud: Optional["TipoSolicitud"] = Relationship()
    centro_costo: Optional["CentroCosto"] = Relationship()
