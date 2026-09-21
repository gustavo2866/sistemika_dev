from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import aliased
from sqlmodel import Session, select

from app.db import get_session
from app.models.crm.contacto import CRMContacto
from app.models.nomina import Nomina
from app.models.nomina_catalogos import NominaCategoria, NominaTarea
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import ParteDiario, ParteDiarioDetalle
from app.models.proyecto import Proyecto
from app.models.tarja import Tarja, TarjaDetalle, TarjaNomina
from app.services.parte_diario_service import (
    extract_destination_part_id,
    strip_destination_part_reference,
)
from app.utils.jornada import get_jornada_esperada


router = APIRouter(prefix="/tarja-detalle", tags=["tarja-detalle"])
INTERNAL_NOMINA_STATE_CODES = {"ALT", "BAJ", "TRA"}


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


def _temporary_work_code(description: str | None) -> str | None:
    clean = strip_destination_part_reference(description)
    normalized = str(clean or "").strip().lower()
    if normalized.startswith("trabajo temporal desde obra"):
        return "OTR"
    try:
        payload = json.loads(clean or "{}")
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    return "OTR" if isinstance(payload, dict) and payload.get("tipo") == "trabajo_destino" else None


def _overtime_values(
    *,
    fecha: date,
    horas: Decimal | float,
    estado_codigo: str | None,
    descripcion: str | None,
) -> tuple[float, float, bool]:
    jornada = float(get_jornada_esperada(fecha))
    extras = max(float(horas) - jornada, 0.0)
    codigo = str(estado_codigo or "").strip().upper()
    is_overtime = extras > 0 and codigo in {"", "P"} and _temporary_work_code(descripcion) is None
    return jornada, extras, is_overtime


def _serialize_parte_reference(session: Session, parte: ParteDiario | None) -> dict[str, Any] | None:
    if parte is None:
        return None
    proyecto = session.get(Proyecto, parte.idproyecto)
    contacto = session.get(CRMContacto, parte.contacto_id) if parte.contacto_id else None
    return {
        "id": parte.id,
        "fecha": parte.fecha.isoformat(),
        "estado": parte.estado.value if hasattr(parte.estado, "value") else str(parte.estado),
        "proyecto_id": parte.idproyecto,
        "obra": proyecto.nombre if proyecto is not None else None,
        "contacto_id": parte.contacto_id,
        "encargado": contacto.nombre_completo if contacto is not None else None,
    }


def _serialize_parte_detalle(
    session: Session,
    detalle: ParteDiarioDetalle,
) -> dict[str, Any]:
    estado = session.get(ParteDiarioEstado, detalle.idestado) if detalle.idestado else None
    parte = session.get(ParteDiario, detalle.parte_diario_id)
    descripcion = strip_destination_part_reference(detalle.descripcion)
    estado_codigo = estado.abreviatura if estado is not None else None
    jornada, horas_extra, is_overtime = _overtime_values(
        fecha=parte.fecha if parte is not None else date.today(),
        horas=detalle.horas,
        estado_codigo=estado_codigo,
        descripcion=detalle.descripcion,
    )
    return {
        "id": detalle.id,
        "codigo": "EXT" if is_overtime else _temporary_work_code(detalle.descripcion) or estado_codigo,
        "estado": "HORAS EXTRAS" if is_overtime else estado.nombre if estado is not None else None,
        "horas": float(detalle.horas),
        "jornada_esperada": jornada,
        "horas_extra": horas_extra,
        "ingreso": detalle.ingreso.isoformat() if detalle.ingreso is not None else None,
        "egreso": detalle.egreso.isoformat() if detalle.egreso is not None else None,
        "descripcion": descripcion,
        "origen": detalle.origen.value if hasattr(detalle.origen, "value") else str(detalle.origen),
        "parte": _serialize_parte_reference(session, parte),
    }


def _find_complementary_detail(
    session: Session,
    detalle: ParteDiarioDetalle,
) -> ParteDiarioDetalle | None:
    if detalle.idnomina is None:
        return None
    destination_part_id = extract_destination_part_id(detalle.descripcion)
    if destination_part_id is not None:
        return session.exec(
            select(ParteDiarioDetalle)
            .where(ParteDiarioDetalle.parte_diario_id == destination_part_id)
            .where(ParteDiarioDetalle.idnomina == int(detalle.idnomina))
            .where(ParteDiarioDetalle.deleted_at.is_(None))
        ).first()

    marker = f"[parte_diario_destino_id={int(detalle.parte_diario_id)}]"
    return session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.idnomina == int(detalle.idnomina))
        .where(ParteDiarioDetalle.descripcion.contains(marker))
        .where(ParteDiarioDetalle.deleted_at.is_(None))
    ).first()


def _serialize_nomina_detail(
    session: Session,
    nomina: Nomina,
    tarja: Tarja,
) -> dict[str, Any]:
    proyecto = session.get(Proyecto, nomina.idproyecto) if nomina.idproyecto else None
    encargado = (
        session.get(CRMContacto, nomina.encargado_contacto_id)
        if nomina.encargado_contacto_id
        else None
    )
    registro = session.exec(
        select(TarjaNomina)
        .where(TarjaNomina.tarja_id == int(tarja.id))
        .where(TarjaNomina.nomina_id == int(nomina.id))
        .where(TarjaNomina.deleted_at.is_(None))
    ).first()
    categoria_id = registro.nomina_categoria_id if registro is not None else nomina.nomina_categoria_id
    tarea_id = registro.nomina_tarea_id if registro is not None else nomina.nomina_tarea_id
    categoria = session.get(NominaCategoria, categoria_id) if categoria_id else None
    tarea = session.get(NominaTarea, tarea_id) if tarea_id else None
    return {
        "id": nomina.id,
        "nombre": nomina.nombre,
        "apellido": nomina.apellido,
        "dni": nomina.dni,
        "nro_legajo": nomina.nro_legajo,
        "email": nomina.email,
        "telefono": nomina.telefono,
        "direccion": nomina.direccion,
        "fecha_nacimiento": nomina.fecha_nacimiento.isoformat() if nomina.fecha_nacimiento else None,
        "fecha_ingreso": nomina.fecha_ingreso.isoformat() if nomina.fecha_ingreso else None,
        "fecha_egreso": nomina.fecha_egreso.isoformat() if nomina.fecha_egreso else None,
        "activo": nomina.activo,
        "proyecto_id": nomina.idproyecto,
        "obra": proyecto.nombre if proyecto is not None else None,
        "encargado_contacto_id": nomina.encargado_contacto_id,
        "encargado": encargado.nombre_completo if encargado is not None else None,
        "categoria": str(categoria.codigo or "").strip() if categoria is not None else None,
        "categoria_descripcion": categoria.descripcion if categoria is not None else None,
        "actividad": str(tarea.codigo or "").strip() if tarea is not None else None,
        "actividad_descripcion": tarea.descripcion if tarea is not None else None,
        "vigencia_tarja_desde": registro.fecha_desde.isoformat() if registro is not None else None,
        "vigencia_tarja_hasta": registro.fecha_hasta.isoformat() if registro is not None else None,
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
        select(TarjaNomina.nomina_id)
        .join(Nomina, Nomina.id == TarjaNomina.nomina_id)
        .where(TarjaNomina.tarja_id == tarja.id)
        .where(TarjaNomina.deleted_at.is_(None))
        .where(TarjaNomina.nomina_id.is_not(None))
        .group_by(TarjaNomina.nomina_id, Nomina.apellido, Nomina.nombre, Nomina.dni)
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
        base_stmt = base_stmt.where(TarjaNomina.nomina_id.in_(nominas_con_bonos))
    if only_parte_novedades:
        origin_detail = aliased(ParteDiarioDetalle)
        origin_state = aliased(ParteDiarioEstado)
        overtime_nomina_ids = {
            int(nomina_id)
            for nomina_id, detalle_fecha, horas in session.exec(
                select(TarjaDetalle.idnomina, TarjaDetalle.fecha, TarjaDetalle.horas)
                .where(TarjaDetalle.tarja_id == tarja.id)
                .where(TarjaDetalle.deleted_at.is_(None))
                .where(TarjaDetalle.idnomina.is_not(None))
            ).all()
            if nomina_id is not None
            and float(horas) > float(get_jornada_esperada(detalle_fecha))
        }
        novelty_conditions = [
            and_(
                ParteDiarioEstado.abreviatura.is_not(None),
                ParteDiarioEstado.abreviatura != "P",
            ),
            origin_state.abreviatura.in_(INTERNAL_NOMINA_STATE_CODES),
            func.length(func.trim(func.coalesce(TarjaDetalle.descripcion, ""))) > 0,
        ]
        if overtime_nomina_ids:
            novelty_conditions.append(TarjaDetalle.idnomina.in_(overtime_nomina_ids))
        nominas_con_novedades = (
            select(TarjaDetalle.idnomina)
            .outerjoin(ParteDiarioEstado, ParteDiarioEstado.id == TarjaDetalle.idestado)
            .outerjoin(
                origin_detail,
                and_(
                    origin_detail.id == TarjaDetalle.parte_diario_detalle_id,
                    origin_detail.deleted_at.is_(None),
                ),
            )
            .outerjoin(
                origin_state,
                and_(
                    origin_state.id == origin_detail.idestado,
                    origin_state.deleted_at.is_(None),
                ),
            )
            .where(TarjaDetalle.tarja_id == tarja.id)
            .where(TarjaDetalle.deleted_at.is_(None))
            .where(TarjaDetalle.idnomina.is_not(None))
            .where(or_(*novelty_conditions))
            .group_by(TarjaDetalle.idnomina)
        )
        base_stmt = base_stmt.where(TarjaNomina.nomina_id.in_(nominas_con_novedades))

    total = session.exec(select(func.count()).select_from(base_stmt.subquery())).one()
    order_columns = {
        "empleado": (Nomina.apellido, Nomina.nombre),
        "idnomina": (TarjaNomina.nomina_id,),
    }.get(sort_by, (Nomina.apellido, Nomina.nombre))
    for column in order_columns:
        base_stmt = base_stmt.order_by(column.desc() if sort_dir == "desc" else column.asc())

    offset = (page - 1) * per_page
    nomina_ids = session.exec(base_stmt.offset(offset).limit(per_page)).all()
    if not nomina_ids:
        response.headers["Content-Range"] = "items 0-0/0"
        return []

    origin_detail = aliased(ParteDiarioDetalle)
    origin_state = aliased(ParteDiarioEstado)
    detalles = session.exec(
        select(TarjaDetalle, Nomina, ParteDiarioEstado, origin_state)
        .join(Nomina, Nomina.id == TarjaDetalle.idnomina)
        .outerjoin(ParteDiarioEstado, ParteDiarioEstado.id == TarjaDetalle.idestado)
        .outerjoin(
            origin_detail,
            and_(
                origin_detail.id == TarjaDetalle.parte_diario_detalle_id,
                origin_detail.deleted_at.is_(None),
            ),
        )
        .outerjoin(
            origin_state,
            and_(
                origin_state.id == origin_detail.idestado,
                origin_state.deleted_at.is_(None),
            ),
        )
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

    nominas = session.exec(
        select(Nomina)
        .where(Nomina.id.in_(nomina_ids))
        .order_by(Nomina.apellido, Nomina.nombre)
    ).all()
    nominas_by_id = {int(nomina.id): nomina for nomina in nominas}

    rows: dict[int, dict[str, Any]] = {}
    for nomina_id in nomina_ids:
        nomina = nominas_by_id.get(int(nomina_id))
        if nomina is None:
            continue
        novedad_data = novedades_by_nomina.get(int(nomina_id))
        novedad = novedad_data["novedad"] if novedad_data is not None else None
        rows[int(nomina_id)] = {
            "id": f"{tarja.id}:{int(nomina_id)}",
            "tarja_id": tarja.id,
            "proyecto_id": tarja.idproyecto,
            "encargado_id": tarja.contacto_id,
            "obra": obra,
            "idnomina": int(nomina_id),
            "empleado": f"{nomina.apellido}, {nomina.nombre}",
            "dni": nomina.dni,
            "nro_legajo": nomina.nro_legajo,
            "categoria_codigo": novedad_data["categoria_codigo"] if novedad_data is not None else None,
            "actividad_codigo": novedad_data["actividad_codigo"] if novedad_data is not None else None,
            "novedad": (
                {
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
                if novedad is not None
                else None
            ),
            **_build_empty_days(tarja.fechainicio, tarja.fechafinal),
        }

    for detalle, nomina, estado, estado_origen in detalles:
        nomina_id = int(nomina.id)
        row = rows.get(nomina_id)
        if row is None:
            continue
        day_index = (detalle.fecha - tarja.fechainicio).days + 1
        if 1 <= day_index <= _tarja_day_slots(tarja.fechainicio, tarja.fechafinal):
            estado_visible = (
                estado_origen
                if estado_origen is not None
                and str(estado_origen.abreviatura or "").strip().upper()
                in INTERNAL_NOMINA_STATE_CODES
                else estado
            )
            row[_day_key(day_index)] = {
                "detalle_id": detalle.id,
                "fecha": detalle.fecha.isoformat(),
                "horas": float(detalle.horas),
                "idestado": estado_visible.id if estado_visible else detalle.idestado,
                "estado": estado_visible.abreviatura if estado_visible else None,
                "estado_nombre": estado_visible.nombre if estado_visible else None,
                "descripcion": detalle.descripcion,
            }

    ordered_rows = [rows[int(nomina_id)] for nomina_id in nomina_ids if int(nomina_id) in rows]
    start = offset
    end = min(start + len(ordered_rows) - 1, total - 1) if total else 0
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"
    return ordered_rows


@router.get("/{detalle_id:int}")
def get_tarja_detalle_novedad(
    detalle_id: int,
    session: Session = Depends(get_session),
):
    detalle_tarja = session.get(TarjaDetalle, detalle_id)
    if detalle_tarja is None or detalle_tarja.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Detalle de tarja no encontrado")
    if detalle_tarja.idnomina is None:
        raise HTTPException(status_code=404, detail="El detalle no tiene empleado asociado")

    tarja = session.get(Tarja, detalle_tarja.tarja_id)
    nomina = session.get(Nomina, detalle_tarja.idnomina)
    if tarja is None or tarja.deleted_at is not None or nomina is None:
        raise HTTPException(status_code=404, detail="No se encontro la informacion de la novedad")

    detalle_origen = (
        session.get(ParteDiarioDetalle, detalle_tarja.parte_diario_detalle_id)
        if detalle_tarja.parte_diario_detalle_id is not None
        else None
    )
    if detalle_origen is not None and detalle_origen.deleted_at is not None:
        detalle_origen = None

    if detalle_origen is not None:
        novedad = _serialize_parte_detalle(session, detalle_origen)
        complementaria = _find_complementary_detail(session, detalle_origen)
    else:
        estado = (
            session.get(ParteDiarioEstado, detalle_tarja.idestado)
            if detalle_tarja.idestado
            else None
        )
        estado_codigo = estado.abreviatura if estado is not None else None
        jornada, horas_extra, is_overtime = _overtime_values(
            fecha=detalle_tarja.fecha,
            horas=detalle_tarja.horas,
            estado_codigo=estado_codigo,
            descripcion=detalle_tarja.descripcion,
        )
        novedad = {
            "id": None,
            "codigo": "EXT"
            if is_overtime
            else _temporary_work_code(detalle_tarja.descripcion) or estado_codigo,
            "estado": "HORAS EXTRAS"
            if is_overtime
            else estado.nombre if estado is not None else None,
            "horas": float(detalle_tarja.horas),
            "jornada_esperada": jornada,
            "horas_extra": horas_extra,
            "ingreso": None,
            "egreso": None,
            "descripcion": strip_destination_part_reference(detalle_tarja.descripcion),
            "origen": None,
            "parte": None,
        }
        complementaria = None

    return {
        "id": detalle_tarja.id,
        "tarja_id": detalle_tarja.tarja_id,
        "fecha": detalle_tarja.fecha.isoformat(),
        "novedad": novedad,
        "complementaria": (
            _serialize_parte_detalle(session, complementaria)
            if complementaria is not None
            else None
        ),
        "nomina": _serialize_nomina_detail(session, nomina, tarja),
    }


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
