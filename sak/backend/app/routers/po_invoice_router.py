import json
import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, Set

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response
from sqlmodel import Session, select
from sqlalchemy import String, case, func, or_
from sqlalchemy.orm import selectinload

from app.models.compras import (
    PoInvoice,
    PoInvoiceDetail,
    PoInvoiceStatus,
    PoInvoiceStatusFin,
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
from app.models.base import current_utc_time, filtrar_respuesta, serialize_datetime
from app.models.proveedor import Proveedor
from app.models.user import User

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


def _parse_list_pagination(
    sort: str | None,
    range_value: str | None,
    page: int,
    per_page: int,
    sort_by: str,
    sort_dir: str,
) -> tuple[int, int, str, str]:
    if range_value:
        try:
            range_parsed = json.loads(range_value)
            start, end = int(range_parsed[0]), int(range_parsed[1])
            size = end - start + 1
            if size > 0:
                page = (start // size) + 1
                per_page = size
        except (ValueError, TypeError, json.JSONDecodeError, IndexError):
            pass

    if sort:
        try:
            sort_parsed = json.loads(sort)
            if len(sort_parsed) > 0:
                sort_by = str(sort_parsed[0] or sort_by)
            if len(sort_parsed) > 1:
                parsed_dir = str(sort_parsed[1] or sort_dir).lower()
                if parsed_dir in {"asc", "desc"}:
                    sort_dir = parsed_dir
        except (TypeError, json.JSONDecodeError, IndexError):
            pass

    return page, per_page, sort_by, sort_dir


def _extract_search_value(
    request: Request,
    q: str | None,
    filter_value: str | None,
) -> str | None:
    if q and q.strip():
        return q.strip()

    if filter_value:
        try:
            parsed_filter = json.loads(filter_value)
            if isinstance(parsed_filter, dict):
                raw_q = parsed_filter.get("q")
                if isinstance(raw_q, str) and raw_q.strip():
                    return raw_q.strip()
        except json.JSONDecodeError:
            pass

    raw_query = request.query_params.get("q")
    if raw_query and raw_query.strip():
        return raw_query.strip()

    return None


def _serialize_po_invoice_approval_item(invoice: PoInvoice) -> dict[str, Any]:
    total = invoice.total
    if isinstance(total, Decimal):
        total_value: float | int = float(total)
    else:
        total_value = total if total is not None else 0

    return {
        "id": invoice.id,
        "numero": invoice.numero,
        "titulo": invoice.titulo,
        "total": total_value,
        "created_at": serialize_datetime(invoice.created_at),
        "fecha_emision": invoice.fecha_emision,
        "fecha_vencimiento": invoice.fecha_vencimiento,
        "proveedor_id": invoice.proveedor_id,
        "usuario_responsable_id": invoice.usuario_responsable_id,
        "invoice_status_id": invoice.invoice_status_id,
        "invoice_status_fin_id": invoice.invoice_status_fin_id,
        "proveedor": {
            "id": invoice.proveedor.id,
            "nombre": invoice.proveedor.nombre,
        }
        if invoice.proveedor
        else None,
        "usuario_responsable": {
            "id": invoice.usuario_responsable.id,
            "nombre": invoice.usuario_responsable.nombre,
        }
        if invoice.usuario_responsable
        else None,
        "invoice_status": {
            "id": invoice.invoice_status.id,
            "nombre": invoice.invoice_status.nombre,
            "orden": invoice.invoice_status.orden,
        }
        if invoice.invoice_status
        else None,
        "invoice_status_fin": {
            "id": invoice.invoice_status_fin.id,
            "nombre": invoice.invoice_status_fin.nombre,
            "orden": invoice.invoice_status_fin.orden,
        }
        if invoice.invoice_status_fin
        else None,
    }


@po_invoice_router.get("/approval-feed")
def approval_feed(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    sort: str | None = Query(None, description="Sort array ra-data-simple-rest: [field,order]"),
    range: str | None = Query(None, description="Range array ra-data-simple-rest: [start,end]"),
    filter: str | None = Query(None, description="Filter object ra-data-simple-rest"),
    q: str | None = Query(None, description="Busqueda libre"),
    page: int = Query(1, ge=1),
    perPage: int = Query(10, ge=1, le=50),
    sortBy: str = Query("created_at"),
    sortDir: str = Query("desc", pattern="^(asc|desc|ASC|DESC)$"),
):
    page, per_page, sort_by, sort_dir = _parse_list_pagination(
        sort=sort,
        range_value=range,
        page=page,
        per_page=perPage,
        sort_by=sortBy,
        sort_dir=sortDir.lower(),
    )
    search_value = _extract_search_value(request, q=q, filter_value=filter)

    base_stmt = (
        select(PoInvoice)
        .join(PoInvoiceStatus, PoInvoice.invoice_status_id == PoInvoiceStatus.id)
        .where(func.lower(PoInvoiceStatus.nombre) == "confirmada")
        .where(PoInvoice.deleted_at.is_(None))
    )

    if search_value:
        search_term = f"%{search_value}%"
        base_stmt = (
            base_stmt
            .outerjoin(Proveedor, PoInvoice.proveedor_id == Proveedor.id)
            .outerjoin(User, PoInvoice.usuario_responsable_id == User.id)
            .where(
                or_(
                    PoInvoice.titulo.ilike(search_term),
                    PoInvoice.numero.ilike(search_term),
                    Proveedor.nombre.ilike(search_term),
                    User.nombre.ilike(search_term),
                )
            )
        )

    total = session.exec(
        select(func.count()).select_from(base_stmt.order_by(None).subquery())
    ).one()

    sort_column = getattr(PoInvoice, sort_by, None)
    if sort_column is None:
        sort_column = PoInvoice.created_at

    if str(sort_dir).lower() == "asc":
        ordered_stmt = base_stmt.order_by(sort_column.asc())
    else:
        ordered_stmt = base_stmt.order_by(sort_column.desc())

    offset = (page - 1) * per_page
    items = session.exec(
        ordered_stmt.options(
            selectinload(PoInvoice.proveedor),
            selectinload(PoInvoice.usuario_responsable),
            selectinload(PoInvoice.invoice_status),
            selectinload(PoInvoice.invoice_status_fin),
        )
        .offset(offset)
        .limit(per_page)
    ).all()

    start = offset
    end = min(offset + per_page - 1, total - 1) if total > 0 else 0
    if end < start and total > 0:
        end = start
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"

    return [_serialize_po_invoice_approval_item(item) for item in items]


@po_invoice_router.get("/payment-feed")
def payment_feed(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    sort: str | None = Query(None, description="Sort array ra-data-simple-rest: [field,order]"),
    range: str | None = Query(None, description="Range array ra-data-simple-rest: [start,end]"),
    filter: str | None = Query(None, description="Filter object ra-data-simple-rest"),
    q: str | None = Query(None, description="Busqueda libre"),
    page: int = Query(1, ge=1),
    perPage: int = Query(10, ge=1, le=50),
    sortBy: str = Query("fecha_vencimiento"),
    sortDir: str = Query("asc", pattern="^(asc|desc|ASC|DESC)$"),
):
    page, per_page, sort_by, sort_dir = _parse_list_pagination(
        sort=sort,
        range_value=range,
        page=page,
        per_page=perPage,
        sort_by=sortBy,
        sort_dir=sortDir.lower(),
    )
    search_value = _extract_search_value(request, q=q, filter_value=filter)

    base_stmt = (
        select(PoInvoice)
        .join(PoInvoiceStatusFin, PoInvoice.invoice_status_fin_id == PoInvoiceStatusFin.id)
        .where(func.lower(PoInvoiceStatusFin.nombre) == "agendada")
        .where(PoInvoice.deleted_at.is_(None))
    )

    if search_value:
        search_term = f"%{search_value}%"
        base_stmt = (
            base_stmt
            .outerjoin(Proveedor, PoInvoice.proveedor_id == Proveedor.id)
            .outerjoin(User, PoInvoice.usuario_responsable_id == User.id)
            .where(
                or_(
                    PoInvoice.titulo.ilike(search_term),
                    PoInvoice.numero.ilike(search_term),
                    Proveedor.nombre.ilike(search_term),
                    User.nombre.ilike(search_term),
                )
            )
        )

    total = session.exec(
        select(func.count()).select_from(base_stmt.order_by(None).subquery())
    ).one()

    sort_column = getattr(PoInvoice, sort_by, None)
    if sort_column is None:
        sort_column = PoInvoice.fecha_vencimiento

    if str(sort_dir).lower() == "asc":
        ordered_stmt = base_stmt.order_by(sort_column.asc().nulls_last())
    else:
        ordered_stmt = base_stmt.order_by(sort_column.desc().nulls_last())

    offset = (page - 1) * per_page
    items = session.exec(
        ordered_stmt.options(
            selectinload(PoInvoice.proveedor),
            selectinload(PoInvoice.usuario_responsable),
            selectinload(PoInvoice.invoice_status),
            selectinload(PoInvoice.invoice_status_fin),
        )
        .offset(offset)
        .limit(per_page)
    ).all()

    start = offset
    end = min(offset + per_page - 1, total - 1) if total > 0 else 0
    if end < start and total > 0:
        end = start
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"

    return [_serialize_po_invoice_approval_item(item) for item in items]
