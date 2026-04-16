import json
import os
import tempfile
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

from fastapi import Body, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy import String, func, or_
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.api.auth import get_current_user
from app.db import get_session
from app.models.base import filtrar_respuesta, serialize_datetime
from app.models.compras import PoOrder, PoOrderDetail, PoOrderStatus, PoOrderStatusLog
from app.models.po_order_archivo import PoOrderArchivo
from app.models.proveedor import Proveedor
from app.models.tipo_solicitud import TipoSolicitud
from app.models.user import User
from app.services.po_order_service import po_order_service
from app.services.gcs_storage_service import storage_service

_PO_ORDER_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
_PO_ORDER_ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt",
}

# CRUD con relación anidada para detalles de órdenes
po_order_crud = NestedCRUD(
    PoOrder,
    nested_relations={
        "detalles": {
            "model": PoOrderDetail,
            "fk_field": "order_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para órdenes
po_order_router = create_generic_router(
    model=PoOrder,
    crud=po_order_crud,
    prefix="/po-orders",
    tags=["po-orders"],
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


def _extract_search_value(request: Request, q: str | None, filter_value: str | None) -> str | None:
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


def _serialize_po_order_approval_item(order: PoOrder) -> dict[str, Any]:
    total = order.total
    if isinstance(total, Decimal):
        total_value: float | int = float(total)
    else:
        total_value = total if total is not None else 0

    return {
        "id": order.id,
        "titulo": order.titulo,
        "comentario": order.comentario,
        "total": total_value,
        "created_at": serialize_datetime(order.created_at),
        "solicitante_id": order.solicitante_id,
        "proveedor_id": order.proveedor_id,
        "tipo_solicitud_id": order.tipo_solicitud_id,
        "order_status_id": order.order_status_id,
        "solicitante": {
            "id": order.solicitante.id,
            "nombre": order.solicitante.nombre,
        }
        if order.solicitante
        else None,
        "proveedor": {
            "id": order.proveedor.id,
            "nombre": order.proveedor.nombre,
        }
        if order.proveedor
        else None,
        "tipo_solicitud": {
            "id": order.tipo_solicitud.id,
            "nombre": order.tipo_solicitud.nombre,
        }
        if order.tipo_solicitud
        else None,
        "order_status": {
            "id": order.order_status.id,
            "nombre": order.order_status.nombre,
        }
        if order.order_status
        else None,
    }


@po_order_router.get("/approval-feed")
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
        select(PoOrder)
        .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
        .where(func.lower(PoOrderStatus.nombre) == "emitida")
        .where(PoOrder.deleted_at.is_(None))
    )

    if search_value:
        search_term = f"%{search_value}%"
        base_stmt = (
            base_stmt
            .outerjoin(Proveedor, PoOrder.proveedor_id == Proveedor.id)
            .outerjoin(User, PoOrder.solicitante_id == User.id)
            .outerjoin(TipoSolicitud, PoOrder.tipo_solicitud_id == TipoSolicitud.id)
            .where(
                or_(
                    PoOrder.titulo.ilike(search_term),
                    PoOrder.comentario.ilike(search_term),
                    func.cast(PoOrder.id, String).ilike(search_term),
                    Proveedor.nombre.ilike(search_term),
                    User.nombre.ilike(search_term),
                    TipoSolicitud.nombre.ilike(search_term),
                )
            )
        )

    total = session.exec(
        select(func.count()).select_from(base_stmt.order_by(None).subquery())
    ).one()

    sort_column = getattr(PoOrder, sort_by, None)
    if sort_column is None:
        sort_column = PoOrder.created_at

    if str(sort_dir).lower() == "asc":
        ordered_stmt = base_stmt.order_by(sort_column.asc())
    else:
        ordered_stmt = base_stmt.order_by(sort_column.desc())

    offset = (page - 1) * per_page
    items = session.exec(
        ordered_stmt.options(
            selectinload(PoOrder.proveedor),
            selectinload(PoOrder.solicitante),
            selectinload(PoOrder.tipo_solicitud),
            selectinload(PoOrder.order_status),
        )
        .offset(offset)
        .limit(per_page)
    ).all()

    start = offset
    end = min(offset + per_page - 1, total - 1) if total > 0 else 0
    if end < start and total > 0:
        end = start
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"

    return [_serialize_po_order_approval_item(item) for item in items]


@po_order_router.post("/{order_id}/cambiar-estado")
def cambiar_estado(
    order_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Cambia el estado de una orden y registra el log automáticamente."""
    nuevo_status_id = payload.get("nuevo_status_id")
    if not nuevo_status_id:
        raise HTTPException(status_code=400, detail="nuevo_status_id es obligatorio")

    try:
        order = po_order_service.cambiar_estado(
            session=session,
            order_id=order_id,
            nuevo_status_id=int(nuevo_status_id),
            usuario_id=current_user.id,
            comentario=payload.get("comentario"),
            fecha_registro=payload.get("fecha_registro"),
        )
        return filtrar_respuesta(order)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@po_order_router.get("/{order_id}/logs")
def listar_logs(
    order_id: int,
    session: Session = Depends(get_session),
):
    """Devuelve el historial de cambios de estado de una orden."""
    order = session.get(PoOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Orden {order_id} no encontrada")

    logs = session.exec(
        select(PoOrderStatusLog)
        .where(PoOrderStatusLog.order_id == order_id)
        .order_by(PoOrderStatusLog.fecha_registro.asc(), PoOrderStatusLog.id.asc())
    ).all()
    return [log.model_dump() for log in logs]


# --- Upload archivo: POST /po-orders/{id}/archivos ---

@po_order_router.post("/{id}/archivos", tags=["po-orders"])
async def upload_po_order_archivo(
    id: int,
    file: UploadFile = File(...),
    nombre: Optional[str] = Form(default=None),
    tipo: Optional[str] = Form(default=None),
    session: Session = Depends(get_session),
):
    order = session.get(PoOrder, id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")

    content = await file.read()

    if len(content) > _PO_ORDER_MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máximo 20 MB)")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _PO_ORDER_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Tipo de archivo no permitido: {ext}")

    safe_name = f"{uuid.uuid4().hex}{ext}"

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(content)
        gcs_result = storage_service.upload_file(
            tmp_path,
            safe_name,
            folder=f"po-orders/{id}",
            content_type=file.content_type,
        )
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    archivo = PoOrderArchivo(
        order_id=id,
        nombre=nombre or file.filename,
        tipo=tipo,
        archivo_url=gcs_result["download_url"],
        mime_type=file.content_type,
        tamanio_bytes=len(content),
    )
    session.add(archivo)
    session.commit()
    session.refresh(archivo)
    return archivo


# --- Eliminar archivo: DELETE /po-orders/{id}/archivos/{archivo_id} ---

@po_order_router.delete("/{id}/archivos/{archivo_id}", tags=["po-orders"])
def delete_po_order_archivo(
    id: int,
    archivo_id: int,
    session: Session = Depends(get_session),
):
    order = session.get(PoOrder, id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")

    archivo = session.get(PoOrderArchivo, archivo_id)
    if not archivo or archivo.order_id != id:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    try:
        blob_name = storage_service.blob_name_from_download_url(archivo.archivo_url)
        storage_service.delete_file(blob_name)
    except (ValueError, Exception):
        pass  # Si falla la eliminación GCS no bloqueamos el registro

    session.delete(archivo)
    session.commit()
    return {"ok": True}
