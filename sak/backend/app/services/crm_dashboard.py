from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad
from app.models.propiedad import Propiedad


@dataclass
class CalculatedOportunidad:
    """Wrapper con datos calculados para un dashboard.
    
    - Totales: dataset filtrado según reglas del periodo.
    - Nuevas: oportunidades cuya entrada al estado ABIERTO ocurrió dentro del periodo.
    - Ganadas/Perdidas: cierres dentro del rango.
    - Pendientes: abiertas al corte (no cerradas o se cierran después del fin del periodo).
    """

    oportunidad: CRMOportunidad
    fecha_creacion: date
    fecha_estado: date
    fecha_abierta: Optional[date]
    fecha_cierre: Optional[date]
    estado_al_corte: str
    estado_cierre: Optional[str]
    monto_estimado: Optional[Decimal]
    monto_propiedad: Optional[Decimal]
    es_pendiente: bool
    es_ganada_periodo: bool
    es_perdida_periodo: bool
    es_nueva_periodo: bool
    bucket_creacion: str
    bucket_estado: str
    bucket_cierre: Optional[str]
    dias_pipeline: int


def _to_date(value: str | date | datetime | None) -> date:
    if value is None:
        raise ValueError("Fecha requerida")
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_date(value: Optional[datetime]) -> Optional[date]:
    if value is None:
        return None
    return value.date()


def _month_bucket(value: date | None) -> Optional[str]:
    if not value:
        return None
    return f"{value.year}-{value.month:02d}"


def _decimal(value: Optional[Decimal | float | int]) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _sum_amount(values: Iterable[Optional[Decimal]]) -> Decimal:
    total = Decimal("0")
    for value in values:
        if value is None:
            continue
        total += value
    return total


def _estado_al_corte(oportunidad: CRMOportunidad, corte: date) -> str:
    estado = oportunidad.estado
    logs = sorted(oportunidad.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min, reverse=True)
    for log in logs:
        if log.fecha_registro and log.fecha_registro.date() > corte:
            estado = log.estado_anterior or estado
        else:
            break
    return estado


def _fecha_cierre(oportunidad: CRMOportunidad) -> Tuple[Optional[date], Optional[str]]:
    logs = sorted(oportunidad.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
    for log in logs:
        if log.estado_nuevo in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value):
            return (_parse_date(log.fecha_registro), log.estado_nuevo)
    return None, None


def _diff_days(end: date, start: date) -> int:
    return max(0, (end - start).days)


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _shift_month(base: date, months: int) -> date:
    month = base.month - 1 + months
    year = base.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def _month_end(value: date) -> date:
    next_month = _shift_month(value, 1)
    return next_month - timedelta(days=1)


def _fecha_abierta(oportunidad: CRMOportunidad) -> Optional[date]:
    """Devuelve la primera fecha en la que la oportunidad ingresó al estado ABIERTO."""
    logs = sorted(oportunidad.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
    for log in logs:
        if log.estado_nuevo == EstadoOportunidad.ABIERTA.value and log.fecha_registro:
            return log.fecha_registro.date()
    if oportunidad.created_at:
        return oportunidad.created_at.date()
    return None


def _monto_estimado(oportunidad: CRMOportunidad) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    if oportunidad.monto is not None:
        monto = _decimal(oportunidad.monto)
        return monto, monto

    propiedad = oportunidad.propiedad
    if not propiedad:
        return None, None

    tipo_codigo = oportunidad.tipo_operacion.codigo if oportunidad.tipo_operacion else None
    if tipo_codigo and tipo_codigo.lower() == "alquiler":
        base = _decimal(propiedad.valor_alquiler) or _decimal(propiedad.precio_venta_estimado)
    else:
        base = _decimal(propiedad.precio_venta_estimado) or _decimal(propiedad.valor_alquiler)

    if base is None:
        base = _decimal(propiedad.costo_propiedad)

    return base, _decimal(propiedad.precio_venta_estimado) or _decimal(propiedad.valor_alquiler)


def fetch_oportunidades_for_dashboard(
    session: Session,
    start_date: str,
    end_date: str,
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
) -> List[CalculatedOportunidad]:
    start = _to_date(start_date)
    end = _to_date(end_date)

    query = (
        select(CRMOportunidad)
        .where(CRMOportunidad.deleted_at.is_(None))
        .options(
            selectinload(CRMOportunidad.propiedad),
            selectinload(CRMOportunidad.tipo_operacion),
            selectinload(CRMOportunidad.contacto),
            selectinload(CRMOportunidad.responsable),
            selectinload(CRMOportunidad.moneda),
            selectinload(CRMOportunidad.logs_estado),
        )
    )

    join_propiedad = bool(tipo_propiedad or propietario or emprendimiento_ids)
    if join_propiedad:
        query = query.join(Propiedad, Propiedad.id == CRMOportunidad.propiedad_id)
        query = query.where(Propiedad.deleted_at.is_(None))

    if tipo_operacion_ids:
        query = query.where(CRMOportunidad.tipo_operacion_id.in_(tipo_operacion_ids))
    if responsable_ids:
        query = query.where(CRMOportunidad.responsable_id.in_(responsable_ids))
    if tipo_propiedad:
        query = query.where(Propiedad.tipo.in_(tipo_propiedad))
    if propietario:
        query = query.where(func.lower(Propiedad.propietario).contains(propietario.lower()))
    if emprendimiento_ids:
        query = query.where(Propiedad.emprendimiento_id.in_(emprendimiento_ids))

    oportunidades = session.exec(query).all()

    calculated: List[CalculatedOportunidad] = []
    for oportunidad in oportunidades:
        if not oportunidad.created_at:
            continue
        fecha_creacion = oportunidad.created_at.date()
        if fecha_creacion > end:
            continue

        fecha_cierre, estado_cierre = _fecha_cierre(oportunidad)
        if fecha_cierre and fecha_cierre < start:
            continue

        fecha_estado = _parse_date(oportunidad.fecha_estado) or fecha_creacion
        fecha_abierta = _fecha_abierta(oportunidad) or fecha_creacion

        estado_al_corte = _estado_al_corte(oportunidad, end)
        monto_estimado, monto_propiedad = _monto_estimado(oportunidad)

        include_closed = fecha_cierre is not None and start <= fecha_cierre <= end
        include_open = (fecha_cierre is None or fecha_cierre > end) and fecha_creacion <= end
        if not (include_closed or include_open):
            continue

        es_pendiente = fecha_cierre is None or fecha_cierre > end
        es_ganada_periodo = (
            estado_cierre == EstadoOportunidad.GANADA.value
            and fecha_cierre is not None
            and start <= fecha_cierre <= end
        )
        es_perdida_periodo = (
            estado_cierre == EstadoOportunidad.PERDIDA.value
            and fecha_cierre is not None
            and start <= fecha_cierre <= end
        )
        es_nueva_periodo = fecha_abierta is not None and start <= fecha_abierta <= end

        bucket_creacion = _month_bucket(fecha_creacion) or "Sin-fecha"
        bucket_estado = _month_bucket(fecha_estado) or "Sin-fecha"
        bucket_cierre = _month_bucket(fecha_cierre)
        fin_para_duracion = fecha_cierre if fecha_cierre and fecha_cierre <= end else end
        dias_pipeline = _diff_days(fin_para_duracion, fecha_creacion)

        calculated.append(
            CalculatedOportunidad(
                oportunidad=oportunidad,
                fecha_creacion=fecha_creacion,
                fecha_estado=fecha_estado,
                fecha_abierta=fecha_abierta,
                fecha_cierre=fecha_cierre,
                estado_al_corte=estado_al_corte,
                estado_cierre=estado_cierre,
                monto_estimado=monto_estimado,
                monto_propiedad=monto_propiedad,
                es_pendiente=es_pendiente,
                es_ganada_periodo=es_ganada_periodo,
                es_perdida_periodo=es_perdida_periodo,
                es_nueva_periodo=es_nueva_periodo,
                bucket_creacion=bucket_creacion,
                bucket_estado=bucket_estado,
                bucket_cierre=bucket_cierre,
                dias_pipeline=dias_pipeline,
            )
        )

    return calculated


def _kpi_summary(items: List[CalculatedOportunidad]) -> Dict[str, float | int]:
    count = len(items)
    amount = _sum_amount(item.monto_estimado for item in items)
    return {
        "count": count,
        "amount": float(amount.quantize(Decimal("0.01"))) if amount else 0.0,
    }


def _conversion(part: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round((part / total) * 100, 1)


def build_crm_dashboard_payload(
    items: List[CalculatedOportunidad],
    start_date: str,
    end_date: str,
    limit_top: int = 5,
    filters: Optional[dict] = None,
    session: Optional[Session] = None,
) -> dict:
    end = _to_date(end_date)

    totales = items
    pendientes = [item for item in items if item.es_pendiente]
    ganadas = [item for item in items if item.es_ganada_periodo]
    perdidas = [item for item in items if item.es_perdida_periodo]
    nuevas = [item for item in items if item.es_nueva_periodo]

    total_count = max(len(totales), 1)

    kpis = {
        "totales": _kpi_summary(totales),
        "nuevas": _kpi_summary(nuevas),
        "ganadas": _kpi_summary(ganadas),
        "pendientes": _kpi_summary(pendientes),
    }
    kpis["totales"]["incremento"] = _conversion(len(ganadas), total_count)
    kpis["nuevas"]["incremento"] = _conversion(len(nuevas), total_count)
    kpis["ganadas"]["conversion"] = _conversion(len(ganadas), total_count)
    kpis["pendientes"]["incremento"] = _conversion(len(pendientes), total_count)

    estados_pipeline = [
        (EstadoOportunidad.ABIERTA.value, "Abierta"),
        (EstadoOportunidad.VISITA.value, "Visita"),
        (EstadoOportunidad.COTIZA.value, "Cotiza"),
        (EstadoOportunidad.RESERVA.value, "Reserva"),
        (EstadoOportunidad.GANADA.value, "Ganada"),
        (EstadoOportunidad.PERDIDA.value, "Perdida"),
    ]

    funnel = []
    total_items = len(totales)
    anterior = None
    for estado_value, label in estados_pipeline:
        en_estado = [item for item in items if item.estado_al_corte == estado_value]
        count = len(en_estado)
        conversion = _conversion(count, total_items)
        drop = conversion - _conversion(anterior, total_items) if anterior is not None else conversion
        funnel.append(
            {
                "estado": estado_value,
                "label": label,
                "count": count,
                "amount": float(
                    _sum_amount(item.monto_estimado for item in en_estado).quantize(Decimal("0.01"))
                )
                if en_estado
                else 0.0,
                "conversion": conversion,
                "dropVsPrevious": round(drop, 1),
            }
        )
        anterior = count

    # Evolución mensual - últimos 12 meses
    base_month = _month_start(end)
    months: list[tuple[date, date]] = []
    for offset in range(11, -1, -1):
        month_start = _shift_month(base_month, -offset)
        month_end = _month_end(month_start)
        if month_end > end:
            month_end = end
        months.append((month_start, month_end))

    def _belongs_new(item: CalculatedOportunidad, start_m: date, end_m: date) -> bool:
        return item.fecha_abierta is not None and start_m <= item.fecha_abierta <= end_m

    def _belongs_ganada(item: CalculatedOportunidad, start_m: date, end_m: date) -> bool:
        return (
            item.estado_cierre == EstadoOportunidad.GANADA.value
            and item.fecha_cierre is not None
            and start_m <= item.fecha_cierre <= end_m
        )

    def _belongs_perdida(item: CalculatedOportunidad, start_m: date, end_m: date) -> bool:
        return (
            item.estado_cierre == EstadoOportunidad.PERDIDA.value
            and item.fecha_cierre is not None
            and start_m <= item.fecha_cierre <= end_m
        )

    def _open_in_month(item: CalculatedOportunidad, start_m: date, end_m: date) -> bool:
        fecha_abierta = item.fecha_abierta or item.fecha_creacion
        if fecha_abierta and fecha_abierta > end_m:
            return False
        if item.fecha_cierre and item.fecha_cierre < start_m:
            return False
        return True

    def _opening_before(items: List[CalculatedOportunidad], cut: date) -> int:
        return sum(
            1
            for item in items
            if (item.fecha_abierta or item.fecha_creacion) < cut and not (item.fecha_cierre and item.fecha_cierre < cut)
        )

    evolucion: list[dict[str, object]] = []
    previous_open = _opening_before(items, months[0][0]) if months else 0
    for month_start, month_end in months:
        total_count = sum(1 for item in items if _open_in_month(item, month_start, month_end))
        nuevas_count = sum(1 for item in items if _belongs_new(item, month_start, month_end))
        ganadas_count = sum(1 for item in items if _belongs_ganada(item, month_start, month_end))
        perdidas_count = sum(1 for item in items if _belongs_perdida(item, month_start, month_end))
        pendientes_mes = previous_open
        evolucion.append(
            {
                "bucket": month_start.strftime("%Y-%m"),
                "totales": total_count,
                "nuevas": nuevas_count,
                "ganadas": ganadas_count,
                "perdidas": perdidas_count,
                "pendientes": pendientes_mes,
            }
        )
        previous_open = total_count

    def _ranking(data: List[CalculatedOportunidad]) -> List[dict]:
        sorted_items = sorted(
            data,
            key=lambda item: (
                item.monto_estimado or Decimal("0"),
                item.fecha_creacion,
            ),
            reverse=True,
        )
        ranking = []
        for item in sorted_items[:limit_top]:
            ranking.append(
                {
                    "oportunidad": item.oportunidad,
                    "estado": item.estado_al_corte,
                    "fecha": item.fecha_creacion.isoformat(),
                    "monto": float(item.monto_estimado) if item.monto_estimado else 0.0,
                    "moneda": item.oportunidad.moneda.codigo if item.oportunidad.moneda else None,
                    "dias_pipeline": item.dias_pipeline,
                    "bucket": item.bucket_creacion,
                    "kpiKey": "totales",
                }
            )
        return ranking

    ranking = {
        "totales": _ranking(totales),
        "nuevas": [
            {**entry, "kpiKey": "nuevas"}
            for entry in _ranking(nuevas)
        ],
        "ganadas": [
            {**entry, "kpiKey": "ganadas"}
            for entry in _ranking(ganadas)
        ],
        "pendientes": [
            {**entry, "kpiKey": "pendientes"}
            for entry in _ranking(pendientes)
        ],
    }

    stats = {
        "sinMonto": sum(1 for item in items if item.monto_estimado is None),
        "sinPropiedad": sum(1 for item in items if item.oportunidad.propiedad is None),
    }

    # Ranking de propiedades disponibles
    propiedades_disponibles: Dict[int, dict] = {}
    
    # Si hay sesión disponible, consultar TODAS las propiedades disponibles
    if session:
        all_props_disponibles = session.exec(
            select(Propiedad)
            .where(Propiedad.estado == "3-disponible")
            .where(Propiedad.deleted_at.is_(None))
        ).all()
        
        # Inicializar con todas las propiedades disponibles
        for prop in all_props_disponibles:
            propiedades_disponibles[prop.id] = {
                "propiedad": prop,
                "perdidas": 0,
                "fecha_disponible": prop.estado_fecha.isoformat() if prop.estado_fecha else None,
            }
        
        # Consultar TODAS las oportunidades perdidas históricamente para propiedades disponibles
        # No filtrar por período - queremos el historial completo
        query_perdidas = (
            select(CRMOportunidad)
            .where(CRMOportunidad.deleted_at.is_(None))
            .where(CRMOportunidad.estado == EstadoOportunidad.PERDIDA.value)
            .where(CRMOportunidad.propiedad_id.in_([p.id for p in all_props_disponibles]))
        )
        
        oportunidades_perdidas = session.exec(query_perdidas).all()
        
        # Contar oportunidades perdidas por propiedad
        for opp in oportunidades_perdidas:
            if opp.propiedad_id in propiedades_disponibles:
                propiedades_disponibles[opp.propiedad_id]["perdidas"] += 1
    else:
        # Fallback: usar solo las oportunidades del período (comportamiento anterior)
        for item in items:
            prop = item.oportunidad.propiedad
            if not prop or prop.estado != "3-disponible":
                continue
            
            if prop.id not in propiedades_disponibles:
                propiedades_disponibles[prop.id] = {
                    "propiedad": prop,
                    "perdidas": 0,
                    "fecha_disponible": prop.estado_fecha.isoformat() if getattr(prop, "estado_fecha", None) else None,
                }
            
            if item.estado_cierre == EstadoOportunidad.PERDIDA.value:
                propiedades_disponibles[prop.id]["perdidas"] += 1

    ranking_propiedades = sorted(
        propiedades_disponibles.values(),
        key=lambda value: value["perdidas"],
        reverse=True,
    )

    return {
        "range": {"startDate": start_date, "endDate": end_date},
        "filters": filters or {},
        "kpis": kpis,
        "funnel": funnel,
        "evolucion": evolucion,
        "ranking": ranking,
        "stats": stats,
        "ranking_propiedades": ranking_propiedades,
    }
