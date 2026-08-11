from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.db import get_session
from app.models.nomina import Nomina
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.proyecto import Proyecto
from app.models.tarja import Tarja, TarjaDetalle


router = APIRouter(prefix="/tarja-detalle", tags=["tarja-detalle"])


class TarjaDetalleUpdate(BaseModel):
    horas: Decimal | None = Field(default=None, ge=0)
    idestado: int | None = Field(default=None, gt=0)
    descripcion: str | None = Field(default=None, max_length=500)


def _parse_range(range_param: str | None) -> tuple[int, int]:
    if not range_param:
        return 1, 25
    try:
        start, end = json.loads(range_param)
        per_page = max(1, int(end) - int(start) + 1)
        page = (int(start) // per_page) + 1
        return page, per_page
    except (TypeError, ValueError, json.JSONDecodeError):
        return 1, 25


def _parse_sort(sort_param: str | None) -> tuple[str, str]:
    if not sort_param:
        return "empleado", "asc"
    try:
        field, order = json.loads(sort_param)
        return str(field), str(order).lower()
    except (TypeError, ValueError, json.JSONDecodeError):
        return "empleado", "asc"


def _parse_filter(filter_param: str | None) -> dict[str, Any]:
    if not filter_param:
        return {}
    try:
        parsed = json.loads(filter_param)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _day_key(index: int) -> str:
    return f"D{index:02d}"


def _build_empty_days(start: date) -> dict[str, dict[str, Any]]:
    return {
        _day_key(index): {
            "detalle_id": None,
            "fecha": (start + timedelta(days=index - 1)).isoformat(),
            "horas": None,
            "idestado": None,
            "estado": None,
            "descripcion": None,
        }
        for index in range(1, 16)
    }


@router.get("")
def list_tarja_detalle(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    sort: str | None = Query(None),
    range: str | None = Query(None),
    filter: str | None = Query(None),
    q: str | None = Query(None),
):
    filters = _parse_filter(filter)
    query_params = dict(request.query_params)
    tarja_id = filters.get("tarja_id") or query_params.get("tarja_id")
    if not tarja_id:
        raise HTTPException(status_code=400, detail="tarja_id es requerido")

    tarja = session.get(Tarja, int(tarja_id))
    if tarja is None or tarja.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Tarja no encontrada")
    proyecto = session.get(Proyecto, tarja.idproyecto)
    obra = proyecto.nombre if proyecto is not None else None

    search = str(filters.get("q") or q or "").strip()
    only_novedades = str(filters.get("novedades") or "").lower() in {"1", "true", "si", "sí"}
    page, per_page = _parse_range(range)
    sort_by, sort_dir = _parse_sort(sort)

    base_stmt = (
        select(TarjaDetalle.idnomina)
        .join(Nomina, Nomina.id == TarjaDetalle.idnomina)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.deleted_at.is_(None))
        .where(TarjaDetalle.idnomina.is_not(None))
        .group_by(TarjaDetalle.idnomina, Nomina.apellido, Nomina.nombre, Nomina.dni)
    )
    if search:
        pattern = f"%{search}%"
        base_stmt = base_stmt.where(
            or_(
                Nomina.nombre.ilike(pattern),
                Nomina.apellido.ilike(pattern),
                Nomina.dni.ilike(pattern),
            )
        )
    if only_novedades:
        novedades_stmt = (
            select(TarjaDetalle.idnomina)
            .join(ParteDiarioEstado, ParteDiarioEstado.id == TarjaDetalle.idestado)
            .where(TarjaDetalle.tarja_id == tarja.id)
            .where(TarjaDetalle.deleted_at.is_(None))
            .where(TarjaDetalle.idnomina.is_not(None))
            .where(ParteDiarioEstado.abreviatura != "P")
            .distinct()
        )
        base_stmt = base_stmt.where(TarjaDetalle.idnomina.in_(novedades_stmt))

    total = session.exec(select(func.count()).select_from(base_stmt.subquery())).one()
    order_columns = {
        "empleado": (Nomina.apellido, Nomina.nombre),
        "idnomina": (TarjaDetalle.idnomina,),
    }.get(sort_by, (Nomina.apellido, Nomina.nombre))
    for column in order_columns:
        base_stmt = base_stmt.order_by(column.desc() if sort_dir == "desc" else column.asc())

    offset = (page - 1) * per_page
    nomina_ids = session.exec(base_stmt.offset(offset).limit(per_page)).all()
    if not nomina_ids:
        response.headers["Content-Range"] = "items 0-0/0"
        return []

    detalles = session.exec(
        select(TarjaDetalle, Nomina, ParteDiarioEstado)
        .join(Nomina, Nomina.id == TarjaDetalle.idnomina)
        .outerjoin(ParteDiarioEstado, ParteDiarioEstado.id == TarjaDetalle.idestado)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.idnomina.in_(nomina_ids))
        .where(TarjaDetalle.deleted_at.is_(None))
        .order_by(Nomina.apellido, Nomina.nombre, TarjaDetalle.fecha)
    ).all()

    rows: dict[int, dict[str, Any]] = {}
    for detalle, nomina, estado in detalles:
        nomina_id = int(nomina.id)
        row = rows.setdefault(
            nomina_id,
            {
                "id": f"{tarja.id}:{nomina_id}",
                "tarja_id": tarja.id,
                "obra": obra,
                "idnomina": nomina_id,
                "empleado": f"{nomina.apellido}, {nomina.nombre}",
                "dni": nomina.dni,
                **_build_empty_days(tarja.fechainicio),
            },
        )
        day_index = (detalle.fecha - tarja.fechainicio).days + 1
        if 1 <= day_index <= 15:
            row[_day_key(day_index)] = {
                "detalle_id": detalle.id,
                "fecha": detalle.fecha.isoformat(),
                "horas": float(detalle.horas),
                "idestado": detalle.idestado,
                "estado": estado.abreviatura if estado else None,
                "descripcion": detalle.descripcion,
            }

    ordered_rows = [rows[int(nomina_id)] for nomina_id in nomina_ids if int(nomina_id) in rows]
    start = offset
    end = min(start + len(ordered_rows) - 1, total - 1) if total else 0
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"
    return ordered_rows


@router.patch("/{detalle_id:int}")
@router.put("/{detalle_id:int}")
def update_tarja_detalle(
    detalle_id: int,
    payload: TarjaDetalleUpdate,
    session: Session = Depends(get_session),
):
    detalle = session.get(TarjaDetalle, detalle_id)
    if detalle is None or detalle.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Detalle de tarja no encontrado")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(detalle, field, value)

    session.add(detalle)
    session.commit()
    session.refresh(detalle)
    return {
        "id": detalle.id,
        "detalle_id": detalle.id,
        "tarja_id": detalle.tarja_id,
        "idnomina": detalle.idnomina,
        "fecha": detalle.fecha.isoformat(),
        "horas": float(detalle.horas),
        "idestado": detalle.idestado,
        "descripcion": detalle.descripcion,
    }
