import json
from typing import Any

from fastapi import Depends, Request
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.router import create_generic_router, flatten_nested_filters
from app.crud.crm_evento_crud import crm_evento_crud
from app.db import get_session
from app.models import CRMEvento

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
