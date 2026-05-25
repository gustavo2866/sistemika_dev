"""Servicio para gestión de pedidos de obra (constructora)."""
from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Dict

from sqlmodel import Session, select

from app.models import CRMMensaje
from app.models.constructora.pedido import (
    ConstructoraPedido,
    ConstructoraPedidoDetalle,
    PedidoObraDetalleEstado,
    PedidoObraDetalleOrigen,
    PedidoObraEstado,
    PedidoObraOrigen,
)


class ConstructoraPedidoService:

    def create_from_agent_message(
        self,
        session: Session,
        mensaje_id: int,
    ) -> ConstructoraPedido:
        """Crea un ConstructoraPedido a partir de un CRMMensaje confirmado por el agente.

        Idempotente: si ya existe un pedido para ese mensaje_origen_id lo retorna sin crear uno nuevo.

        Raises:
            ValueError: si el mensaje no existe, no viene del agente, o no tiene pedido_listo=True.
        """
        # Idempotencia: verificar si ya existe
        existing = session.exec(
            select(ConstructoraPedido).where(
                ConstructoraPedido.mensaje_origen_id == mensaje_id
            )
        ).first()
        if existing:
            return existing

        # Cargar mensaje
        mensaje = session.get(CRMMensaje, mensaje_id)
        if not mensaje:
            raise ValueError(f"Mensaje {mensaje_id} no encontrado")

        # Leer result del agente
        metadata = mensaje.metadata_json or {}
        agent_v2 = metadata.get("agent_v2") or {}
        result = agent_v2.get("result") or {}

        if result.get("type") != "pedido_obra_reply":
            raise ValueError(
                f"Mensaje {mensaje_id} no contiene resultado de pedido_obra_reply"
            )
        if not result.get("pedido_listo"):
            raise ValueError(
                f"Mensaje {mensaje_id} no tiene pedido_listo=True"
            )

        oportunidad_id = result.get("oportunidad_id") or mensaje.oportunidad_id
        if not oportunidad_id:
            raise ValueError(
                f"Mensaje {mensaje_id} no tiene oportunidad_id"
            )

        items = result.get("items") or []

        # Crear pedido
        pedido = ConstructoraPedido(
            oportunidad_id=oportunidad_id,
            contacto_id=mensaje.contacto_id,
            mensaje_origen_id=mensaje_id,
            estado=PedidoObraEstado.PENDIENTE,
            origen=PedidoObraOrigen.AGENTE,
            titulo=f"Pedido de obra — oportunidad #{oportunidad_id}",
            fecha_confirmacion_agente=datetime.now(UTC),
        )
        session.add(pedido)
        session.flush()  # obtener pedido.id

        # Crear líneas
        for orden, item in enumerate(items):
            cantidad_raw = item.get("cantidad")
            try:
                cantidad = Decimal(str(cantidad_raw)) if cantidad_raw is not None else Decimal("1")
            except Exception:
                cantidad = Decimal("1")

            detalle = ConstructoraPedidoDetalle(
                pedido_id=pedido.id,
                descripcion_original=item.get("descripcion"),
                descripcion=item.get("descripcion"),
                cantidad=cantidad,
                cantidad_original=cantidad,
                unidad_medida=item.get("unidad"),
                estado=PedidoObraDetalleEstado.ACTIVA,
                origen=PedidoObraDetalleOrigen.AGENTE,
                orden=orden,
                metadata_json={"agent_item_id": item.get("item_id")},
            )
            session.add(detalle)

        # Escribir pedido_obra_id de vuelta en el mensaje
        # Construimos un dict nuevo para forzar el change-tracking de SQLAlchemy
        import copy
        from sqlalchemy.orm.attributes import flag_modified

        new_metadata = copy.deepcopy(metadata)
        new_metadata["agent_v2"]["pedido_obra_id"] = pedido.id
        mensaje.metadata_json = new_metadata
        flag_modified(mensaje, "metadata_json")

        session.commit()
        session.refresh(pedido)
        return pedido


constructora_pedido_service = ConstructoraPedidoService()
