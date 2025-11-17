from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterable, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia


@dataclass
class CalculatedVacancia:
    vacancia: Vacancia
    dias_totales: int
    dias_reparacion: int
    dias_disponible: int
    estado_corte: str
    bucket: str


def _parse_date(value: Optional[object]) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value).date()
        except ValueError:
            return None
    return None


def _diff_days(end: date, start: date) -> int:
    return max(0, (end - start).days)


def _clamp_days(range_start: date, range_end: date, start: Optional[date], end: Optional[date]) -> int:
    if not start or not end:
        return 0
    clamped_start = max(start, range_start)
    clamped_end = min(end, range_end)
    if clamped_end <= clamped_start:
        return 0
    return _diff_days(clamped_end, clamped_start)


def _estado_corte(cierre: Optional[date], cut: date, fecha_alquilada: Optional[datetime], fecha_retirada: Optional[datetime]) -> str:
    if cierre and cierre <= cut:
        return "Alquilada" if fecha_alquilada else "Retirada"
    return "Activo"


def _bucket(fecha_recibida: date, start: date) -> str:
    if fecha_recibida < start:
        return "Historico"
    return f"{fecha_recibida.year}-{str(fecha_recibida.month).zfill(2)}"


def _calculate_for_vacancia(v: Vacancia, start: date, end: date, today: date) -> Optional[CalculatedVacancia]:
    fecha_recibida = _parse_date(v.fecha_recibida)
    if not fecha_recibida or fecha_recibida > end:
        return None

    cierre_dt = v.fecha_alquilada or v.fecha_retirada
    cierre = _parse_date(cierre_dt)
    if cierre and cierre < start:
        return None

    fin_real = cierre or today
    cut = min(end, today)
    fin = min(fin_real, cut)
    inicio = max(fecha_recibida, start)
    dias_totales = _diff_days(fin, inicio)

    reparacion_inicio = _parse_date(v.fecha_en_reparacion)
    reparacion_fin = _parse_date(v.fecha_disponible) or fin_real
    dias_reparacion = _clamp_days(start, fin, reparacion_inicio, reparacion_fin)

    disponible_inicio = _parse_date(v.fecha_disponible)
    disponible_fin = cierre or fin_real
    dias_disponible = _clamp_days(start, fin, disponible_inicio, disponible_fin)

    estado = _estado_corte(cierre, cut, v.fecha_alquilada, v.fecha_retirada)
    return CalculatedVacancia(
        vacancia=v,
        dias_totales=dias_totales,
        dias_reparacion=dias_reparacion,
        dias_disponible=dias_disponible,
        estado_corte=estado,
        bucket=_bucket(fecha_recibida, start),
    )


def _to_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _average(values: Iterable[int]) -> float:
    values = list(values)
    if not values:
        return 0.0
    return round(sum(values) / len(values), 1)


def fetch_vacancias_for_dashboard(
    session: Session,
    start_date: str,
    end_date: str,
    estado_propiedad: Optional[str] = None,
    propietario: Optional[str] = None,
    ambientes: Optional[int] = None,
) -> List[CalculatedVacancia]:
    start = _to_date(start_date)
    end = _to_date(end_date)
    today = datetime.utcnow().date()
    cut = min(end, today)

    # Construir query base desde Vacancia
    query = (
        select(Vacancia)
        .where(Vacancia.deleted_at.is_(None))
        .options(selectinload(Vacancia.propiedad))
    )

    # Si hay filtros de propiedad, hacer join
    join_propiedad = any([estado_propiedad, propietario, ambientes is not None])
    if join_propiedad:
        query = query.join(Propiedad, Vacancia.propiedad_id == Propiedad.id, isouter=False)
        if estado_propiedad:
            query = query.where(Propiedad.estado == estado_propiedad)
        if propietario:
            query = query.where(func.lower(Propiedad.propietario).contains(propietario.lower()))
        if ambientes is not None:
            query = query.where(Propiedad.ambientes == ambientes)

    vacancias = session.exec(query).all()

    calculated: List[CalculatedVacancia] = []
    for vacancia in vacancias:
        try:
            calc = _calculate_for_vacancia(vacancia, start=start, end=cut, today=today)
        except Exception:
            # Si un registro trae datos mal formateados, se omite para no romper el dashboard completo
            continue
        if calc:
            calculated.append(calc)
    
    return calculated


def build_dashboard_payload(items: List[CalculatedVacancia], start_date: str, end_date: str, limit_top: int = 5) -> dict:
    def _vacancia_cost(v: Vacancia, dias: int) -> float:
        alquiler = float(v.propiedad.valor_alquiler or 0) if v.propiedad else 0.0
        expensas = float(v.propiedad.expensas or 0) if v.propiedad else 0.0
        return dias * ((alquiler + expensas) / 30.0)

    def _kpi_stats(subset: list[CalculatedVacancia]) -> dict:
        if not subset:
            return {"count": 0, "propiedades": 0, "dias": 0, "costo": 0.0, "promedio": 0.0}
        unique_props = {item.vacancia.propiedad_id for item in subset}
        total_dias = sum(item.dias_totales for item in subset)
        total_costo = sum(_vacancia_cost(item.vacancia, item.dias_totales) for item in subset)
        promedio = round(total_dias / max(len(unique_props), 1), 1)
        return {
            "count": len(subset),
            "propiedades": len(unique_props),
            "dias": total_dias,
            "costo": round(total_costo, 1),
            "promedio": promedio,
        }

    def _activos_por_estado(subset: list[CalculatedVacancia]) -> dict:
        reparacion = 0
        disponible = 0
        for item in subset:
            estado_propiedad = item.vacancia.propiedad.estado if item.vacancia.propiedad else None
            if estado_propiedad == "2-en_reparacion":
                reparacion += 1
            elif estado_propiedad == "3-disponible":
                disponible += 1
        return {"reparacion": reparacion, "disponible": disponible}

    total = len(items)
    buckets: dict[str, dict[str, list[int] | int]] = {}
    estados = {"activo": 0, "alquilada": 0, "retirada": 0}
    activos: list[CalculatedVacancia] = []

    for item in items:
        bucket = buckets.setdefault(
            item.bucket,
            {"dias_totales": [], "dias_reparacion": [], "dias_disponible": [], "count": 0},
        )
        bucket["count"] += 1
        bucket["dias_totales"].append(item.dias_totales)
        bucket["dias_reparacion"].append(item.dias_reparacion)
        bucket["dias_disponible"].append(item.dias_disponible)

        if item.estado_corte == "Activo":
            estados["activo"] += 1
            activos.append(item)
        elif item.estado_corte == "Alquilada":
            estados["alquilada"] += 1
        else:
            estados["retirada"] += 1

    buckets_list = []
    for name, data in buckets.items():
        buckets_list.append(
            {
                "bucket": name,
                "count": data["count"],
                "dias_totales": _average(data["dias_totales"]),
                "dias_reparacion": _average(data["dias_reparacion"]),
                "dias_disponible": _average(data["dias_disponible"]),
            }
        )

    buckets_list.sort(key=lambda x: ("Historico" != x["bucket"], x["bucket"]))

    promedio_totales = _average([i.dias_totales for i in items])
    promedio_reparacion = _average([i.dias_reparacion for i in items])
    promedio_disponible = _average([i.dias_disponible for i in items])
    porcentaje_retiro = round((estados["retirada"] / total) * 100, 1) if total else 0.0

    top_items = sorted(items, key=lambda i: i.dias_totales, reverse=True)[:limit_top]

    kpi_cards = {
        "totales": _kpi_stats(items),
        "disponible": _kpi_stats([i for i in items if i.vacancia.propiedad and i.vacancia.propiedad.estado == "3-disponible"]),
        "reparacion": _kpi_stats([i for i in items if i.vacancia.propiedad and i.vacancia.propiedad.estado == "2-en_reparacion"]),
        "activas": _kpi_stats(
            [i for i in items if i.estado_corte == "Activo" and (i.vacancia.propiedad is None or i.vacancia.propiedad.estado not in {"4-alquilada", "5-retirada"})]
        ),
    }

    payload = {
        "range": {"startDate": start_date, "endDate": end_date},
        "kpis": {
            "totalVacancias": total,
            "promedioDiasTotales": promedio_totales,
            "promedioDiasReparacion": promedio_reparacion,
            "promedioDiasDisponible": promedio_disponible,
            "porcentajeRetiro": porcentaje_retiro,
        },
        "buckets": buckets_list,
        "estados_finales": estados,
        "activos_detalle": _activos_por_estado(activos),
        "kpi_cards": kpi_cards,
        "top": [
            {
                "vacancia": item.vacancia,
                "dias_totales": item.dias_totales,
                "dias_reparacion": item.dias_reparacion,
                "dias_disponible": item.dias_disponible,
                "estado_corte": item.estado_corte,
                "bucket": item.bucket,
            }
            for item in top_items
        ],
    }

    return payload
