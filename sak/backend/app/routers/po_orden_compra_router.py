import logging
from typing import Dict
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from app.models.compras import (
    PoOrdenCompra,
    PoOrdenCompraDetalle,
    PoSolicitud,
    PoSolicitudDetalle,
    EstadoPoSolicitud,
)
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.core.responses import ErrorCodes
from app.models.base import current_utc_time, filtrar_respuesta
from app.models.compras import EstadoPoSolicitud

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
        if not detalle.get("solicitud_detalle_id"):
            detalle["solicitud_detalle_id"] = None


def _extract_solicitud_ids_from_detalles(
    session: Session, detalles: list
) -> set[int]:
    solicitud_ids: set[int] = set()

    solicitud_detalle_ids = {
        int(det.get("solicitud_detalle_id"))
        for det in detalles
        if isinstance(det, dict)
        and det.get("solicitud_detalle_id") not in (None, "", 0)
    }
    if solicitud_detalle_ids:
        detalles_db = session.exec(
            select(PoSolicitudDetalle).where(PoSolicitudDetalle.id.in_(solicitud_detalle_ids))
        ).all()
        for detalle_db in detalles_db:
            if detalle_db.solicitud_id:
                solicitud_ids.add(int(detalle_db.solicitud_id))

    # Compatibilidad temporal si llega solicitud_id/po_solicitud_id directo
    for det in detalles:
        if not isinstance(det, dict):
            continue
        direct_id = det.get("solicitud_id") or det.get("po_solicitud_id")
        if direct_id not in (None, "", 0):
            solicitud_ids.add(int(direct_id))

    return solicitud_ids

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
        # No asignar defaults en backend para validar el payload recibido.
        
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

        # Actualizar estado de solicitudes vinculadas a "en_proceso"
        detalles = payload.get("detalles")
        if isinstance(detalles, list):
            solicitud_ids = _extract_solicitud_ids_from_detalles(session, detalles)
            if solicitud_ids:
                solicitudes = session.exec(
                    select(PoSolicitud).where(PoSolicitud.id.in_(solicitud_ids))
                ).all()
                for solicitud in solicitudes:
                    solicitud.estado = EstadoPoSolicitud.EN_PROCESO.value
                    session.add(solicitud)
                session.commit()
        
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

        if payload.get("estado") and payload.get("estado") != orden_existente.estado:
            payload["fecha_estado"] = current_utc_time()
        
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

# Sobreescribir el endpoint DELETE para restaurar solicitudes vinculadas
@po_orden_compra_router.delete("/{id}", status_code=200)
def delete_orden_compra_restore_solicitudes(
    id: int,
    session: Session = Depends(get_session),
    hard: bool = False,
):
    """Eliminar orden de compra y restaurar solicitudes asociadas a estado 'aprobada'."""
    try:
        orden = session.exec(select(PoOrdenCompra).where(PoOrdenCompra.id == id)).first()
        if not orden:
            raise HTTPException(status_code=404, detail="Orden de compra no encontrada")

        detalles = session.exec(
            select(PoOrdenCompraDetalle).where(PoOrdenCompraDetalle.orden_compra_id == id)
        ).all()
        solicitud_detalle_ids = {
            int(det.solicitud_detalle_id)
            for det in detalles
            if det.solicitud_detalle_id not in (None, "", 0)
        }
        solicitud_ids = set()
        if solicitud_detalle_ids:
            detalles_db = session.exec(
                select(PoSolicitudDetalle).where(PoSolicitudDetalle.id.in_(solicitud_detalle_ids))
            ).all()
            for detalle_db in detalles_db:
                if detalle_db.solicitud_id:
                    solicitud_ids.add(int(detalle_db.solicitud_id))

        # Compatibilidad temporal si ya viene solicitud_id directo en el detalle
        for det in detalles:
            direct_id = getattr(det, "solicitud_id", None)
            if direct_id not in (None, "", 0):
                solicitud_ids.add(int(direct_id))
        if solicitud_ids:
            solicitudes = session.exec(
                select(PoSolicitud).where(PoSolicitud.id.in_(solicitud_ids))
            ).all()
            for solicitud in solicitudes:
                solicitud.estado = EstadoPoSolicitud.APROBADA.value
                session.add(solicitud)

        # devolver la OC antes de eliminar
        response_data = filtrar_respuesta(orden)

        if hard or not hasattr(orden, "deleted_at"):
            session.delete(orden)
        else:
            orden.deleted_at = current_utc_time()
            if hasattr(orden, "updated_at"):
                orden.updated_at = current_utc_time()
            session.add(orden)

        session.commit()
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DEBUG DELETE: Error deleting orden de compra: {str(e)}", exc_info=True)
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
