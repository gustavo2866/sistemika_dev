from datetime import UTC, datetime, date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, DECIMAL, Index, event, insert, select
from sqlmodel import Field, Relationship

from ..base import Base
from ..enums import EstadoOportunidad

if TYPE_CHECKING:
    from .catalogos import (
        CRMCondicionPago,
        CRMMotivoPerdida,
        CRMTipoOperacion,
        Moneda,
    )
    from .contacto import CRMContacto
    from .evento import CRMEvento
    from .mensaje import CRMMensaje
    from .log_estado import CRMOportunidadLogEstado
    from ..emprendimiento import Emprendimiento
    from ..propiedad import Propiedad
    from ..tipo_propiedad import TipoPropiedad
    from ..user import User


class CRMOportunidad(Base, table=True):
    __tablename__ = "crm_oportunidades"
    __searchable_fields__ = ["titulo", "descripcion_estado", "descripcion"]
    __expanded_list_relations__ = {
        "contacto",
        "tipo_operacion",
        "propiedad",
        "moneda",
        "condicion_pago",
        "responsable",
    }
    __table_args__ = (
        Index("idx_crm_oportunidad_estado_fecha", "estado", "fecha_estado"),
        Index("idx_crm_oportunidad_tipo_estado", "tipo_operacion_id", "estado", "created_at"),
    )

    titulo: Optional[str] = Field(default=None, max_length=100, description="Título de la oportunidad")
    contacto_id: int = Field(foreign_key="crm_contactos.id", index=True)
    tipo_operacion_id: Optional[int] = Field(
        default=None, foreign_key="crm_tipos_operacion.id", index=True
    )
    emprendimiento_id: Optional[int] = Field(
        default=None, foreign_key="emprendimientos.id", index=True
    )
    propiedad_id: Optional[int] = Field(
        default=None, foreign_key="propiedades.id", index=True
    )
    tipo_propiedad_id: Optional[int] = Field(
        default=None, foreign_key="tipos_propiedad.id", index=True
    )
    estado: str = Field(
        default=EstadoOportunidad.PROSPECT.value,
        max_length=20,
        description="Estado del pipeline",
        index=True,
    )
    activo: bool = Field(
        default=False,
        description="Oportunidad activa",
        index=True,
    )
    fecha_estado: datetime = Field(default_factory=lambda: datetime.now(UTC))
    motivo_perdida_id: Optional[int] = Field(default=None, foreign_key="crm_motivos_perdida.id")
    monto: Optional[Decimal] = Field(
        default=None, sa_column=Column(DECIMAL(15, 2), nullable=True)
    )
    moneda_id: Optional[int] = Field(default=None, foreign_key="monedas.id")
    condicion_pago_id: Optional[int] = Field(default=None, foreign_key="crm_condiciones_pago.id")
    forma_pago_descripcion: Optional[str] = Field(
        default=None, max_length=500, description="Descripción adicional de la forma de pago"
    )
    probabilidad: Optional[int] = Field(default=None, ge=0, le=100)
    fecha_cierre_estimada: Optional[date] = Field(default=None)
    responsable_id: int = Field(foreign_key="users.id")
    descripcion_estado: Optional[str] = Field(default=None, max_length=255)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    ultimo_mensaje_id: Optional[int] = Field(default=None, foreign_key="crm_mensajes.id", index=True)
    ultimo_mensaje_at: Optional[datetime] = Field(default=None, index=True)

    contacto: Optional["CRMContacto"] = Relationship(back_populates="oportunidades")
    tipo_operacion: Optional["CRMTipoOperacion"] = Relationship(back_populates="oportunidades")
    emprendimiento: Optional["Emprendimiento"] = Relationship(back_populates="oportunidades")
    propiedad: Optional["Propiedad"] = Relationship(back_populates="oportunidades")
    tipo_propiedad: Optional["TipoPropiedad"] = Relationship(back_populates="oportunidades")
    motivo_perdida: Optional["CRMMotivoPerdida"] = Relationship(back_populates="oportunidades")
    moneda: Optional["Moneda"] = Relationship(back_populates="oportunidades")
    condicion_pago: Optional["CRMCondicionPago"] = Relationship(back_populates="oportunidades")
    responsable: Optional["User"] = Relationship()
    logs_estado: list["CRMOportunidadLogEstado"] = Relationship(
        back_populates="oportunidad",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    eventos: list["CRMEvento"] = Relationship(back_populates="oportunidad")
    mensajes: list["CRMMensaje"] = Relationship(
        back_populates="oportunidad",
        sa_relationship_kwargs={"foreign_keys": "[CRMMensaje.oportunidad_id]"}
    )
    ultimo_mensaje: Optional["CRMMensaje"] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[CRMOportunidad.ultimo_mensaje_id]",
            "post_update": True
        }
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"CRMOportunidad(id={self.id}, estado='{self.estado}')"


def _is_mantenimiento_tipo_operacion(connection, tipo_operacion_id: Optional[int]) -> bool:
    if not tipo_operacion_id:
        return False

    from .catalogos import CRMTipoOperacion

    row = connection.execute(
        select(CRMTipoOperacion.codigo, CRMTipoOperacion.nombre).where(
            CRMTipoOperacion.id == tipo_operacion_id
        )
    ).first()
    if not row:
        return False

    tokens = " ".join(
        filter(
            None,
            [
                getattr(row, "codigo", None),
                getattr(row, "nombre", None),
            ],
        )
    ).lower()
    return "mantenimiento" in tokens


@event.listens_for(CRMOportunidad, "before_insert")
def receive_before_insert(mapper, connection, target):
    """Fuerza estado inicial operativo para oportunidades de mantenimiento."""
    if _is_mantenimiento_tipo_operacion(connection, target.tipo_operacion_id):
        target.estado = EstadoOportunidad.ABIERTA.value
        target.activo = True
    elif target.estado and target.estado != EstadoOportunidad.PROSPECT.value:
        target.activo = True


@event.listens_for(CRMOportunidad, "after_insert")
def receive_after_insert(mapper, connection, target):
    """Genera log inicial cuando la oportunidad nace fuera de prospect."""
    if not target.id or not target.estado or target.estado == EstadoOportunidad.PROSPECT.value:
        return

    from .log_estado import CRMOportunidadLogEstado

    has_log = connection.execute(
        select(CRMOportunidadLogEstado.id).where(
            CRMOportunidadLogEstado.oportunidad_id == target.id
        )
    ).first()
    if has_log:
        return

    descripcion = f"Log inicial generado automaticamente para estado {target.estado}"
    connection.execute(
        insert(CRMOportunidadLogEstado).values(
            oportunidad_id=target.id,
            estado_anterior=EstadoOportunidad.PROSPECT.value,
            estado_nuevo=target.estado,
            descripcion=descripcion,
            usuario_id=target.responsable_id or 1,
            fecha_registro=target.fecha_estado or datetime.now(UTC),
            motivo_perdida_id=target.motivo_perdida_id,
            monto=target.monto,
            moneda_id=target.moneda_id,
            condicion_pago_id=target.condicion_pago_id,
        )
    )
