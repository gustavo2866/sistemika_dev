from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_
from sqlmodel import Session, select

from app.db import get_session
from app.models.nomina import Nomina
from app.models.nomina_catalogos import NominaCategoria, NominaTarea
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.proyecto import Proyecto
from app.models.tarja import Tarja, TarjaDetalle, TarjaNomina


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


def _is_truthy_filter(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "si", "sí"}


def _day_key(index: int) -> str:
    return f"D{index:02d}"


def _tarja_day_slots(start: date, end: date) -> int:
    return 16 if start.day == 26 else 15


def _build_empty_days(start: date, end: date) -> dict[str, dict[str, Any]]:
    slot_count = _tarja_day_slots(start, end)
    return {
        _day_key(index): {
            "detalle_id": None,
            "fecha": (
                current_date.isoformat()
                if (current_date := start + timedelta(days=index - 1)) <= end
                else None
            ),
            "horas": None,
            "idestado": None,
            "estado": None,
            "estado_nombre": None,
            "descripcion": None,
        }
        for index in range(1, slot_count + 1)
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
    only_bonos = _is_truthy_filter(filters.get("bonos"))
    only_parte_novedades = _is_truthy_filter(filters.get("parte_novedades"))
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
    if only_bonos:
        nominas_con_bonos = (
            select(TarjaNomina.nomina_id)
            .where(TarjaNomina.tarja_id == tarja.id)
            .where(TarjaNomina.deleted_at.is_(None))
            .where(TarjaNomina.nomina_id.is_not(None))
            .where(
                or_(
                    TarjaNomina.adicional_importe != 0,
                    TarjaNomina.premio_importe != 0,
                )
            )
            .group_by(TarjaNomina.nomina_id)
        )
        base_stmt = base_stmt.where(TarjaDetalle.idnomina.in_(nominas_con_bonos))
    if only_parte_novedades:
        nominas_con_novedades = (
            select(TarjaDetalle.idnomina)
            .outerjoin(ParteDiarioEstado, ParteDiarioEstado.id == TarjaDetalle.idestado)
            .where(TarjaDetalle.tarja_id == tarja.id)
            .where(TarjaDetalle.deleted_at.is_(None))
            .where(TarjaDetalle.idnomina.is_not(None))
            .where(
                or_(
                    and_(
                        ParteDiarioEstado.abreviatura.is_not(None),
                        ParteDiarioEstado.abreviatura != "P",
                    ),
                    func.length(func.trim(func.coalesce(TarjaDetalle.descripcion, ""))) > 0,
                )
            )
            .group_by(TarjaDetalle.idnomina)
        )
        base_stmt = base_stmt.where(TarjaDetalle.idnomina.in_(nominas_con_novedades))

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
    novedades = session.exec(
        select(TarjaNomina, NominaCategoria, NominaTarea)
        .outerjoin(NominaCategoria, NominaCategoria.id == TarjaNomina.nomina_categoria_id)
        .outerjoin(NominaTarea, NominaTarea.id == TarjaNomina.nomina_tarea_id)
        .where(TarjaNomina.tarja_id == tarja.id)
        .where(TarjaNomina.deleted_at.is_(None))
        .where(TarjaNomina.nomina_id.in_(nomina_ids))
        .order_by(TarjaNomina.id)
    ).all()
    novedades_by_nomina = {
        int(novedad.nomina_id): {
            "novedad": novedad,
            "categoria_codigo": str(categoria.codigo or "").strip() if categoria is not None else None,
            "actividad_codigo": str(tarea.codigo or "").strip() if tarea is not None else None,
        }
        for novedad, categoria, tarea in novedades
        if novedad.nomina_id is not None
    }

    rows: dict[int, dict[str, Any]] = {}
    for detalle, nomina, estado in detalles:
        nomina_id = int(nomina.id)
        row = rows.setdefault(
            nomina_id,
            {
                "id": f"{tarja.id}:{nomina_id}",
                "tarja_id": tarja.id,
                "proyecto_id": tarja.idproyecto,
                "encargado_id": tarja.contacto_id,
                "obra": obra,
                "idnomina": nomina_id,
                "empleado": f"{nomina.apellido}, {nomina.nombre}",
                "dni": nomina.dni,
                "categoria_codigo": None,
                "actividad_codigo": None,
                "novedad": None,
                **_build_empty_days(tarja.fechainicio, tarja.fechafinal),
            },
        )
        novedad_data = novedades_by_nomina.get(nomina_id)
        novedad = novedad_data["novedad"] if novedad_data is not None else None
        if novedad is not None:
            row["novedad"] = {
                "id": novedad.id,
                "nomina_id": novedad.nomina_id,
                "horas_justificadas": float(novedad.horas_justificadas),
                "presentismo": novedad.presentismo,
                "presentismo_importe": float(novedad.presentismo_importe),
                "adicional_importe": float(novedad.adicional_importe),
                "premio": novedad.premio,
                "premio_importe": float(novedad.premio_importe),
                "viatico": novedad.viatico,
                "viatico_importe": float(novedad.viatico_importe),
                "sueldo_importe": float(novedad.sueldo_importe),
                "mejora_importe": float(novedad.mejora_importe),
                "cargas_importe": float(novedad.cargas_importe),
                "observaciones": novedad.observaciones,
            }
            row["categoria_codigo"] = novedad_data["categoria_codigo"]
            row["actividad_codigo"] = novedad_data["actividad_codigo"]
        day_index = (detalle.fecha - tarja.fechainicio).days + 1
        if 1 <= day_index <= _tarja_day_slots(tarja.fechainicio, tarja.fechafinal):
            row[_day_key(day_index)] = {
                "detalle_id": detalle.id,
                "fecha": detalle.fecha.isoformat(),
                "horas": float(detalle.horas),
                "idestado": detalle.idestado,
                "estado": estado.abreviatura if estado else None,
                "estado_nombre": estado.nombre if estado else None,
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
    estado = session.get(ParteDiarioEstado, detalle.idestado) if detalle.idestado else None
    return {
        "id": detalle.id,
        "detalle_id": detalle.id,
        "tarja_id": detalle.tarja_id,
        "idnomina": detalle.idnomina,
        "fecha": detalle.fecha.isoformat(),
        "horas": float(detalle.horas),
        "idestado": detalle.idestado,
        "estado": estado.abreviatura if estado else None,
        "estado_nombre": estado.nombre if estado else None,
        "descripcion": detalle.descripcion,
    }
