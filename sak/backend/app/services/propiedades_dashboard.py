from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any, Optional

from sqlmodel import Session, select
from sqlalchemy import func

from app.models.propiedad import Propiedad, PropiedadesStatus
from app.models.crm.catalogos import CRMTipoOperacion


def _safe_days(pivot: date, start: Optional[date]) -> int:
    if not start:
        return 0
    delta = (pivot - start).days
    return max(delta, 0)


def _estado_sort_key(value: str) -> tuple[int, str]:
    if not value:
        return (999, "")
    prefix = value.split("-", 1)[0]
    try:
        return (int(prefix), value)
    except ValueError:
        return (999, value)


def _resolve_status_id(session: Session, name_fragment: str) -> Optional[int]:
    status = session.exec(
        select(PropiedadesStatus)
        .where(PropiedadesStatus.nombre.ilike(f"%{name_fragment}%"))
        .order_by(PropiedadesStatus.orden.asc())
    ).first()
    return status.id if status else None


def _normalize_estado(value: str) -> str:
    return (value or "").strip().lower()



def build_propiedades_dashboard(
    session: Session,
    pivot_date: date,
    tipo_operacion_id: Optional[int] = None,
) -> dict[str, Any]:
    statuses = session.exec(select(PropiedadesStatus)).all()
    query = (
        select(Propiedad, CRMTipoOperacion, PropiedadesStatus)
        .where(Propiedad.deleted_at.is_(None))
        .join(CRMTipoOperacion, Propiedad.tipo_operacion_id == CRMTipoOperacion.id, isouter=True)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
    )
    if tipo_operacion_id is not None:
        query = query.where(Propiedad.tipo_operacion_id == tipo_operacion_id)
    rows = session.exec(query).all()

    # estado -> tipo_operacion_id -> agregado
    state_map: dict[str, dict[Optional[int], dict[str, Any]]] = defaultdict(dict)
    state_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0})
    state_order: dict[str, int] = {}

    for prop, tipo_operacion, estado_ref in rows:
        estado = (estado_ref.nombre if estado_ref else None) or "Sin estado"
        if estado not in state_order:
            state_order[estado] = estado_ref.orden if estado_ref else 999
        tipo_id = tipo_operacion.id if tipo_operacion else None
        tipo_nombre = tipo_operacion.nombre if tipo_operacion else "Sin tipo de operacion"

        bucket = state_map[estado].get(tipo_id)
        if not bucket:
            bucket = {
                "tipo_operacion_id": tipo_id,
                "tipo_operacion": tipo_nombre,
                "propiedades": 0,
                "dias_vacancia_total": 0,
                "dias_vacancia_promedio": 0,
            }
            state_map[estado][tipo_id] = bucket

        bucket["propiedades"] += 1
        bucket["dias_vacancia_total"] += _safe_days(pivot_date, prop.estado_fecha)
        state_totals[estado]["count"] += 1

    # Asegurar tarjetas vacías para estados finales aunque no haya registros vinculados
    for status in statuses:
        nombre = status.nombre or ""
        if nombre not in state_map:
            state_map[nombre] = {}
        if nombre not in state_totals:
            state_totals[nombre] = {"count": 0}
        if nombre not in state_order:
            state_order[nombre] = status.orden

    cards = []
    for estado, tipos in state_map.items():
        tipo_items = list(tipos.values())
        for item in tipo_items:
            props = item.get("propiedades", 0) or 0
            total_days = item.get("dias_vacancia_total", 0) or 0
            item["dias_vacancia_promedio"] = round(total_days / props) if props else 0
        tipo_items.sort(key=lambda item: item["propiedades"], reverse=True)
        total = state_totals[estado]
        cards.append(
            {
                "estado": estado,
                "orden": state_order.get(estado, 999),
                "propiedades": total["count"],
                "tipos": tipo_items,
            }
        )

    cards.sort(key=lambda item: (item.get("orden", 999), item["estado"]))

    # Simplificar métricas de retiro sin usar vacancias
    retirada_id = _resolve_status_id(session, "retirada")
    if retirada_id is not None:
        retiro_query = (
            select(Propiedad.estado_fecha)
            .where(Propiedad.deleted_at.is_(None))
            .where(Propiedad.propiedad_status_id == retirada_id)
        )
        if tipo_operacion_id is not None:
            retiro_query = retiro_query.where(Propiedad.tipo_operacion_id == tipo_operacion_id)

        fechas_retiro = session.exec(retiro_query).all()
        recientes = 0
        antiguas = 0
        for fecha_retiro in fechas_retiro:
            if not fecha_retiro:
                continue
            days = (pivot_date - fecha_retiro).days
            if days <= 30:
                recientes += 1
            else:
                antiguas += 1

        for card in cards:
            if "retirada" in _normalize_estado(card["estado"]):
                card["retiradaBuckets"] = [
                    {"key": "lt_30", "label": "< 30 dias", "count": recientes},
                    {"key": "gt_30", "label": "Mas antiguas", "count": antiguas},
                ]
                break

    return {
        "pivotDate": pivot_date.isoformat(),
        "totalPropiedades": sum(item["propiedades"] for item in cards),
        "cards": cards,
    }


def build_realizada_vencimientos(
    session: Session,
    pivot_date: date,
    tipo_operacion_id: Optional[int] = None,
) -> dict[str, Any]:
    if tipo_operacion_id is None:
        alquiler = session.exec(
            select(CRMTipoOperacion).where(
                (CRMTipoOperacion.nombre.ilike("%alquiler%"))
                | (CRMTipoOperacion.codigo.ilike("%alquiler%"))
            )
        ).first()
        tipo_operacion_id = alquiler.id if alquiler else None
    realizada_id = _resolve_status_id(session, "realizada")
    if realizada_id is None:
        return {
            "pivotDate": pivot_date.isoformat(),
            "tipoOperacionId": tipo_operacion_id,
            "ranges": [
                {"key": "vencidos", "label": "Vencidos", "count": 0},
                {"key": "lt_30", "label": "Vencen < 30 dias", "count": 0},
            ],
            "total": 0,
        }

    query = (
        select(
            Propiedad.vencimiento_contrato,
            Propiedad.fecha_renovacion,
        )
        .where(Propiedad.deleted_at.is_(None))
        .where(Propiedad.propiedad_status_id == realizada_id)
    )
    if tipo_operacion_id is not None:
        query = query.where(Propiedad.tipo_operacion_id == tipo_operacion_id)

    rows = session.exec(query).all()

    bucket_days = getattr(Propiedad, "REALIZADA_ALERT_DAYS", 60)
    vencimiento_lt_60 = 0
    renovacion_lt_60 = 0
    for vencimiento, fecha_renovacion in rows:
        if vencimiento is not None:
            days = (vencimiento - pivot_date).days
            if 0 <= days < bucket_days:
                vencimiento_lt_60 += 1
        if fecha_renovacion is not None:
            if vencimiento is not None and fecha_renovacion > vencimiento:
                continue
            days = (fecha_renovacion - pivot_date).days
            if 0 <= days < bucket_days:
                renovacion_lt_60 += 1

    return {
        "pivotDate": pivot_date.isoformat(),
        "tipoOperacionId": tipo_operacion_id,
        "ranges": [
            {
                "key": "vencimiento_lt_60",
                "label": f"Vencimiento < {bucket_days} dias",
                "count": vencimiento_lt_60,
            },
            {
                "key": "renovacion_lt_60",
                "label": f"Renovacion < {bucket_days} dias",
                "count": renovacion_lt_60,
            },
        ],
        "total": len(rows),
    }
