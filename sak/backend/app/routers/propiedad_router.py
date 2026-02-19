import json
import logging
from typing import Any

from fastapi import Depends, Request
from sqlalchemy import func
from sqlmodel import Session

from app.models.propiedad import Propiedad, PropiedadesStatus
from app.crud.propiedad_crud import propiedad_crud
from app.core.router import create_generic_router, flatten_nested_filters
from app.db import get_session

logger = logging.getLogger(__name__)

propiedad_router = create_generic_router(
    model=Propiedad,
    crud=propiedad_crud,
    prefix="/propiedades",
    tags=["propiedades"],
)




def _build_filters(request: Request) -> dict[str, Any]:
    filters: dict[str, Any] = {}
    reserved_params = {"sort", "range", "page", "perPage"}

    for key in request.query_params:
        if key in reserved_params or key == "filter":
            continue
        if key not in {"q"} and not hasattr(Propiedad, key):
            continue
        values = request.query_params.getlist(key)
        if len(values) == 1:
            filters[key] = values[0]
        elif len(values) > 1:
            filters[key] = values

    if "filter" in request.query_params:
        try:
            filter_dict = json.loads(request.query_params["filter"])
            flat = flatten_nested_filters(filter_dict)
            filters.update(flat)
        except json.JSONDecodeError:
            pass

    return filters


@propiedad_router.get("/aggregates/estado")
def propiedades_estado_aggregate(
    request: Request,
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)
    base_filters = {k: v for k, v in filters.items() if k != "estado"}

    stmt = (
        select(PropiedadesStatus.nombre, func.count())
        .select_from(Propiedad)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
        .group_by(PropiedadesStatus.nombre)
    )
    stmt = propiedad_crud._apply_filters(stmt, base_filters)

    rows = session.exec(stmt).all()
    data = [
        {"estado": (estado or "Sin asignar"), "total": total}
        for estado, total in rows
    ]
    return {"data": data}

