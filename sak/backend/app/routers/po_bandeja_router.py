"""
Endpoints para las bandejas de aprobación del módulo de Compras (PO).

- GET /api/compras/bandeja-compras  → OC emitidas + FC confirmadas
- GET /api/compras/bandeja-pagos    → FC con estado financiero "agendada"
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.db import get_session
from app.models.compras import (
    PoInvoice,
    PoInvoiceStatus,
    PoInvoiceStatusFin,
    PoOrder,
    PoOrderStatus,
)
from app.models.proveedor import Proveedor
from app.models.tipo_solicitud import TipoSolicitud
from app.models.user import User

router = APIRouter(prefix="/api/compras", tags=["compras-bandeja"])

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def _order_to_dict(order: PoOrder) -> dict[str, Any]:
    proveedor = getattr(order, "proveedor", None)
    solicitante = getattr(order, "solicitante", None)
    tipo_solicitud = getattr(order, "tipo_solicitud", None)
    order_status = getattr(order, "order_status", None)
    return {
        "id": order.id,
        "tipo": "oc",
        "numero": str(order.id).zfill(6),
        "titulo": order.titulo,
        "total": float(order.total or 0),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "proveedor_id": order.proveedor_id,
        "proveedor_nombre": proveedor.nombre if proveedor else None,
        "solicitante_id": order.solicitante_id,
        "solicitante_nombre": solicitante.nombre if solicitante else None,
        "tipo_solicitud_id": order.tipo_solicitud_id,
        "tipo_solicitud_nombre": tipo_solicitud.nombre if tipo_solicitud else None,
        "estado_nombre": order_status.nombre if order_status else None,
        "estado_orden": order_status.orden if order_status else None,
    }


def _invoice_to_dict(invoice: PoInvoice) -> dict[str, Any]:
    proveedor = getattr(invoice, "proveedor", None)
    responsable = getattr(invoice, "usuario_responsable", None)
    inv_status = getattr(invoice, "invoice_status", None)
    inv_status_fin = getattr(invoice, "invoice_status_fin", None)
    return {
        "id": invoice.id,
        "tipo": "fc",
        "numero": invoice.numero,
        "titulo": invoice.titulo,
        "total": float(invoice.total or 0),
        "fecha_emision": invoice.fecha_emision,
        "fecha_vencimiento": invoice.fecha_vencimiento,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
        "proveedor_id": invoice.proveedor_id,
        "proveedor_nombre": proveedor.nombre if proveedor else None,
        "responsable_id": invoice.usuario_responsable_id,
        "responsable_nombre": responsable.nombre if responsable else None,
        "estado_nombre": inv_status.nombre if inv_status else None,
        "estado_orden": inv_status.orden if inv_status else None,
        "estado_fin_nombre": inv_status_fin.nombre if inv_status_fin else None,
        "estado_fin_orden": inv_status_fin.orden if inv_status_fin else None,
    }


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #

@router.get("/bandeja-compras")
def get_bandeja_compras(
    q: Optional[str] = Query(None, description="Búsqueda por texto"),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """
    Devuelve las OC en estado 'emitida' y las FC en estado 'confirmada'.
    Ordenadas por fecha de creación ascendente (más antiguas primero).
    """
    # -- OC emitidas --
    stmt_orders = (
        select(PoOrder)
        .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
        .where(PoOrderStatus.nombre.ilike("emitida"))
        .options(
            selectinload(PoOrder.order_status),
            selectinload(PoOrder.proveedor),
            selectinload(PoOrder.solicitante),
            selectinload(PoOrder.tipo_solicitud),
        )
        .order_by(PoOrder.created_at.asc())
        .limit(limit)
    )
    if q:
        stmt_orders = stmt_orders.where(
            PoOrder.titulo.ilike(f"%{q}%")
        )
    orders = session.exec(stmt_orders).all()

    # -- FC confirmadas --
    stmt_invoices = (
        select(PoInvoice)
        .join(PoInvoiceStatus, PoInvoice.invoice_status_id == PoInvoiceStatus.id)
        .where(PoInvoiceStatus.nombre.ilike("confirmada"))
        .options(
            selectinload(PoInvoice.invoice_status),
            selectinload(PoInvoice.invoice_status_fin),
            selectinload(PoInvoice.proveedor),
            selectinload(PoInvoice.usuario_responsable),
        )
        .order_by(PoInvoice.created_at.asc())
        .limit(limit)
    )
    if q:
        stmt_invoices = stmt_invoices.where(
            PoInvoice.titulo.ilike(f"%{q}%") | PoInvoice.numero.ilike(f"%{q}%")
        )
    invoices = session.exec(stmt_invoices).all()

    oc_items = [_order_to_dict(o) for o in orders]
    fc_items = [_invoice_to_dict(i) for i in invoices]

    return {
        "oc": oc_items,
        "fc": fc_items,
        "total_oc": len(oc_items),
        "total_fc": len(fc_items),
        "total": len(oc_items) + len(fc_items),
    }


@router.get("/bandeja-pagos")
def get_bandeja_pagos(
    q: Optional[str] = Query(None, description="Búsqueda por texto"),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """
    Devuelve las FC con estado financiero 'agendada'.
    Ordenadas por fecha de vencimiento ascendente (más urgentes primero).
    """
    stmt = (
        select(PoInvoice)
        .join(PoInvoiceStatusFin, PoInvoice.invoice_status_fin_id == PoInvoiceStatusFin.id)
        .where(PoInvoiceStatusFin.nombre.ilike("agendada"))
        .options(
            selectinload(PoInvoice.invoice_status),
            selectinload(PoInvoice.invoice_status_fin),
            selectinload(PoInvoice.proveedor),
            selectinload(PoInvoice.usuario_responsable),
        )
        .order_by(PoInvoice.fecha_vencimiento.asc().nulls_last())
        .limit(limit)
    )
    if q:
        stmt = stmt.where(
            PoInvoice.titulo.ilike(f"%{q}%") | PoInvoice.numero.ilike(f"%{q}%")
        )
    invoices = session.exec(stmt).all()

    items = [_invoice_to_dict(i) for i in invoices]

    return {
        "items": items,
        "total": len(items),
    }
