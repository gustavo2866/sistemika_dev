import logging
from typing import Dict
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from app.models.compras import PoOrdenCompra, PoOrdenCompraDetalle
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.core.responses import ErrorCodes
from app.models.base import filtrar_respuesta

logger = logging.getLogger(__name__)

# CRUD con relación anidada para detalles de órdenes de compra
po_orden_compra_crud = NestedCRUD(
    PoOrdenCompra,
    nested_relations={
        "detalles": {
            "model": PoOrdenCompraDetalle,
            "fk_field": "orden_compra_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para órdenes de compra (PO)
po_orden_compra_router = create_generic_router(
    model=PoOrdenCompra,
    crud=po_orden_compra_crud,
    prefix="/po-ordenes-compra",
    tags=["po-ordenes-compra"],
)

def _sanitize_detalle_payloads(payload: Dict) -> None:
    detalles = payload.get("detalles")
    if not isinstance(detalles, list):
        return
    for detalle in detalles:
        if not isinstance(detalle, dict):
            continue
        if not detalle.get("po_solicitud_id"):
            detalle["solicitud_detalle_id"] = None

# Sobreescribir el endpoint POST para agregar logging detallado
@po_orden_compra_router.post("", status_code=201)
def create_orden_compra_debug(
    payload: Dict = Body(...),
    session: Session = Depends(get_session),
):
    """Crear nueva orden de compra con logging detallado"""
    try:
        _sanitize_detalle_payloads(payload)
        logger.info(f"DEBUG: Received payload for po-ordenes-compra: {payload}")
        
        # Validar campos obligatorios
        required_fields = [
            "titulo", "subtotal", "total_impuestos", "total",
            "proveedor_id", "usuario_responsable_id"
        ]
        
        missing_fields = [field for field in required_fields if field not in payload or payload[field] is None]
        if missing_fields:
            logger.error(f"DEBUG: Missing required fields: {missing_fields}")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": ErrorCodes.VALIDATION_ERROR,
                        "message": f"Missing required fields: {', '.join(missing_fields)}",
                        "details": {"missing_fields": missing_fields}
                    }
                }
            )
        
        obj = po_orden_compra_crud.create(session, payload)
        logger.info(f"DEBUG: Successfully created orden de compra with ID: {obj.id}")
        
        # Devolver objeto directo filtrado (formato ra-data-json-server)
        response_data = filtrar_respuesta(obj)
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DEBUG: Error creating orden de compra: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": ErrorCodes.VALIDATION_ERROR,
                    "message": str(e),
                    "details": {}
                }
            }
        )

# Sobreescribir el endpoint PUT para agregar logging detallado
@po_orden_compra_router.put("/{id}", status_code=200)
def update_orden_compra_debug(
    id: int,
    payload: Dict = Body(...),
    session: Session = Depends(get_session),
):
    """Actualizar orden de compra con logging detallado"""
    try:
        _sanitize_detalle_payloads(payload)
        logger.info(f"DEBUG PUT: Received payload for po-ordenes-compra ID {id}: {payload}")
        
        # Verificar que la orden existe
        orden_existente = session.exec(select(PoOrdenCompra).where(PoOrdenCompra.id == id)).first()
        if not orden_existente:
            raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
        
        obj = po_orden_compra_crud.update(session, id, payload)
        logger.info(f"DEBUG PUT: Successfully updated orden de compra with ID: {obj.id}")
        
        # Verificar detalles después de la actualización
        from sqlmodel import select
        detalles = session.exec(select(PoOrdenCompraDetalle).where(PoOrdenCompraDetalle.orden_compra_id == id)).all()
        logger.info(f"DEBUG PUT: Orden {id} tiene {len(detalles)} detalles después de update")
        
        # Devolver objeto directo filtrado
        response_data = filtrar_respuesta(obj)
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DEBUG PUT: Error updating orden de compra: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": ErrorCodes.VALIDATION_ERROR,
                    "message": str(e),
                    "details": {}
                }
            }
        )
