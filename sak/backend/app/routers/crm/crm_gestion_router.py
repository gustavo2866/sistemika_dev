from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, nullslast
from sqlmodel import Session, select

from app.core.router import flatten_nested_filters
from app.crud.crm_evento_crud import crm_evento_crud
from app.db import get_session
from app.models import CRMContacto, CRMEvento, CRMOportunidad, CRMTipoEvento
from app.services.crm_gestion_service import (
    apply_move,
    serialize_evento,
    summarize_buckets,
    summarize_kpis,
)


router = APIRouter(prefix="/crm/gestion", tags=["crm-gestion"])


def _build_filters(request: Request) -> dict:
    filters: dict[str, object] = {}
    reserved = {"sort", "range", "page", "perPage", "owner_id"}

    for key in request.query_params.keys():
        if key in reserved:
            continue
        if key == "q":
            value = request.query_params.get(key)
            if value:
                filters["q"] = value
            continue
        if key == "filter":
            raw = request.query_params.get(key)
            if not raw:
                continue
            try:
                parsed = json.loads(raw)
            except Exception:
                continue
            filters.update(flatten_nested_filters(parsed))
            continue
        values = request.query_params.getlist(key)
        if len(values) == 1:
            filters[key] = values[0]
        elif len(values) > 1:
            filters[key] = values
    return filters


@router.get("/summary")
def gestion_summary(
    owner_id: Optional[int] = Query(None, description="Usuario asignado"),
    session: Session = Depends(get_session),
):
    return {
        "kpis": summarize_kpis(session, owner_id=owner_id),
        "buckets": summarize_buckets(session, owner_id=owner_id),
    }


@router.get("/items")
def gestion_items(
    request: Request,
    owner_id: Optional[int] = Query(None, description="Usuario asignado"),
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)
    tipo_evento = filters.pop("tipo_evento", None)
    if owner_id:
        filters["asignado_a_id"] = owner_id

    stmt = select(CRMEvento)
    if tipo_evento:
        stmt = stmt.join(CRMTipoEvento, CRMEvento.tipo_id == CRMTipoEvento.id)
        if isinstance(tipo_evento, list):
            lowered = [str(value).lower() for value in tipo_evento]
            stmt = stmt.where(func.lower(CRMTipoEvento.codigo).in_(lowered))
        else:
            stmt = stmt.where(func.lower(CRMTipoEvento.codigo) == str(tipo_evento).lower())
    stmt = crm_evento_crud._apply_filters(stmt, filters)
    stmt = crm_evento_crud._apply_auto_includes(stmt)
    stmt = stmt.order_by(nullslast(CRMEvento.fecha_evento))

    eventos = session.exec(stmt).all()
    return {"data": [serialize_evento(evento) for evento in eventos]}


@router.get("/types")
def gestion_types():
    return {
        "data": [
            {"id": "llamada", "label": "Llamada"},
            {"id": "visita", "label": "Visita"},
            {"id": "evento", "label": "Evento"},
            {"id": "tarea", "label": "Tarea"},
        ]
    }


@router.get("/contactos-activos")
def gestion_contactos_activos(
    response: Response,
    session: Session = Depends(get_session),
):
    stmt = (
        select(CRMOportunidad, CRMContacto)
        .join(CRMContacto, CRMOportunidad.contacto_id == CRMContacto.id)
        .where(
            CRMOportunidad.activo.is_(True),
            CRMOportunidad.deleted_at.is_(None),
            CRMContacto.deleted_at.is_(None),
        )
        .order_by(nullslast(CRMOportunidad.fecha_estado.desc()))
    )
    rows = session.exec(stmt).all()

    contactos: dict[int, dict] = {}
    for oportunidad, contacto in rows:
        if contacto.id in contactos:
            continue
        contactos[contacto.id] = {
            "id": contacto.id,
            "nombre_completo": contacto.nombre_completo,
            "oportunidad_id": oportunidad.id,
            "oportunidad_titulo": oportunidad.titulo,
        }

    data = list(contactos.values())
    total = len(data)
    end = total - 1 if total > 0 else 0
    response.headers["Content-Range"] = f"items 0-{end}/{total}"
    return data


@router.patch("/move")
def gestion_move(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    evento_id = payload.get("evento_id")
    to_bucket = payload.get("to_bucket")
    if not evento_id or not to_bucket:
        raise HTTPException(status_code=400, detail="evento_id y to_bucket son obligatorios")

    evento = session.get(CRMEvento, evento_id)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    updated = apply_move(session, evento, to_bucket)
    return {"data": serialize_evento(updated)}
