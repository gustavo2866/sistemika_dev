from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any, Optional

from sqlmodel import Session, select

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


def build_propiedades_dashboard(session: Session, pivot_date: date) -> dict[str, Any]:
    query = (
        select(Propiedad, CRMTipoOperacion, PropiedadesStatus)
        .where(Propiedad.deleted_at.is_(None))
        .join(CRMTipoOperacion, Propiedad.tipo_operacion_id == CRMTipoOperacion.id, isouter=True)
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
    )
    rows = session.exec(query).all()

    # estado -> tipo_operacion_id -> agregado
    state_map: dict[str, dict[Optional[int], dict[str, Any]]] = defaultdict(dict)
    state_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "dias_total": 0})
    state_order: dict[str, int] = {}

    for prop, tipo_operacion, estado_ref in rows:
        estado = (estado_ref.nombre if estado_ref else None) or "Sin estado"
        if estado not in state_order:
            state_order[estado] = estado_ref.orden if estado_ref else 999
        tipo_id = tipo_operacion.id if tipo_operacion else None
        tipo_nombre = tipo_operacion.nombre if tipo_operacion else "Sin tipo de operacion"
        dias = _safe_days(pivot_date, prop.vacancia_fecha)

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
        bucket["dias_vacancia_total"] += dias

        state_totals[estado]["count"] += 1
        state_totals[estado]["dias_total"] += dias

    cards = []
    for estado, tipos in state_map.items():
        tipo_items = list(tipos.values())
        for item in tipo_items:
            props = item["propiedades"] or 1
            item["dias_vacancia_promedio"] = int(round(item["dias_vacancia_total"] / props))
        tipo_items.sort(key=lambda item: item["propiedades"], reverse=True)
        total = state_totals[estado]
        cards.append(
            {
                "estado": estado,
                "orden": state_order.get(estado, 999),
                "propiedades": total["count"],
                "dias_vacancia_total": total["dias_total"],
                "dias_vacancia_promedio": int(round(total["dias_total"] / max(total["count"], 1))),
                "tipos": tipo_items,
            }
        )

    cards.sort(key=lambda item: (item.get("orden", 999), item["estado"]))

    return {
        "pivotDate": pivot_date.isoformat(),
        "totalPropiedades": sum(item["propiedades"] for item in cards),
        "cards": cards,
    }
