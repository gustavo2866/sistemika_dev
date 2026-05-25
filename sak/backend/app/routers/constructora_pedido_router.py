from fastapi import Depends, HTTPException
from sqlmodel import Session
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.constructora.pedido import (
    ConstructoraPedido,
    ConstructoraPedidoDetalle,
    PedidoObraDetalleOrigen,
)
from app.models.base import filtrar_respuesta
from app.services.constructora_pedido_service import constructora_pedido_service


def _prepare_pedido_detalle_payload(payload: dict, *, is_create: bool, is_new: bool) -> dict:
    if not is_new:
        return payload
    if payload.get("cantidad_original") not in (None, "") or payload.get("cantidad") in (None, ""):
        return payload
    return {**payload, "cantidad_original": payload["cantidad"]}


def _delete_unless_agent_pedido_detalle(session: Session, detalle: ConstructoraPedidoDetalle) -> None:
    origen = getattr(detalle.origen, "value", detalle.origen)
    if str(origen).strip().lower() == PedidoObraDetalleOrigen.AGENTE.value:
        # Las lineas de agente no se eliminan ni cambian de estado por omision
        # en el payload. El rechazo se expresa editando cantidad = 0.
        session.add(detalle)
        return
    session.delete(detalle)


constructora_pedido_crud = NestedCRUD(
    ConstructoraPedido,
    nested_relations={
        "detalles": {
            "model": ConstructoraPedidoDetalle,
            "fk_field": "pedido_id",
            "allow_delete": True,
            "prepare_payload": _prepare_pedido_detalle_payload,
            "delete_handler": _delete_unless_agent_pedido_detalle,
        }
    },
)

constructora_pedido_router = create_generic_router(
    model=ConstructoraPedido,
    crud=constructora_pedido_crud,
    prefix="/constructora/pedidos",
    tags=["constructora-pedidos"],
)


@constructora_pedido_router.post("/from-agent-message/{mensaje_id}", status_code=201)
def create_from_agent_message(
    mensaje_id: int,
    session: Session = Depends(get_session),
):
    """Crea un pedido de obra a partir de un mensaje confirmado por el agente. Idempotente."""
    try:
        pedido = constructora_pedido_service.create_from_agent_message(session, mensaje_id)
        return filtrar_respuesta(pedido)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
