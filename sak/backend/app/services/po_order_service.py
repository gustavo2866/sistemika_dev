from __future__ import annotations

from datetime import date
from typing import Optional

from sqlmodel import Session, select

from app.models.compras import PoOrder, PoOrderStatus, PoOrderStatusLog


class PoOrderService:
    """Reglas de negocio para órdenes de compra."""

    def cambiar_estado(
        self,
        session: Session,
        order_id: int,
        nuevo_status_id: int,
        usuario_id: int,
        comentario: Optional[str] = None,
        fecha_registro: Optional[date] = None,
    ) -> PoOrder:
        order = session.get(PoOrder, order_id)
        if not order:
            raise ValueError(f"Orden {order_id} no encontrada")

        nuevo_status = session.get(PoOrderStatus, nuevo_status_id)
        if not nuevo_status:
            raise ValueError(f"Estado {nuevo_status_id} no encontrado")

        status_anterior_id = order.order_status_id
        order.order_status_id = nuevo_status_id
        session.add(order)

        log = PoOrderStatusLog(
            order_id=order_id,
            status_anterior_id=status_anterior_id,
            status_nuevo_id=nuevo_status_id,
            usuario_id=usuario_id,
            comentario=comentario,
            fecha_registro=fecha_registro or date.today(),
        )
        session.add(log)
        session.commit()
        session.refresh(order)
        return order


po_order_service = PoOrderService()
