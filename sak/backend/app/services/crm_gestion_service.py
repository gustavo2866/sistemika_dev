from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable, Optional

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import CRMEvento, CRMTipoEvento
from app.models.enums import EstadoEvento


BucketKey = str


def _start_of_day(base: datetime) -> datetime:
    return base.replace(hour=0, minute=0, second=0, microsecond=0)


def _end_of_day(base: datetime) -> datetime:
    return base.replace(hour=23, minute=59, second=59, microsecond=999999)


def _start_of_week(base: datetime) -> datetime:
    day = base.weekday()  # Monday=0
    start = base - timedelta(days=day)
    return _start_of_day(start)


def _next_week_start(base: datetime) -> datetime:
    return _start_of_week(base) + timedelta(days=7)


def _week_after_start(base: datetime) -> datetime:
    return _start_of_week(base) + timedelta(days=14)


def bucket_for_event(fecha_evento: Optional[datetime]) -> BucketKey:
    now = datetime.now()
    start_today = _start_of_day(now)
    end_today = _end_of_day(now)
    start_tomorrow = start_today + timedelta(days=1)
    end_tomorrow = _end_of_day(start_tomorrow)
    start_week_window = start_today + timedelta(days=2)
    end_week_window = _end_of_day(start_today + timedelta(days=7))

    if fecha_evento is None:
        return "next"
    if fecha_evento < start_today:
        return "overdue"
    if fecha_evento <= end_today:
        return "today"
    if start_tomorrow <= fecha_evento <= end_tomorrow:
        return "tomorrow"
    if start_week_window <= fecha_evento <= end_week_window:
        return "week"
    return "next"


def move_date_for_bucket(
    bucket: BucketKey,
    original: Optional[datetime],
) -> Optional[datetime]:
    now = datetime.now()
    base = original or now
    start_today = _start_of_day(now)
    start_tomorrow = start_today + timedelta(days=1)
    start_week_window = start_today + timedelta(days=2)
    end_week_window = _end_of_day(start_today + timedelta(days=7))

    if bucket == "no_date":
        return None

    if bucket == "today":
        target = start_today
    elif bucket == "overdue":
        target = start_today - timedelta(days=1)
    elif bucket == "tomorrow":
        target = start_tomorrow
    elif bucket == "week":
        target = base
        if target < start_week_window:
            target = start_week_window
        if target > end_week_window:
            target = end_week_window
    elif bucket == "next":
        target = start_today + timedelta(days=8)
    else:
        return original

    return target.replace(
        hour=base.hour,
        minute=base.minute,
        second=base.second,
        microsecond=base.microsecond,
    )


def summarize_buckets(
    session: Session,
    owner_id: Optional[int] = None,
) -> dict[str, int]:
    stmt = select(CRMEvento.id, CRMEvento.fecha_evento)
    if owner_id:
        stmt = stmt.where(CRMEvento.asignado_a_id == owner_id)
    rows = session.exec(stmt).all()

    counts = {
        "overdue": 0,
        "today": 0,
        "tomorrow": 0,
        "week": 0,
        "next": 0,
    }
    for _, fecha_evento in rows:
        bucket = bucket_for_event(fecha_evento)
        counts[bucket] += 1

    return counts


def summarize_kpis(
    session: Session,
    owner_id: Optional[int] = None,
) -> dict[str, int]:
    now = datetime.now()
    start_today = _start_of_day(now)
    end_today = _end_of_day(now)
    start_tomorrow = start_today + timedelta(days=1)
    end_week_window = _end_of_day(start_today + timedelta(days=7))

    base_filters = []
    if owner_id:
        base_filters.append(CRMEvento.asignado_a_id == owner_id)

    tipo_codigos = ["visita", "llamada", "tarea"]
    tipos_stmt = select(CRMTipoEvento.id, CRMTipoEvento.codigo).where(
        func.lower(CRMTipoEvento.codigo).in_(tipo_codigos)
    )
    tipos = session.exec(tipos_stmt).all()
    tipo_ids = {codigo.lower(): tipo_id for tipo_id, codigo in tipos if codigo}

    visita_id = tipo_ids.get("visita")
    llamada_id = tipo_ids.get("llamada")
    tarea_id = tipo_ids.get("tarea")

    visitas_hoy_stmt = select(func.count()).select_from(CRMEvento).where(
        CRMEvento.fecha_evento >= start_today,
        CRMEvento.fecha_evento <= end_today,
        *base_filters,
    )
    llamadas_pendientes_stmt = select(func.count()).select_from(CRMEvento).where(
        CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value,
        *base_filters,
    )
    eventos_semana_stmt = select(func.count()).select_from(CRMEvento).where(
        CRMEvento.fecha_evento >= start_tomorrow,
        CRMEvento.fecha_evento <= end_week_window,
        *base_filters,
    )
    tareas_completadas_stmt = select(func.count()).select_from(CRMEvento).where(
        CRMEvento.estado_evento == EstadoEvento.REALIZADO.value,
        *base_filters,
    )

    visitas_hoy = 0
    if visita_id:
        visitas_hoy = session.exec(
            visitas_hoy_stmt.where(CRMEvento.tipo_id == visita_id)
        ).one()

    llamadas_pendientes = 0
    if llamada_id:
        llamadas_pendientes = session.exec(
            llamadas_pendientes_stmt.where(CRMEvento.tipo_id == llamada_id)
        ).one()

    tareas_completadas = 0
    if tarea_id:
        tareas_completadas = session.exec(
            tareas_completadas_stmt.where(CRMEvento.tipo_id == tarea_id)
        ).one()

    eventos_semana = session.exec(eventos_semana_stmt).one()

    return {
        "visitas_hoy": visitas_hoy,
        "llamadas_pendientes": llamadas_pendientes,
        "eventos_semana": eventos_semana,
        "tareas_completadas": tareas_completadas,
    }


def serialize_evento(evento: CRMEvento) -> dict:
    data = evento.model_dump()
    tipo_catalogo = getattr(evento, "tipo_catalogo", None)
    data["tipo_evento"] = (
        tipo_catalogo.codigo if tipo_catalogo and getattr(tipo_catalogo, "codigo", None) else None
    )
    if getattr(evento, "oportunidad", None):
        data["oportunidad_estado"] = evento.oportunidad.estado
        data["oportunidad_titulo"] = evento.oportunidad.titulo
    data["bucket"] = bucket_for_event(evento.fecha_evento)
    data["is_completed"] = evento.estado_evento == EstadoEvento.REALIZADO.value
    data["is_cancelled"] = evento.estado_evento == EstadoEvento.CANCELADO.value
    return data


def group_eventos(eventos: Iterable[CRMEvento]) -> dict[str, list[dict]]:
    buckets = {
        "overdue": [],
        "today": [],
        "tomorrow": [],
        "week": [],
        "next": [],
    }
    for evento in eventos:
        data = serialize_evento(evento)
        bucket = data.get("bucket") or "next"
        if bucket == "overdue" and data.get("is_completed"):
            continue
        if bucket not in buckets:
            buckets[bucket] = []
        buckets[bucket].append(data)
    return buckets


def apply_move(
    session: Session,
    evento: CRMEvento,
    to_bucket: BucketKey,
) -> CRMEvento:
    nueva_fecha = move_date_for_bucket(to_bucket, evento.fecha_evento)
    evento.fecha_evento = nueva_fecha
    if evento.estado_evento != EstadoEvento.REALIZADO.value and evento.estado_evento != EstadoEvento.CANCELADO.value:
        evento.estado_evento = EstadoEvento.PENDIENTE.value
    session.add(evento)
    session.commit()
    session.refresh(evento)
    return evento
