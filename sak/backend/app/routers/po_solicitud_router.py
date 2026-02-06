from datetime import date
from typing import Dict
from fastapi import Body, Depends, HTTPException
from sqlmodel import Session, select

from app.core.responses import ErrorCodes
from app.db import get_session
from app.models.base import current_utc_time, filtrar_respuesta
from app.models.compras import (
    EstadoPoOrdenCompra,
    EstadoPoSolicitud,
    PoOrdenCompra,
    PoOrdenCompraDetalle,
    PoSolicitud,
    PoSolicitudDetalle,
)
from app.models.enums import TipoCompra
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router

# CRUD con relación anidada para detalles de solicitud de compra
po_solicitud_crud = NestedCRUD(
    PoSolicitud,
    nested_relations={
        "detalles": {
            "model": PoSolicitudDetalle,
            "fk_field": "solicitud_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para solicitudes de compra (PO)
po_solicitud_router = create_generic_router(
    model=PoSolicitud,
    crud=po_solicitud_crud,
    prefix="/po-solicitudes",
    tags=["po-solicitudes"],
)


@po_solicitud_router.post("/{id}/aprobar", status_code=200)
def aprobar_solicitud(
    id: int,
    payload: Dict = Body(default={}),
    session: Session = Depends(get_session),
):
    solicitud = session.exec(select(PoSolicitud).where(PoSolicitud.id == id)).first()
    if not solicitud:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": ErrorCodes.NOT_FOUND,
                    "message": "Solicitud no encontrada",
                    "details": {"id": id},
                }
            },
        )

    tipo_compra = payload.get("tipo_compra") or getattr(solicitud, "tipo_compra", None)
    if isinstance(tipo_compra, str):
        tipo_compra = tipo_compra.strip().lower()
    else:
        tipo_compra = None

    # Fallback: si no se informa, inferir directa por proveedor.
    if tipo_compra is None:
        tipo_compra = "directa" if solicitud.proveedor_id else "normal"

    if tipo_compra == TipoCompra.DIRECTA.value:
        if not solicitud.proveedor_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": ErrorCodes.VALIDATION_ERROR,
                        "message": "La solicitud directa requiere proveedor",
                        "details": {"proveedor_id": None},
                    }
                },
            )

        usuario_responsable_id = payload.get("usuario_responsable_id") or solicitud.solicitante_id
        metodo_pago_id = payload.get("metodo_pago_id") or 1

        total = solicitud.total or 0
        orden = PoOrdenCompra(
            titulo=solicitud.titulo,
            estado=EstadoPoOrdenCompra.APROBADA.value,
            observaciones=solicitud.comentario,
            subtotal=total,
            total_impuestos=0,
            total=total,
            proveedor_id=solicitud.proveedor_id,
            usuario_responsable_id=usuario_responsable_id,
            metodo_pago_id=metodo_pago_id,
            centro_costo_id=solicitud.centro_costo_id,
            tipo_solicitud_id=solicitud.tipo_solicitud_id,
            oportunidad_id=solicitud.oportunidad_id,
            fecha=date.today(),
            fecha_estado=current_utc_time(),
            departamento_id=solicitud.departamento_id,
            tipo_compra=TipoCompra.DIRECTA,
        )

        detalles = []
        for detalle in solicitud.detalles or []:
            cantidad = detalle.cantidad or 0
            precio = detalle.precio or 0
            subtotal = detalle.importe or (cantidad * precio)
            detalles.append(
                PoOrdenCompraDetalle(
                    descripcion=detalle.descripcion,
                    cantidad=cantidad,
                    unidad_medida=detalle.unidad_medida,
                    precio_unitario=precio,
                    subtotal=subtotal,
                    total_linea=subtotal,
                    articulo_id=detalle.articulo_id,
                    centro_costo_id=solicitud.centro_costo_id,
                    oportunidad_id=solicitud.oportunidad_id,
                )
            )

        orden.detalles = detalles
        session.add(orden)

        solicitud.estado = EstadoPoSolicitud.FINALIZADA.value
        session.add(solicitud)
        session.commit()
        session.refresh(solicitud)
        session.refresh(orden)

        return {
            "solicitud": filtrar_respuesta(solicitud),
            "orden_compra": filtrar_respuesta(orden),
        }

    solicitud.estado = EstadoPoSolicitud.APROBADA.value
    session.add(solicitud)
    session.commit()
    session.refresh(solicitud)
    return filtrar_respuesta(solicitud)
