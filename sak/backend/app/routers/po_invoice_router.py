import logging
from datetime import UTC, datetime
from typing import Dict, Iterable, Set

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import case, func

from app.models.compras import (
    PoInvoice,
    PoInvoiceDetail,
    PoInvoiceTax,
    PoOrder,
    PoOrderDetail,
    PoOrderStatus,
)
from app.core.generic_crud import GenericCRUD
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.core.responses import ErrorCodes
from app.models.base import current_utc_time, filtrar_respuesta

logger = logging.getLogger(__name__)

# --- helpers: actualizar estado de ordenes relacionadas ---
STATUS_ORDER_MAP: dict[str, int] = {
    "aprobada": 4,
    "en_proceso": 6,
    "facturada": 7,
}

def _resolve_po_order_status_ids(session: Session) -> dict[str, int]:
    orders = {value for value in STATUS_ORDER_MAP.values()}
    rows = session.exec(
        select(PoOrderStatus).where(PoOrderStatus.orden.in_(orders))
    ).all()
    by_order = {row.orden: row.id for row in rows}

    resolved: dict[str, int] = {}
    for key, order_value in STATUS_ORDER_MAP.items():
        if order_value not in by_order:
            raise ValueError(
                f"No se encontro estado con orden {order_value} para '{key}' en po_order_status"
            )
        resolved[key] = by_order[order_value]
    return resolved

def _collect_po_order_ids_for_invoice(session: Session, invoice_id: int) -> Set[int]:
    if not invoice_id:
        return set()
    stmt = (
        select(PoOrderDetail.order_id)
        .join(
            PoInvoiceDetail,
            PoInvoiceDetail.poOrderDetail_id == PoOrderDetail.id,
        )
        .where(PoInvoiceDetail.invoice_id == invoice_id)
        .where(PoInvoiceDetail.deleted_at.is_(None))
    )
    ids = session.exec(stmt).all()
    return {order_id for order_id in ids if order_id is not None}

def _recalc_po_order_statuses(session: Session, order_ids: Iterable[int]) -> None:
    order_ids_list = [order_id for order_id in order_ids if order_id]
    if not order_ids_list:
        return

    status_ids = _resolve_po_order_status_ids(session)

    fact_sub = (
        select(
            PoInvoiceDetail.poOrderDetail_id.label("detail_id"),
            func.coalesce(func.sum(PoInvoiceDetail.cantidad), 0).label("facturada"),
        )
        .join(PoInvoice, PoInvoice.id == PoInvoiceDetail.invoice_id)
        .where(PoInvoiceDetail.deleted_at.is_(None))
        .where(PoInvoice.deleted_at.is_(None))
        .group_by(PoInvoiceDetail.poOrderDetail_id)
    ).subquery()

    stmt = (
        select(
            PoOrderDetail.order_id.label("order_id"),
            func.count(PoOrderDetail.id).label("total_lines"),
            func.sum(
                case(
                    (fact_sub.c.facturada > 0, 1),
                    else_=0,
                )
            ).label("lines_facturada"),
            func.sum(
                case(
                    (fact_sub.c.facturada >= PoOrderDetail.cantidad, 1),
                    else_=0,
                )
            ).label("lines_full"),
        )
        .select_from(PoOrderDetail)
        .outerjoin(fact_sub, fact_sub.c.detail_id == PoOrderDetail.id)
        .where(PoOrderDetail.deleted_at.is_(None))
        .where(PoOrderDetail.order_id.in_(order_ids_list))
        .group_by(PoOrderDetail.order_id)
    )

    rows = session.exec(stmt).all()
    aggregates = {
        row.order_id: {
            "total": int(row.total_lines or 0),
            "facturada": int(row.lines_facturada or 0),
            "full": int(row.lines_full or 0),
        }
        for row in rows
    }

    orders = session.exec(
        select(PoOrder).where(
            PoOrder.id.in_(order_ids_list),
            PoOrder.deleted_at.is_(None),
        )
    ).all()

    updated = False
    for order in orders:
        stats = aggregates.get(order.id, {"total": 0, "facturada": 0, "full": 0})
        total = stats["total"]
        facturada = stats["facturada"]
        full = stats["full"]

        if facturada == 0:
            next_status_id = status_ids["aprobada"]
        elif total > 0 and full == total:
            next_status_id = status_ids["facturada"]
        else:
            next_status_id = status_ids["en_proceso"]

        if order.order_status_id != next_status_id:
            order.order_status_id = next_status_id
            order.updated_at = current_utc_time()
            session.add(order)
            updated = True

    if updated:
        session.flush()


class PoInvoiceCRUD(NestedCRUD):
    def create(self, session: Session, data: Dict):
        data_copy = dict(data)
        nested_payloads = self._extract_nested_payloads(data_copy)
        try:
            obj = GenericCRUD.create(self, session, data_copy, auto_commit=False)

            if nested_payloads:
                self._sync_nested_relations(session, obj, nested_payloads, is_create=True)

            session.flush()
            affected_orders = _collect_po_order_ids_for_invoice(session, obj.id)
            _recalc_po_order_statuses(session, affected_orders)

            session.commit()
            session.refresh(obj)
            return obj
        except Exception:
            session.rollback()
            raise

    def update(
        self,
        session: Session,
        obj_id: int,
        data: Dict,
        check_version: bool = True,
    ):
        data_copy = dict(data)
        nested_payloads = self._extract_nested_payloads(data_copy)
        before_orders = _collect_po_order_ids_for_invoice(session, obj_id)

        try:
            obj = GenericCRUD.update(
                self,
                session,
                obj_id,
                data_copy,
                check_version=check_version,
                auto_commit=False,
            )

            if obj and nested_payloads:
                self._sync_nested_relations(session, obj, nested_payloads, is_create=False)

            session.flush()
            after_orders = _collect_po_order_ids_for_invoice(session, obj_id)
            affected_orders = before_orders | after_orders
            _recalc_po_order_statuses(session, affected_orders)

            session.commit()
            session.refresh(obj)
            return obj
        except Exception:
            session.rollback()
            raise

    def update_partial(self, session: Session, obj_id: int, data: Dict):
        return self.update(session, obj_id, data, check_version=False)

    def delete(self, session: Session, obj_id: int, hard: bool = False) -> bool:
        obj = self.get(session, obj_id)
        if not obj:
            return False

        affected_orders = _collect_po_order_ids_for_invoice(session, obj_id)

        if hard or not hasattr(obj, "deleted_at"):
            session.delete(obj)
        else:
            setattr(obj, "deleted_at", datetime.now(UTC))
            if hasattr(obj, "updated_at"):
                setattr(obj, "updated_at", datetime.now(UTC))
            session.add(obj)

        try:
            session.flush()
            _recalc_po_order_statuses(session, affected_orders)
            session.commit()
            return True
        except Exception:
            session.rollback()
            raise

# CRUD con relaciones anidadas para detalles y taxes de facturas
po_invoice_crud = PoInvoiceCRUD(
    PoInvoice,
    nested_relations={
        "detalles": {
            "model": PoInvoiceDetail,
            "fk_field": "invoice_id",
            "allow_delete": True,
        },
        "taxes": {
            "model": PoInvoiceTax,
            "fk_field": "invoice_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para facturas (PO Invoice)
po_invoice_router = create_generic_router(
    model=PoInvoice,
    crud=po_invoice_crud,
    prefix="/po-invoices",
    tags=["po-invoices"],
)
