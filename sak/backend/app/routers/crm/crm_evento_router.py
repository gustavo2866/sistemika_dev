import calendar
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import Depends, Request, Response, Query, HTTPException
from sqlalchemy import and_, func, or_
from sqlmodel import Session, select

from app.core.router import create_generic_router, flatten_nested_filters
from app.crud.crm_evento_crud import crm_evento_crud
from app.db import get_session
from app.models import CRMEvento
from app.models.base import filtrar_respuesta
from app.models.enums import EstadoEvento

# Router genérico simple - validaciones en frontend
crm_evento_router = create_generic_router(
    model=CRMEvento,
    crud=crm_evento_crud,
    prefix="/crm/eventos",
    tags=["crm-eventos"],
)


def _build_filters(request: Request) -> dict[str, Any]:
    filters: dict[str, Any] = {}
    reserved = {"sort", "range", "page", "perPage"}

    for key in request.query_params.keys():
        if key in reserved:
            continue
        if key == "filter":
            try:
                raw = request.query_params[key]
                parsed = json.loads(raw)
                flat = flatten_nested_filters(parsed)
                filters.update(flat)
            except json.JSONDecodeError:
                continue
            continue
        values = request.query_params.getlist(key)
        if len(values) == 1:
            filters[key] = values[0]
        elif len(values) > 1:
            filters[key] = values
    return filters


@crm_evento_router.get("/aggregates/estado")
def eventos_estado_aggregate(
    request: Request,
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)
    base_filters = {k: v for k, v in filters.items() if k != "estado_evento"}

    stmt = select(CRMEvento.estado_evento, func.count()).group_by(CRMEvento.estado_evento)
    stmt = crm_evento_crud._apply_filters(stmt, base_filters)
    rows = session.exec(stmt).all()
    data = [{"estado": estado, "total": total} for estado, total in rows]
    return {"data": data}


@crm_evento_router.get("/default")
def eventos_default_list(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    sort: Optional[str] = Query(None, description="Sort array ra-data-simple-rest: [field,order]"),
    range: Optional[str] = Query(None, description="Range array ra-data-simple-rest: [start,end]"),
    filter: Optional[str] = Query(None, description="Filter object ra-data-simple-rest"),
    _start: int = Query(None, description="Start index ra-data-json-server"),
    _end: int = Query(None, description="End index ra-data-json-server"),
    _sort: str = Query(None, description="Sort field ra-data-json-server"),
    _order: str = Query(None, pattern="^(ASC|DESC)$", description="Sort direction ra-data-json-server"),
    q: Optional[str] = Query(None, description="Busqueda de texto"),
    page: int = Query(1, ge=1, description="Numero de pagina"),
    perPage: int = Query(25, ge=1, le=300, description="Items por pagina"),
    sortBy: str = Query("created_at", description="Campo para ordenar"),
    sortDir: str = Query("asc", pattern="^(asc|desc)$", description="Direccion del ordenamiento"),
    fields: Optional[str] = Query(None, description="Campos a incluir (CSV)"),
    include: Optional[str] = Query(None, description="Relaciones a incluir (CSV)"),
    deleted: str = Query("exclude", pattern="^(include|only|exclude)$", description="Manejo de elementos eliminados"),
):
    try:
        if sort is not None or range is not None:
            if range:
                try:
                    range_parsed = json.loads(range)
                    start, end = range_parsed[0], range_parsed[1]
                    page = (start // (end - start + 1)) + 1 if (end - start + 1) > 0 else 1
                    per_page = end - start + 1
                except (json.JSONDecodeError, IndexError):
                    page, per_page = 1, 25
            else:
                page, per_page = 1, 25

            if sort:
                try:
                    sort_parsed = json.loads(sort)
                    sort_by = sort_parsed[0] if len(sort_parsed) > 0 else "id"
                    sort_dir = sort_parsed[1].lower() if len(sort_parsed) > 1 else "asc"
                except (json.JSONDecodeError, IndexError):
                    sort_by, sort_dir = "id", "asc"
            else:
                sort_by, sort_dir = "id", "asc"
        elif _start is not None and _end is not None:
            page = (_start // (_end - _start)) + 1 if (_end - _start) > 0 else 1
            per_page = _end - _start
            sort_by = _sort if _sort else "id"
            sort_dir = _order.lower() if _order else "asc"
        else:
            per_page = perPage
            sort_by = sortBy
            sort_dir = sortDir

        filters = {}
        if q:
            filters["q"] = q

        query_params = dict(request.query_params)
        reserved_params = {
            "sort",
            "range",
            "filter",
            "_start",
            "_end",
            "_sort",
            "_order",
            "q",
            "page",
            "perPage",
            "sortBy",
            "sortDir",
            "fields",
            "include",
            "deleted",
        }

        for param_name, param_value in query_params.items():
            if param_name not in reserved_params and param_value:
                if param_name.endswith("_id") and param_value.isdigit():
                    filters[param_name] = int(param_value)
                else:
                    filters[param_name] = param_value

        if filter:
            try:
                json_filters = json.loads(filter)
                flat_filters = flatten_nested_filters(json_filters)
                filters.update(flat_filters)
            except json.JSONDecodeError:
                raise ValueError("Formato de filtro JSON invalido")

        stmt = select(CRMEvento)
        stmt = crm_evento_crud._apply_auto_includes(stmt)
        if filters:
            stmt = crm_evento_crud._apply_filters(stmt, filters)
        stmt = crm_evento_crud._apply_soft_delete_filter(stmt, deleted)

        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        last_day = calendar.monthrange(now.year, now.month)[1]
        month_end = datetime(now.year, now.month, last_day, 23, 59, 59, 999999)

        pending = CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value
        done = CRMEvento.estado_evento.in_(
            [EstadoEvento.REALIZADO.value, EstadoEvento.CANCELADO.value]
        )
        month_condition = and_(
            CRMEvento.fecha_evento >= month_start,
            CRMEvento.fecha_evento <= month_end,
        )
        stmt = stmt.where(or_(pending, and_(done, month_condition)))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.exec(count_stmt).one()

        if hasattr(CRMEvento, sort_by):
            order_column = getattr(CRMEvento, sort_by)
            stmt = stmt.order_by(order_column.desc() if sort_dir.lower() == "desc" else order_column.asc())

        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)

        items = session.exec(stmt).all()
        filtered_items = [filtrar_respuesta(item) for item in items]

        start = (page - 1) * per_page
        end = min(start + per_page - 1, total - 1) if total > 0 else 0
        if end < start and total > 0:
            end = start
        response.headers["Content-Range"] = f"items {start}-{end}/{total}"

        return filtered_items
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
