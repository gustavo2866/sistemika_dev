from typing import List, Optional

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models.base import filtrar_respuesta
from app.models.crm import CRMEvento, CRMMensaje, CRMOportunidad
from app.models.enums import EstadoEvento, EstadoMensaje, EstadoOportunidad, TipoMensaje
from app.services.crm_dashboard import (
    build_crm_dashboard_payload,
    fetch_oportunidades_for_dashboard,
)

router = APIRouter(prefix="/api/dashboard/crm", tags=["dashboard-crm"])


def _parse_int_list(value: Optional[str]) -> Optional[List[int]]:
    if not value:
        return None
    result: List[int] = []
    for chunk in value.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            result.append(int(chunk))
        except ValueError:
            continue
    return result or None


def _parse_str_list(value: Optional[str]) -> Optional[List[str]]:
    if not value:
        return None
    result = [chunk.strip() for chunk in value.split(",") if chunk.strip()]
    return result or None


@router.get("")
def get_crm_dashboard(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    tipoOperacion: Optional[str] = Query(None, description="IDs separados por coma"),
    tipoPropiedad: Optional[str] = Query(None, description="Tipos de propiedad separados por coma"),
    responsable: Optional[str] = Query(None, description="IDs de responsables separados por coma"),
    emprendimiento: Optional[str] = Query(None, description="IDs de emprendimiento"),
    propietario: Optional[str] = Query(None, description="Filtro contains por propietario"),
    limitTop: int = Query(5, ge=1, le=20),
    session: Session = Depends(get_session),
):
    try:
        items = fetch_oportunidades_for_dashboard(
            session=session,
            start_date=startDate,
            end_date=endDate,
            tipo_operacion_ids=_parse_int_list(tipoOperacion),
            tipo_propiedad=_parse_str_list(tipoPropiedad),
            responsable_ids=_parse_int_list(responsable),
            propietario=propietario,
            emprendimiento_ids=_parse_int_list(emprendimiento),
        )
        payload = build_crm_dashboard_payload(
            items,
            start_date=startDate,
            end_date=endDate,
            limit_top=limitTop,
            filters={
                "tipoOperacion": _parse_int_list(tipoOperacion),
                "tipoPropiedad": _parse_str_list(tipoPropiedad),
                "responsable": _parse_int_list(responsable),
                "emprendimiento": _parse_int_list(emprendimiento),
                "propietario": propietario,
            },
            session=session,
        )

        ranking = payload.get("ranking", {})
        for entries in ranking.values():
            for entry in entries:
                entry["oportunidad"] = filtrar_respuesta(entry["oportunidad"])

        for entry in payload.get("ranking_propiedades", []):
            entry["propiedad"] = filtrar_respuesta(entry["propiedad"])

        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/detalle")
def get_crm_dashboard_detalle(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    tipoOperacion: Optional[str] = Query(None),
    tipoPropiedad: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    emprendimiento: Optional[str] = Query(None),
    propietario: Optional[str] = Query(None),
    kpiKey: str = Query("pendientes", pattern="^(pendientes|nuevas|cerradas|en_proceso)$"),
    alertKey: Optional[str] = Query(
        None,
        pattern="^(mensajesSinLeer|prospectSinResolver|tareasVencidas|enProcesoSinMovimiento)$",
    ),
    stage: Optional[str] = Query(None, description="Filtro de estado al corte"),
    bucket: Optional[str] = Query(None, description="Bucket YYYY-MM"),
    orderBy: str = Query("monto", pattern="^(monto|created_at|fecha_cierre|probabilidad)$"),
    orderDir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    items = fetch_oportunidades_for_dashboard(
        session=session,
        start_date=startDate,
        end_date=endDate,
        tipo_operacion_ids=_parse_int_list(tipoOperacion),
        tipo_propiedad=_parse_str_list(tipoPropiedad),
        responsable_ids=_parse_int_list(responsable),
        propietario=propietario,
        emprendimiento_ids=_parse_int_list(emprendimiento),
    )

    def _filter_by_kpi(data):
        if kpiKey == "pendientes":
            return [item for item in data if item.es_pendiente_inicio]
        if kpiKey == "nuevas":
            return [item for item in data if item.es_nueva_periodo]
        if kpiKey == "cerradas":
            return [item for item in data if item.es_cerrada_periodo]
        if kpiKey == "en_proceso":
            return [
                item
                for item in data
                if item.es_pendiente and item.estado_al_corte != "0-prospect"
            ]
        return data

    def _filter_by_alert(data):
        if not alertKey:
            return data
        if alertKey == "prospectSinResolver":
            return [
                item
                for item in data
                if item.oportunidad.estado == EstadoOportunidad.PROSPECT.value
                and item.oportunidad.activo
            ]
        if alertKey == "enProcesoSinMovimiento":
            stale_cutoff = datetime.now(UTC) - timedelta(days=30)
            return [
                item
                for item in data
                if item.oportunidad.activo
                and item.oportunidad.estado
                not in (
                    EstadoOportunidad.PROSPECT.value,
                    EstadoOportunidad.GANADA.value,
                    EstadoOportunidad.PERDIDA.value,
                )
                and item.oportunidad.fecha_estado
                and item.oportunidad.fecha_estado < stale_cutoff
            ]

        data_ids = [item.oportunidad.id for item in data if item.oportunidad.id is not None]
        if not data_ids:
            return []

        if alertKey == "mensajesSinLeer":
            query = (
                select(CRMMensaje.oportunidad_id)
                .where(CRMMensaje.deleted_at.is_(None))
                .where(CRMMensaje.oportunidad_id.in_(data_ids))
                .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
                .where(CRMMensaje.estado == EstadoMensaje.NUEVO.value)
            )
            matched_ids = set(session.exec(query).all())
            return [item for item in data if item.oportunidad.id in matched_ids]

        if alertKey == "tareasVencidas":
            query = (
                select(CRMEvento.oportunidad_id)
                .where(CRMEvento.deleted_at.is_(None))
                .where(CRMEvento.oportunidad_id.in_(data_ids))
                .where(CRMEvento.estado_evento == EstadoEvento.PENDIENTE.value)
                .where(CRMEvento.fecha_evento.is_not(None))
                .where(CRMEvento.fecha_evento < datetime.now(UTC))
            )
            matched_ids = set(session.exec(query).all())
            return [item for item in data if item.oportunidad.id in matched_ids]

        return data

    filtered = _filter_by_alert(items) if alertKey else _filter_by_kpi(items)

    if stage:
        filtered = [item for item in filtered if item.estado_al_corte == stage]

    if bucket:
        if kpiKey == "cerradas":
            filtered = [
                item for item in filtered if item.bucket_cierre == bucket or item.bucket_creacion == bucket
            ]
        elif kpiKey == "nuevas":
            filtered = [item for item in filtered if item.bucket_pipeline == bucket]
        else:
            filtered = [item for item in filtered if item.bucket_creacion == bucket]

    reverse = orderDir == "desc"
    order_map = {
        "monto": lambda item: item.monto_estimado or Decimal("0"),
        "created_at": lambda item: item.fecha_creacion,
        "fecha_cierre": lambda item: item.fecha_cierre or date.min,
        "probabilidad": lambda item: item.oportunidad.probabilidad or 0,
    }

    sort_key = order_map.get(orderBy, order_map["monto"])
    filtered = sorted(filtered, key=sort_key, reverse=reverse)

    total = len(filtered)
    start_index = (page - 1) * perPage
    end_index = start_index + perPage

    paged = filtered[start_index:end_index]
    data = []
    for item in paged:
        data.append(
            {
                "oportunidad": filtrar_respuesta(item.oportunidad),
                "fecha_creacion": item.fecha_creacion.isoformat(),
                "fecha_cierre": item.fecha_cierre.isoformat() if item.fecha_cierre else None,
                "estado_al_corte": item.estado_al_corte,
                "estado_cierre": item.estado_cierre,
                "dias_pipeline": item.dias_pipeline,
                "monto": float(item.monto_estimado) if item.monto_estimado else 0.0,
                "monto_propiedad": float(item.monto_propiedad) if item.monto_propiedad else 0.0,
                "moneda": item.oportunidad.moneda.codigo if item.oportunidad.moneda else None,
                "kpiKey": kpiKey,
                "bucket": (
                    item.bucket_cierre
                    if kpiKey == "cerradas"
                    else item.bucket_pipeline
                    if kpiKey == "nuevas"
                    else item.bucket_creacion
                ),
            }
        )

    return {
        "data": data,
        "total": total,
        "page": page,
        "perPage": perPage,
    }
