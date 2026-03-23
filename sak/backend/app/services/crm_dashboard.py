from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.crm import CRMEvento, CRMMensaje, CRMOportunidad
from app.models.enums import EstadoEvento, EstadoMensaje, EstadoOportunidad, TipoMensaje
from app.models.propiedad import Propiedad, PropiedadesStatus

OPEN_PIPELINE_STATES = (
    EstadoOportunidad.ABIERTA.value,
    EstadoOportunidad.VISITA.value,
    EstadoOportunidad.COTIZA.value,
    EstadoOportunidad.RESERVA.value,
)


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
    fecha_ingreso_pipeline: Optional[date]
    fecha_cierre: Optional[date]
    estado_al_corte: str
    estado_cierre: Optional[str]
    monto_estimado: Optional[Decimal]
    monto_propiedad: Optional[Decimal]
    es_pendiente: bool
    es_pendiente_inicio: bool
    es_prospect: bool
    es_proceso: bool
    es_reserva: bool
    es_ganada_periodo: bool
    es_perdida_periodo: bool
    es_cerrada_periodo: bool
    es_cerrada_30d: bool
    es_nueva_periodo: bool
    bucket_creacion: str
    bucket_pipeline: Optional[str]
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


def _fecha_ingreso_pipeline(oportunidad: CRMOportunidad) -> Optional[date]:
    """Devuelve la primera fecha en la que la oportunidad ingresó al estado ABIERTO."""
    logs = sorted(oportunidad.logs_estado or [], key=lambda log: log.fecha_registro or datetime.min)
    for log in logs:
        if log.estado_nuevo != EstadoOportunidad.PROSPECT.value and log.fecha_registro:
            return log.fecha_registro.date()
    if oportunidad.created_at and oportunidad.estado != EstadoOportunidad.PROSPECT.value:
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


def _is_open_pipeline_state(estado: Optional[str]) -> bool:
    return estado in OPEN_PIPELINE_STATES


def _is_open_pipeline_at(item: CalculatedOportunidad, cut: date) -> bool:
    fecha_ingreso_pipeline = item.fecha_ingreso_pipeline
    if fecha_ingreso_pipeline is None or fecha_ingreso_pipeline > cut:
        return False
    if item.fecha_cierre and item.fecha_cierre <= cut:
        return False
    return _is_open_pipeline_state(_estado_al_corte(item.oportunidad, cut))


def _apply_oportunidad_filters(
    query,
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
):
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

    return query


def _build_dashboard_alerts(
    items: List[CalculatedOportunidad],
    session: Optional[Session],
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
) -> Dict[str, int]:
    item_ids = [item.oportunidad.id for item in items if item.oportunidad.id is not None]
    stale_cutoff = datetime.now(UTC) - timedelta(days=30)

    if not session or not item_ids:
        return {
            "mensajesSinLeer": 0,
            "prospectSinResolver": sum(
                1
                for item in items
                if item.oportunidad.estado == EstadoOportunidad.PROSPECT.value and item.oportunidad.activo
            ),
            "tareasVencidas": 0,
            "enProcesoSinMovimiento": sum(
                1
                for item in items
                if item.oportunidad.activo
                and item.oportunidad.estado
                not in (
                    EstadoOportunidad.PROSPECT.value,
                    EstadoOportunidad.GANADA.value,
                    EstadoOportunidad.PERDIDA.value,
                )
                and item.oportunidad.fecha_estado
                and item.oportunidad.fecha_estado.replace(tzinfo=UTC)
                < stale_cutoff
            ),
        }

    today = datetime.now(UTC).date()

    query_mensajes = (
        select(func.count(func.distinct(CRMMensaje.oportunidad_id)))
        .select_from(CRMMensaje)
        .where(CRMMensaje.deleted_at.is_(None))
        .where(CRMMensaje.oportunidad_id.in_(item_ids))
        .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
        .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
    )

    query_eventos = (
        select(func.count(func.distinct(CRMEvento.oportunidad_id)))
        .select_from(CRMEvento)
        .where(CRMEvento.deleted_at.is_(None))
        .where(CRMEvento.oportunidad_id.in_(item_ids))
        .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
        .where(CRMEvento.fecha_evento.is_not(None))
        .where(func.date(CRMEvento.fecha_evento) < today)
    )

    return {
        "mensajesSinLeer": int(session.exec(query_mensajes).one() or 0),
        "prospectSinResolver": sum(
            1
            for item in items
            if item.oportunidad.estado == EstadoOportunidad.PROSPECT.value and item.oportunidad.activo
        ),
        "tareasVencidas": int(session.exec(query_eventos).one() or 0),
        "enProcesoSinMovimiento": sum(
            1
            for item in items
            if item.oportunidad.activo
            and item.oportunidad.estado
            not in (
                EstadoOportunidad.PROSPECT.value,
                EstadoOportunidad.GANADA.value,
                EstadoOportunidad.PERDIDA.value,
            )
            and item.oportunidad.fecha_estado
            and item.oportunidad.fecha_estado.replace(tzinfo=UTC) < stale_cutoff
        ),
    }


def fetch_current_oportunidades_for_dashboard(
    session: Session,
    start_date: str,
    end_date: str,
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
) -> List[CRMOportunidad]:
    items = fetch_oportunidades_for_dashboard(
        session=session,
        start_date=start_date,
        end_date=end_date,
        tipo_operacion_ids=tipo_operacion_ids,
        tipo_propiedad=tipo_propiedad,
        responsable_ids=responsable_ids,
        propietario=propietario,
        emprendimiento_ids=emprendimiento_ids,
    )
    current_by_id: dict[int, CRMOportunidad] = {}
    current_without_id: list[CRMOportunidad] = []

    for item in items:
        if not (item.es_pendiente or item.es_cerrada_30d):
            continue

        oportunidad = item.oportunidad
        if oportunidad.id is None:
            current_without_id.append(oportunidad)
            continue
        current_by_id[oportunidad.id] = oportunidad

    return [*current_by_id.values(), *current_without_id]


def _selector_summary(oportunidades: Sequence[CRMOportunidad]) -> Dict[str, float | int]:
    count = len(oportunidades)
    amount = _sum_amount(_monto_estimado(oportunidad)[0] for oportunidad in oportunidades)
    return {
        "count": count,
        "amount": float(amount.quantize(Decimal("0.01"))) if amount else 0.0,
    }


def build_current_selector_summary(
    oportunidades: Sequence[CRMOportunidad],
    start_date: str,
    end_date: str,
) -> Dict[str, Dict[str, float | int]]:
    start = _to_date(start_date)
    end = _to_date(end_date)
    proceso_states = set(OPEN_PIPELINE_STATES[:-1])

    prospect = [
        oportunidad
        for oportunidad in oportunidades
        if oportunidad.estado == EstadoOportunidad.PROSPECT.value
    ]
    proceso = [
        oportunidad
        for oportunidad in oportunidades
        if oportunidad.estado in proceso_states
    ]
    reserva = [
        oportunidad
        for oportunidad in oportunidades
        if oportunidad.estado == EstadoOportunidad.RESERVA.value
    ]
    cerrada = [
        oportunidad
        for oportunidad in oportunidades
        if oportunidad.estado in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value)
        and oportunidad.fecha_estado is not None
        and start <= oportunidad.fecha_estado.date() <= end
    ]

    return {
        "prospect": _selector_summary(prospect),
        "proceso": _selector_summary(proceso),
        "reserva": _selector_summary(reserva),
        "cerrada": _selector_summary(cerrada),
    }


def build_current_funnel(
    items: Sequence[CalculatedOportunidad],
) -> List[dict]:
    prospect = [item for item in items if item.es_prospect]
    proceso = [item for item in items if item.es_proceso]
    reserva = [item for item in items if item.es_reserva]
    cerrada = [item for item in items if item.es_cerrada_periodo]

    ordered = [
        ("prospect", "Prospect", prospect),
        ("proceso", "Proceso", proceso),
        ("reserva", "Reserva", reserva),
        ("cerrada", "Cierre", cerrada),
    ]
    total_items = max(sum(len(grp) for _, _, grp in ordered), 1)
    previous_count: Optional[int] = None
    funnel: List[dict] = []

    for key, label, grp in ordered:
        count = len(grp)
        amount = _sum_amount(item.monto_estimado for item in grp)
        conversion = _conversion(count, total_items)
        previous_conversion = _conversion(previous_count, total_items) if previous_count is not None else 0.0
        funnel.append(
            {
                "estado": key,
                "label": label,
                "count": count,
                "amount": float(amount.quantize(Decimal("0.01"))) if amount else 0.0,
                "conversion": conversion,
                "dropVsPrevious": round(conversion - previous_conversion, 1)
                if previous_count is not None
                else conversion,
            }
        )
        previous_count = count

    return funnel


def build_current_dashboard_alerts(
    oportunidades: Sequence[CRMOportunidad],
    session: Optional[Session],
) -> Dict[str, int]:
    oportunidad_ids = [oportunidad.id for oportunidad in oportunidades if oportunidad.id is not None]
    stale_cutoff = datetime.now(UTC) - timedelta(days=30)

    if not session or not oportunidad_ids:
        return {
            "mensajesSinLeer": 0,
            "prospectSinResolver": sum(
                1
                for oportunidad in oportunidades
                if oportunidad.estado == EstadoOportunidad.PROSPECT.value and oportunidad.activo
            ),
            "tareasVencidas": 0,
            "enProcesoSinMovimiento": sum(
                1
                for oportunidad in oportunidades
                if oportunidad.activo
                and oportunidad.estado
                in (
                    EstadoOportunidad.ABIERTA.value,
                    EstadoOportunidad.VISITA.value,
                    EstadoOportunidad.COTIZA.value,
                    EstadoOportunidad.RESERVA.value,
                )
                and oportunidad.fecha_estado
                and oportunidad.fecha_estado.replace(tzinfo=UTC) < stale_cutoff
            ),
        }

    today = datetime.now(UTC).date()

    query_mensajes = (
        select(func.count(func.distinct(CRMMensaje.oportunidad_id)))
        .select_from(CRMMensaje)
        .where(CRMMensaje.deleted_at.is_(None))
        .where(CRMMensaje.oportunidad_id.in_(oportunidad_ids))
        .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
        .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
    )

    query_eventos = (
        select(func.count(func.distinct(CRMEvento.oportunidad_id)))
        .select_from(CRMEvento)
        .where(CRMEvento.deleted_at.is_(None))
        .where(CRMEvento.oportunidad_id.in_(oportunidad_ids))
        .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
        .where(CRMEvento.fecha_evento.is_not(None))
        .where(func.date(CRMEvento.fecha_evento) < today)
    )

    return {
        "mensajesSinLeer": int(session.exec(query_mensajes).one() or 0),
        "prospectSinResolver": sum(
            1
            for oportunidad in oportunidades
            if oportunidad.estado == EstadoOportunidad.PROSPECT.value and oportunidad.activo
        ),
        "tareasVencidas": int(session.exec(query_eventos).one() or 0),
        "enProcesoSinMovimiento": sum(
            1
            for oportunidad in oportunidades
            if oportunidad.activo
            and oportunidad.estado
            in (
                EstadoOportunidad.ABIERTA.value,
                EstadoOportunidad.VISITA.value,
                EstadoOportunidad.COTIZA.value,
                EstadoOportunidad.RESERVA.value,
            )
            and oportunidad.fecha_estado
            and oportunidad.fecha_estado.replace(tzinfo=UTC) < stale_cutoff
        ),
    }


def filter_current_oportunidades_by_alert(
    oportunidades: Sequence[CRMOportunidad],
    alert_key: str,
    session: Session,
) -> List[CRMOportunidad]:
    if alert_key == "prospectSinResolver":
        return [
            oportunidad
            for oportunidad in oportunidades
            if oportunidad.estado == EstadoOportunidad.PROSPECT.value and oportunidad.activo
        ]

    if alert_key == "enProcesoSinMovimiento":
        stale_cutoff = datetime.now(UTC) - timedelta(days=30)
        return [
            oportunidad
            for oportunidad in oportunidades
            if oportunidad.activo
            and oportunidad.estado
            in (
                EstadoOportunidad.ABIERTA.value,
                EstadoOportunidad.VISITA.value,
                EstadoOportunidad.COTIZA.value,
                EstadoOportunidad.RESERVA.value,
            )
            and oportunidad.fecha_estado
            and oportunidad.fecha_estado.replace(tzinfo=UTC) < stale_cutoff
        ]

    oportunidad_ids = [oportunidad.id for oportunidad in oportunidades if oportunidad.id is not None]
    if not oportunidad_ids:
        return []

    if alert_key == "mensajesSinLeer":
        query = (
            select(CRMMensaje.oportunidad_id)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id.in_(oportunidad_ids))
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
        )
        matched_ids = {item for item in session.exec(query).all() if item is not None}
        return [oportunidad for oportunidad in oportunidades if oportunidad.id in matched_ids]

    if alert_key == "tareasVencidas":
        today = datetime.now(UTC).date()
        query = (
            select(CRMEvento.oportunidad_id)
            .where(CRMEvento.deleted_at.is_(None))
            .where(CRMEvento.oportunidad_id.in_(oportunidad_ids))
            .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
            .where(CRMEvento.fecha_evento.is_not(None))
            .where(func.date(CRMEvento.fecha_evento) < today)
        )
        matched_ids = {item for item in session.exec(query).all() if item is not None}
        return [oportunidad for oportunidad in oportunidades if oportunidad.id in matched_ids]

    return list(oportunidades)


def check_oportunidad_alert(
    oportunidad_id: int,
    alert_key: str,
    session: Session,
) -> bool:
    """Devuelve True si la oportunidad sigue teniendo la alerta indicada."""
    from sqlmodel import select as _select

    oportunidad = session.get(CRMOportunidad, oportunidad_id)
    if oportunidad is None or oportunidad.deleted_at is not None:
        return False

    if alert_key == "prospectSinResolver":
        return (
            oportunidad.estado == EstadoOportunidad.PROSPECT.value
            and bool(oportunidad.activo)
        )

    if alert_key == "enProcesoSinMovimiento":
        stale_cutoff = datetime.now(UTC) - timedelta(days=30)
        return (
            bool(oportunidad.activo)
            and oportunidad.estado
            in (
                EstadoOportunidad.ABIERTA.value,
                EstadoOportunidad.VISITA.value,
                EstadoOportunidad.COTIZA.value,
                EstadoOportunidad.RESERVA.value,
            )
            and oportunidad.fecha_estado is not None
            and oportunidad.fecha_estado.replace(tzinfo=UTC) < stale_cutoff
        )

    if alert_key == "mensajesSinLeer":
        count = session.exec(
            _select(func.count(CRMMensaje.id))
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
        ).one()
        return int(count or 0) > 0

    if alert_key == "tareasVencidas":
        today = datetime.now(UTC).date()
        count = session.exec(
            _select(func.count(CRMEvento.id))
            .where(CRMEvento.deleted_at.is_(None))
            .where(CRMEvento.oportunidad_id == oportunidad_id)
            .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
            .where(CRMEvento.fecha_evento.is_not(None))
            .where(func.date(CRMEvento.fecha_evento) < today)
        ).one()
        return int(count or 0) > 0

    return False


def build_dashboard_detail_entry_from_oportunidad(
    oportunidad: CRMOportunidad,
    source_key: str,
) -> dict:
    monto_estimado, monto_propiedad = _monto_estimado(oportunidad)
    fecha_cierre = (
        _parse_date(oportunidad.fecha_estado)
        if oportunidad.estado in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value)
        else None
    )
    fecha_creacion = _parse_date(oportunidad.created_at) or _parse_date(oportunidad.fecha_estado) or date.today()

    return {
        "oportunidad": oportunidad,
        "fecha_creacion": fecha_creacion.isoformat(),
        "fecha_cierre": fecha_cierre.isoformat() if fecha_cierre else None,
        "estado_al_corte": oportunidad.estado,
        "estado_cierre": oportunidad.estado
        if oportunidad.estado in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value)
        else None,
        "dias_pipeline": _diff_days(
            fecha_cierre or date.today(),
            fecha_creacion,
        ),
        "monto": float(monto_estimado) if monto_estimado else 0.0,
        "monto_propiedad": float(monto_propiedad) if monto_propiedad else 0.0,
        "moneda": oportunidad.moneda.codigo if oportunidad.moneda else None,
        "kpiKey": source_key,
        "bucket": _month_bucket(fecha_cierre or fecha_creacion),
    }


def fetch_selector_summary_fast(
    session: Session,
    start_date: str,
    end_date: str,
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
) -> Dict[str, Dict[str, float | int]]:
    """Aggregate selector counts using SQL-level grouping — no logs, no Python loops."""
    from sqlalchemy import case, cast, Float, Integer, literal

    start = _to_date(start_date)
    end = _to_date(end_date)

    proceso_states = [
        EstadoOportunidad.ABIERTA.value,
        EstadoOportunidad.VISITA.value,
        EstadoOportunidad.COTIZA.value,
    ]
    cierre_states = [EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value]

    # Map each row to a bucket via SQL CASE, then aggregate
    bucket_expr = case(
        (CRMOportunidad.estado == EstadoOportunidad.PROSPECT.value, literal("prospect")),
        (CRMOportunidad.estado.in_(proceso_states), literal("proceso")),
        (CRMOportunidad.estado == EstadoOportunidad.RESERVA.value, literal("reserva")),
        (
            CRMOportunidad.estado.in_(cierre_states)
            & CRMOportunidad.fecha_estado.is_not(None)
            & (func.date(CRMOportunidad.fecha_estado) >= start)
            & (func.date(CRMOportunidad.fecha_estado) <= end),
            literal("cerrada"),
        ),
        else_=literal("other"),
    )

    query = (
        select(
            bucket_expr.label("bucket"),
            func.count(CRMOportunidad.id).label("cnt"),
            func.coalesce(func.sum(CRMOportunidad.monto), 0).label("amt"),
        )
        .where(CRMOportunidad.deleted_at.is_(None))
        .group_by(bucket_expr)
    )
    query = _apply_oportunidad_filters(
        query,
        tipo_operacion_ids=tipo_operacion_ids,
        tipo_propiedad=tipo_propiedad,
        responsable_ids=responsable_ids,
        propietario=propietario,
        emprendimiento_ids=emprendimiento_ids,
    )

    result: Dict[str, Dict[str, float | int]] = {
        "prospect": {"count": 0, "amount": 0.0},
        "proceso": {"count": 0, "amount": 0.0},
        "reserva": {"count": 0, "amount": 0.0},
        "cerrada": {"count": 0, "amount": 0.0},
    }
    for bucket, cnt, amt in session.exec(query).all():
        if bucket in result:
            result[bucket]["count"] = int(cnt or 0)
            result[bucket]["amount"] = float(amt or 0)

    return result


def _query_raw_oportunidades_for_dashboard(
    session: Session,
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
) -> List[CRMOportunidad]:
    """Single SQL query — no date filter (date filtering is done in Python per period)."""
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
    return list(session.exec(query).all())


def _calculate_oportunidades_for_period(
    raw: List[CRMOportunidad],
    start_date: str,
    end_date: str,
) -> List[CalculatedOportunidad]:
    """Pure Python calculation for a given period — no DB access."""
    start = _to_date(start_date)
    end = _to_date(end_date)
    trailing_30_start = end - timedelta(days=29)

    calculated: List[CalculatedOportunidad] = []
    for oportunidad in raw:
        if not oportunidad.created_at:
            continue
        fecha_creacion = oportunidad.created_at.date()
        if fecha_creacion > end:
            continue

        fecha_cierre, estado_cierre = _fecha_cierre(oportunidad)
        if fecha_cierre and fecha_cierre < min(start, trailing_30_start):
            continue

        fecha_estado = _parse_date(oportunidad.fecha_estado) or fecha_creacion
        fecha_ingreso_pipeline = _fecha_ingreso_pipeline(oportunidad)

        estado_al_corte = _estado_al_corte(oportunidad, end)
        estado_inicio = _estado_al_corte(oportunidad, start - timedelta(days=1))
        monto_estimado, monto_propiedad = _monto_estimado(oportunidad)

        include_closed = fecha_cierre is not None and start <= fecha_cierre <= end
        include_open = (fecha_cierre is None or fecha_cierre > end) and fecha_creacion <= end
        if not (include_closed or include_open):
            continue

        es_pendiente = fecha_cierre is None or fecha_cierre > end
        es_pendiente_inicio = (
            fecha_ingreso_pipeline is not None
            and fecha_ingreso_pipeline < start
            and (fecha_cierre is None or fecha_cierre >= start)
            and _is_open_pipeline_state(estado_inicio)
        )
        es_prospect = es_pendiente and estado_al_corte == EstadoOportunidad.PROSPECT.value
        es_proceso = es_pendiente and estado_al_corte in OPEN_PIPELINE_STATES[:-1]
        es_reserva = es_pendiente and estado_al_corte == EstadoOportunidad.RESERVA.value
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
        es_cerrada_periodo = es_ganada_periodo or es_perdida_periodo
        es_cerrada_30d = (
            estado_cierre in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value)
            and fecha_cierre is not None
            and trailing_30_start <= fecha_cierre <= end
        )
        es_nueva_periodo = (
            fecha_ingreso_pipeline is not None
            and start <= fecha_ingreso_pipeline <= end
        )

        bucket_creacion = _month_bucket(fecha_creacion) or "Sin-fecha"
        bucket_pipeline = _month_bucket(fecha_ingreso_pipeline)
        bucket_estado = _month_bucket(fecha_estado) or "Sin-fecha"
        bucket_cierre = _month_bucket(fecha_cierre)
        fin_para_duracion = fecha_cierre if fecha_cierre and fecha_cierre <= end else end
        dias_pipeline = _diff_days(fin_para_duracion, fecha_creacion)

        calculated.append(
            CalculatedOportunidad(
                oportunidad=oportunidad,
                fecha_creacion=fecha_creacion,
                fecha_estado=fecha_estado,
                fecha_ingreso_pipeline=fecha_ingreso_pipeline,
                fecha_cierre=fecha_cierre,
                estado_al_corte=estado_al_corte,
                estado_cierre=estado_cierre,
                monto_estimado=monto_estimado,
                monto_propiedad=monto_propiedad,
                es_pendiente=es_pendiente,
                es_pendiente_inicio=es_pendiente_inicio,
                es_prospect=es_prospect,
                es_proceso=es_proceso,
                es_reserva=es_reserva,
                es_ganada_periodo=es_ganada_periodo,
                es_perdida_periodo=es_perdida_periodo,
                es_cerrada_periodo=es_cerrada_periodo,
                es_cerrada_30d=es_cerrada_30d,
                es_nueva_periodo=es_nueva_periodo,
                bucket_creacion=bucket_creacion,
                bucket_pipeline=bucket_pipeline,
                bucket_estado=bucket_estado,
                bucket_cierre=bucket_cierre,
                dias_pipeline=dias_pipeline,
            )
        )
    return calculated


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
    raw = _query_raw_oportunidades_for_dashboard(
        session=session,
        tipo_operacion_ids=tipo_operacion_ids,
        tipo_propiedad=tipo_propiedad,
        responsable_ids=responsable_ids,
        propietario=propietario,
        emprendimiento_ids=emprendimiento_ids,
    )
    return _calculate_oportunidades_for_period(raw, start_date, end_date)


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


def _variation(current: int, base: int) -> float:
    if base == 0:
        return 0.0
    return round(((current - base) / base) * 100, 1)


def build_crm_dashboard_payload(
    items: List[CalculatedOportunidad],
    start_date: str,
    end_date: str,
    limit_top: int = 5,
    filters: Optional[dict] = None,
    session: Optional[Session] = None,
    current_oportunidades: Optional[Sequence[CRMOportunidad]] = None,
) -> dict:
    end = _to_date(end_date)

    pendientes_anteriores = [item for item in items if item.es_pendiente_inicio]
    en_proceso = [item for item in items if item.es_proceso]
    cerradas = [item for item in items if item.es_cerrada_periodo]
    ganadas = [item for item in items if item.es_ganada_periodo]
    perdidas = [item for item in items if item.es_perdida_periodo]
    nuevas = [item for item in items if item.es_nueva_periodo]
    prospect = [item for item in items if item.es_prospect]
    proceso = [item for item in items if item.es_proceso]
    reserva = [item for item in items if item.es_reserva]
    pendientes_fin = len(proceso) + len(reserva)

    total_count = max(len(prospect) + len(proceso) + len(reserva), 1)

    kpis = {
        "prospect": _kpi_summary(prospect),
        "proceso": _kpi_summary(proceso),
        "reserva": _kpi_summary(reserva),
        "cerrada": _kpi_summary(cerradas),
    }
    kpis["cerrada"]["ganadas"] = {
        "count": len(ganadas),
        "rate": _conversion(len(ganadas), total_count),
    }
    kpis["cerrada"]["perdidas"] = {
        "count": len(perdidas),
        "rate": _conversion(len(perdidas), total_count),
    }
    period_summary = {
        "nuevas": len(nuevas),
        "ganadas": len(ganadas),
        "perdidas": len(perdidas),
        "cerradas": len(cerradas),
        "pendientes_inicio": len(pendientes_anteriores),
        "pendientes_fin": pendientes_fin,
        "total_periodo": len(pendientes_anteriores) + len(nuevas),
    }
    current_items = list(current_oportunidades or [])
    funnel = build_current_funnel(items)

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
        return (
            item.fecha_ingreso_pipeline is not None
            and start_m <= item.fecha_ingreso_pipeline <= end_m
        )

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

    def _carryover_before(item: CalculatedOportunidad, cut: date) -> bool:
        fecha_ingreso_pipeline = item.fecha_ingreso_pipeline
        if fecha_ingreso_pipeline is None or fecha_ingreso_pipeline >= cut:
            return False
        return _is_open_pipeline_at(item, cut - timedelta(days=1))

    evolucion: list[dict[str, object]] = []
    for month_start, month_end in months:
        total_count = sum(1 for item in items if _is_open_pipeline_at(item, month_end))
        nuevas_count = sum(1 for item in items if _belongs_new(item, month_start, month_end))
        ganadas_count = sum(1 for item in items if _belongs_ganada(item, month_start, month_end))
        perdidas_count = sum(1 for item in items if _belongs_perdida(item, month_start, month_end))
        pendientes_mes = sum(1 for item in items if _carryover_before(item, month_start))
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

    def _ranking(data: List[CalculatedOportunidad], bucket_attr: str = "bucket_creacion") -> List[dict]:
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
                    "bucket": getattr(item, bucket_attr) or item.bucket_creacion,
                    "kpiKey": "pendientes",
                }
            )
        return ranking

    ranking = {
        "prospect": [
            {**entry, "kpiKey": "prospect"}
            for entry in _ranking(prospect)
        ],
        "proceso": [
            {**entry, "kpiKey": "proceso"}
            for entry in _ranking(proceso)
        ],
        "reserva": [
            {**entry, "kpiKey": "reserva"}
            for entry in _ranking(reserva)
        ],
        "cerrada": [
            {**entry, "kpiKey": "cerrada"}
            for entry in _ranking(cerradas)
        ],
    }

    stats = {
        "sinMonto": sum(1 for item in items if item.monto_estimado is None),
        "sinPropiedad": sum(1 for item in items if item.oportunidad.propiedad is None),
    }
    alerts = build_current_dashboard_alerts(current_items, session)

    # Ranking de propiedades disponibles
    propiedades_disponibles: Dict[int, dict] = {}

    def _is_propiedad_disponible(prop: Propiedad) -> bool:
        if not prop or not prop.propiedad_status:
            return False
        nombre = (prop.propiedad_status.nombre or "").lower()
        return "disponible" in nombre

    # Si hay sesión disponible, consultar TODAS las propiedades disponibles
    if session:
        all_props_disponibles = session.exec(
            select(Propiedad)
            .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
            .where(func.lower(PropiedadesStatus.nombre).contains("disponible"))
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
            if not prop or not _is_propiedad_disponible(prop):
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
        "period_summary": period_summary,
        "funnel": funnel,
        "evolucion": evolucion,
        "ranking": ranking,
        "stats": stats,
        "alerts": alerts,
        "ranking_propiedades": ranking_propiedades,
    }


# ---------------------------------------------------------------------------
# SQL-paged detail fetch
# ---------------------------------------------------------------------------

def fetch_current_oportunidades_for_detail(
    session: Session,
    kpi_key: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
    order_by: str = "estado",
    order_dir: str = "asc",
    page: int = 1,
    per_page: int = 25,
) -> Tuple[List[CRMOportunidad], int]:
    """Returns (paged_oportunidades, total_count) with estado filtering and pagination in SQL."""
    proceso_states = [
        EstadoOportunidad.ABIERTA.value,
        EstadoOportunidad.VISITA.value,
        EstadoOportunidad.COTIZA.value,
    ]

    def _apply_kpi(q):
        if kpi_key == "prospect":
            return q.where(CRMOportunidad.estado == EstadoOportunidad.PROSPECT.value)
        if kpi_key == "proceso":
            return q.where(CRMOportunidad.estado.in_(proceso_states))
        if kpi_key == "reserva":
            return q.where(CRMOportunidad.estado == EstadoOportunidad.RESERVA.value)
        if kpi_key == "cerrada":
            q = q.where(
                CRMOportunidad.estado.in_(
                    [EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value]
                )
            )
            if start_date and end_date:
                start = _to_date(start_date)
                end = _to_date(end_date)
                q = q.where(CRMOportunidad.fecha_estado.is_not(None))
                q = q.where(func.date(CRMOportunidad.fecha_estado) >= start)
                q = q.where(func.date(CRMOportunidad.fecha_estado) <= end)
            return q
        return q

    # COUNT query (no selectinload, just filters)
    count_q = select(func.count(CRMOportunidad.id)).where(CRMOportunidad.deleted_at.is_(None))
    count_q = _apply_kpi(count_q)
    count_q = _apply_oportunidad_filters(
        count_q,
        tipo_operacion_ids=tipo_operacion_ids,
        tipo_propiedad=tipo_propiedad,
        responsable_ids=responsable_ids,
        propietario=propietario,
        emprendimiento_ids=emprendimiento_ids,
    )
    total = int(session.exec(count_q).one() or 0)

    # DATA query with eager loads
    data_q = (
        select(CRMOportunidad)
        .where(CRMOportunidad.deleted_at.is_(None))
        .options(
            selectinload(CRMOportunidad.propiedad),
            selectinload(CRMOportunidad.tipo_operacion),
            selectinload(CRMOportunidad.contacto),
            selectinload(CRMOportunidad.responsable),
            selectinload(CRMOportunidad.moneda),
        )
    )
    data_q = _apply_kpi(data_q)
    data_q = _apply_oportunidad_filters(
        data_q,
        tipo_operacion_ids=tipo_operacion_ids,
        tipo_propiedad=tipo_propiedad,
        responsable_ids=responsable_ids,
        propietario=propietario,
        emprendimiento_ids=emprendimiento_ids,
    )

    col_map = {
        "estado": CRMOportunidad.estado,
        "monto": CRMOportunidad.monto,
        "created_at": CRMOportunidad.created_at,
        "fecha_cierre": CRMOportunidad.fecha_estado,
        "probabilidad": CRMOportunidad.probabilidad,
    }
    col = col_map.get(order_by, CRMOportunidad.estado)
    if order_dir == "desc":
        data_q = data_q.order_by(col.desc(), CRMOportunidad.id.desc())
    else:
        data_q = data_q.order_by(col.asc(), CRMOportunidad.id.asc())

    data_q = data_q.offset((page - 1) * per_page).limit(per_page)
    return list(session.exec(data_q).all()), total


# ---------------------------------------------------------------------------
# Bundle: several periods in a single request
# ---------------------------------------------------------------------------

def _shift_dates(start_date: str, end_date: str, period_type: str, steps: int) -> Tuple[str, str]:
    """Shift date range by N periods (mirrors frontend shiftDashboardFilters)."""
    period_months: dict[str, int] = {
        "mes": 1, "trimestre": 3, "cuatrimestre": 4, "semestre": 6, "anio": 12,
    }
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()

    if period_type == "personalizado":
        diff_days = (end - start).days + 1
        offset = diff_days * steps
        return (
            (start + timedelta(days=offset)).isoformat(),
            (end + timedelta(days=offset)).isoformat(),
        )

    months = period_months.get(period_type, 1) * steps

    def _shift_month(d: date, m: int) -> date:
        month = d.month - 1 + m
        year = d.year + month // 12
        month = month % 12 + 1
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(d.day, last_day))

    return _shift_month(start, months).isoformat(), _shift_month(end, months).isoformat()


def _format_trend_label(start_date: str, period_type: str) -> str:
    """Mirrors frontend formatTrendLabel."""
    d = datetime.strptime(start_date, "%Y-%m-%d").date()
    year_short = str(d.year)[-2:]
    month = d.month
    if period_type == "mes":
        return f"{month:02d}/{year_short}"
    if period_type == "trimestre":
        return f"T{(month - 1) // 3 + 1} {year_short}"
    if period_type == "cuatrimestre":
        return f"C{(month - 1) // 4 + 1} {year_short}"
    if period_type == "semestre":
        return f"S{(month - 1) // 6 + 1} {year_short}"
    if period_type == "anio":
        return str(d.year)
    return start_date


def _apply_ranking_filtrar(payload: dict) -> None:
    """Strip sensitive/internal fields from oportunidad objects inside a payload (in-place)."""
    from app.models.base import filtrar_respuesta
    for entries in payload.get("ranking", {}).values():
        for entry in entries:
            entry["oportunidad"] = filtrar_respuesta(entry["oportunidad"])
    for entry in payload.get("ranking_propiedades", []):
        entry["propiedad"] = filtrar_respuesta(entry["propiedad"])


def _build_period_payload(
    session: Session,
    start_date: str,
    end_date: str,
    tipo_operacion_ids,
    tipo_propiedad,
    responsable_ids,
    propietario,
    emprendimiento_ids,
    limit_top: int,
    filters_ctx: Optional[dict],
) -> dict:
    items = fetch_oportunidades_for_dashboard(
        session=session,
        start_date=start_date,
        end_date=end_date,
        tipo_operacion_ids=tipo_operacion_ids,
        tipo_propiedad=tipo_propiedad,
        responsable_ids=responsable_ids,
        propietario=propietario,
        emprendimiento_ids=emprendimiento_ids,
    )
    current_oportunidades = [item.oportunidad for item in items if item.es_pendiente or item.es_cerrada_30d]
    payload = build_crm_dashboard_payload(
        items,
        start_date=start_date,
        end_date=end_date,
        limit_top=limit_top,
        filters=filters_ctx,
        session=session,
        current_oportunidades=current_oportunidades,
    )
    _apply_ranking_filtrar(payload)
    return payload


def build_crm_dashboard_bundle(
    session: Session,
    start_date: str,
    end_date: str,
    period_type: str,
    trend_steps: List[int],
    previous_step: int = -1,
    tipo_operacion_ids: Optional[Sequence[int]] = None,
    tipo_propiedad: Optional[Sequence[str]] = None,
    responsable_ids: Optional[Sequence[int]] = None,
    propietario: Optional[str] = None,
    emprendimiento_ids: Optional[Sequence[int]] = None,
    limit_top: int = 5,
    filters_ctx: Optional[dict] = None,
) -> dict:
    """Returns {current, previous, trend} using a single SQL query."""
    # ONE SQL query — all period calculations reuse this in-memory data
    raw = _query_raw_oportunidades_for_dashboard(
        session=session,
        tipo_operacion_ids=tipo_operacion_ids,
        tipo_propiedad=tipo_propiedad,
        responsable_ids=responsable_ids,
        propietario=propietario,
        emprendimiento_ids=emprendimiento_ids,
    )

    def _build_from_raw(s: str, e: str) -> dict:
        items = _calculate_oportunidades_for_period(raw, s, e)
        current_ops = [item.oportunidad for item in items if item.es_pendiente or item.es_cerrada_30d]
        payload = build_crm_dashboard_payload(
            items,
            start_date=s,
            end_date=e,
            limit_top=limit_top,
            filters=filters_ctx,
            session=session,
            current_oportunidades=current_ops,
        )
        _apply_ranking_filtrar(payload)
        return payload

    current_data = _build_from_raw(start_date, end_date)

    prev_start, prev_end = _shift_dates(start_date, end_date, period_type, previous_step)
    previous_data = _build_from_raw(prev_start, prev_end)

    trend: List[dict] = []
    for step in trend_steps:
        t_start, t_end = _shift_dates(start_date, end_date, period_type, step)
        t_items = _calculate_oportunidades_for_period(raw, t_start, t_end)
        ganadas = sum(1 for item in t_items if item.es_ganada_periodo)
        nuevas = sum(1 for item in t_items if item.es_nueva_periodo)
        pendientes_fin = sum(1 for item in t_items if item.es_proceso or item.es_reserva)
        trend.append({
            "label": _format_trend_label(t_start, period_type),
            "total": pendientes_fin,
            "nuevas": nuevas,
            "ganadas": ganadas,
        })

    return {"current": current_data, "previous": previous_data, "trend": trend}
