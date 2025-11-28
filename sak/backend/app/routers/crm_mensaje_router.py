import json
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.router import create_generic_router, flatten_nested_filters
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.db import get_session
from app.models import CRMMensaje
from app.services.crm_mensaje_service import crm_mensaje_service


router = create_generic_router(
    model=CRMMensaje,
    crud=crm_mensaje_crud,
    prefix="/crm/mensajes",
    tags=["crm-mensajes"],
)


def _build_filters(request: Request) -> dict[str, Any]:
    filters: dict[str, Any] = {}
    reserved = {"sort", "range", "page", "perPage"}

    for key in request.query_params:
        if key in reserved or key == "filter":
            continue
        if key not in {"q"} and not hasattr(CRMMensaje, key):
            continue
        values = request.query_params.getlist(key)
        if len(values) == 1:
            filters[key] = values[0]
        elif len(values) > 1:
            filters[key] = values

    if "filter" in request.query_params:
        try:
            raw = request.query_params["filter"]
            filter_dict = json.loads(raw)
            flat = flatten_nested_filters(filter_dict)
            filters.update(flat)
        except json.JSONDecodeError:
            pass
    return filters


@router.get("/aggregates/tipo")
def mensajes_tipo_aggregate(
    request: Request,
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)
    base_filters = {k: v for k, v in filters.items() if k != "tipo"}

    stmt = select(CRMMensaje.tipo, func.count()).group_by(CRMMensaje.tipo)
    stmt = crm_mensaje_crud._apply_filters(stmt, base_filters)
    rows = session.exec(stmt).all()
    data = [{"tipo": tipo, "total": total} for tipo, total in rows]
    return {"data": data}


@router.get("/aggregates/estado")
def mensajes_estado_aggregate(
    request: Request,
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)
    base_filters = {k: v for k, v in filters.items() if k != "estado"}

    stmt = select(CRMMensaje.estado, func.count()).group_by(CRMMensaje.estado)
    stmt = crm_mensaje_crud._apply_filters(stmt, base_filters)
    rows = session.exec(stmt).all()
    data = [{"estado": estado, "total": total} for estado, total in rows]
    return {"data": data}


@router.post("/entrada")
def crear_mensaje_entrada(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """Alias de create que fuerza tipo=entrada y estado=nuevo."""
    data = {"tipo": "entrada", "estado": "nuevo", **payload}
    try:
        mensaje = crm_mensaje_crud.create(session, data)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/confirmar")
def confirmar_mensaje(
    mensaje_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    try:
        mensaje = crm_mensaje_service.confirmar(session, mensaje_id, payload)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/reintentar")
def reintentar_mensaje(
    mensaje_id: int,
    session: Session = Depends(get_session),
):
    try:
        mensaje = crm_mensaje_service.reintentar_salida(session, mensaje_id)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/llm-sugerir")
def sugerir_mensaje_llm(
    mensaje_id: int,
    payload: dict = Body({}, description="Opcional: {'force': true} para refrescar"),
    session: Session = Depends(get_session),
):
    force = bool(payload.get("force")) if isinstance(payload, dict) else False
    try:
        suggestions = crm_mensaje_service.sugerir_llm(session, mensaje_id, force=force)
        return {"llm_suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
