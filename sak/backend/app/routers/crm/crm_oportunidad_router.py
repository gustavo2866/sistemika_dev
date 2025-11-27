import json
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlmodel import Session, select
from sqlalchemy import func

from app.core.router import create_generic_router, flatten_nested_filters
from app.db import get_session
from app.models import CRMOportunidad, CRMOportunidadLogEstado
from app.crud.crm_oportunidad_crud import crm_oportunidad_crud
from app.services.crm_oportunidad_service import crm_oportunidad_service
from app.models.base import filtrar_respuesta


crm_oportunidad_router = create_generic_router(
    model=CRMOportunidad,
    crud=crm_oportunidad_crud,
    prefix="/crm/oportunidades",
    tags=["crm-oportunidades"],
)


@crm_oportunidad_router.post("/{oportunidad_id}/cambiar-estado")
def cambiar_estado(
    oportunidad_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    try:
        nuevo_estado = payload.get("nuevo_estado")
        descripcion = payload.get("descripcion", "")
        if not nuevo_estado or not descripcion:
            raise ValueError("nuevo_estado y descripcion son obligatorios")
        usuario_id = payload.get("usuario_id") or 1
        oportunidad = crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad_id,
            nuevo_estado=nuevo_estado,
            descripcion=descripcion,
            usuario_id=usuario_id,
            fecha_estado=payload.get("fecha_estado"),
            motivo_perdida_id=payload.get("motivo_perdida_id"),
            monto=payload.get("monto"),
            moneda_id=payload.get("moneda_id"),
            condicion_pago_id=payload.get("condicion_pago_id"),
        )
        return filtrar_respuesta(oportunidad)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@crm_oportunidad_router.get("/{oportunidad_id}/logs")
def listar_logs(
    oportunidad_id: int,
    session: Session = Depends(get_session),
):
    logs = session.exec(
        select(CRMOportunidadLogEstado).where(
            CRMOportunidadLogEstado.oportunidad_id == oportunidad_id
        )
    ).all()
    return [log.model_dump() for log in logs]


def _coerce_value(column, value: str):
    try:
        python_type = column.type.python_type  # type: ignore
    except Exception:
        python_type = None
    if python_type is int:
        try:
            return int(value)
        except ValueError:
            return value
    return value


def _build_filters(request: Request) -> dict[str, Any]:
    filters: dict[str, Any] = {}

    reserved_params = {"sort", "range", "page", "perPage"}

    for key in request.query_params:
        if key in reserved_params:
            continue
        if key == "filter":
            continue
        if key not in {"q"} and not hasattr(CRMOportunidad, key):
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


@crm_oportunidad_router.get("/aggregates/estado")
def oportunidades_estado_aggregate(
    request: Request,
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)

    base_filters = {k: v for k, v in filters.items() if k != "estado"}

    base_stmt = (
        select(CRMOportunidad.estado, func.count())
        .group_by(CRMOportunidad.estado)
    )
    base_stmt = crm_oportunidad_crud._apply_filters(base_stmt, base_filters)

    selected_stmt = (
        select(CRMOportunidad.estado, func.count())
        .group_by(CRMOportunidad.estado)
    )
    selected_stmt = crm_oportunidad_crud._apply_filters(selected_stmt, filters)

    base_rows = session.exec(base_stmt).all()
    selected_rows = session.exec(selected_stmt).all()

    base_counts = {estado: count for estado, count in base_rows}
    selected_counts = {estado: count for estado, count in selected_rows}

    estados = base_counts.keys() | selected_counts.keys()
    data = [
        {
            "estado": estado,
            "total": base_counts.get(estado, 0),
            "filtered": selected_counts.get(estado, 0),
        }
        for estado in estados
    ]
    return {"data": data}
