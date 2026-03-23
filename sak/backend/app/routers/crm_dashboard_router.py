from typing import List, Optional

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.models.base import filtrar_respuesta
from app.models.crm import CRMOportunidad
from app.models.enums import EstadoOportunidad
from app.services.crm_dashboard import (
    build_dashboard_detail_entry_from_oportunidad,
    build_crm_dashboard_payload,
    build_crm_dashboard_bundle,
    check_oportunidad_alert,
    fetch_current_oportunidades_for_dashboard,
    fetch_current_oportunidades_for_detail,
    fetch_oportunidades_for_dashboard,
    fetch_selector_summary_fast,
    filter_current_oportunidades_by_alert,
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
        # Derive current oportunidades from items already loaded (avoids second DB query).
        # Current = all still-open (pending) or closed within the last 30 days.
        current_oportunidades = [
            item.oportunidad for item in items if item.es_pendiente or item.es_cerrada_30d
        ]
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
            current_oportunidades=current_oportunidades,
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


@router.get("/detalle-alerta")
def get_crm_dashboard_alert_detail(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    tipoOperacion: Optional[str] = Query(None),
    tipoPropiedad: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    emprendimiento: Optional[str] = Query(None),
    propietario: Optional[str] = Query(None),
    alertKey: str = Query(
        ...,
        pattern="^(mensajesSinLeer|prospectSinResolver|tareasVencidas|enProcesoSinMovimiento)$",
    ),
    orderBy: str = Query("estado", pattern="^(estado|monto|created_at|fecha_estado|probabilidad)$"),
    orderDir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    oportunidades = fetch_current_oportunidades_for_dashboard(
        session=session,
        start_date=startDate,
        end_date=endDate,
        tipo_operacion_ids=_parse_int_list(tipoOperacion),
        tipo_propiedad=_parse_str_list(tipoPropiedad),
        responsable_ids=_parse_int_list(responsable),
        propietario=propietario,
        emprendimiento_ids=_parse_int_list(emprendimiento),
    )

    filtered = filter_current_oportunidades_by_alert(
        oportunidades=oportunidades,
        alert_key=alertKey,
        session=session,
    )

    reverse = orderDir == "desc"
    order_map = {
        "estado": lambda oportunidad: (oportunidad.estado or "", oportunidad.id or 0),
        "monto": lambda oportunidad: oportunidad.monto or Decimal("0"),
        "created_at": lambda oportunidad: oportunidad.created_at or datetime.min.replace(tzinfo=UTC),
        "fecha_estado": lambda oportunidad: oportunidad.fecha_estado or datetime.min.replace(tzinfo=UTC),
        "probabilidad": lambda oportunidad: oportunidad.probabilidad or 0,
    }

    sort_key = order_map.get(orderBy, order_map["estado"])
    filtered = sorted(filtered, key=sort_key, reverse=reverse)

    total = len(filtered)
    start_index = (page - 1) * perPage
    end_index = start_index + perPage
    paged = filtered[start_index:end_index]

    data = [
        build_dashboard_detail_entry_from_oportunidad(oportunidad, alertKey)
        for oportunidad in paged
    ]

    for entry in data:
        entry["oportunidad"] = filtrar_respuesta(entry["oportunidad"])

    return {
        "data": data,
        "total": total,
        "page": page,
        "perPage": perPage,
    }


@router.get("/detalle")
def get_crm_dashboard_detalle(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    tipoOperacion: Optional[str] = Query(None),
    tipoPropiedad: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    emprendimiento: Optional[str] = Query(None),
    propietario: Optional[str] = Query(None),
    kpiKey: str = Query("proceso", pattern="^(prospect|proceso|reserva|cerrada)$"),
    alertKey: Optional[str] = Query(
        None,
        pattern="^(mensajesSinLeer|prospectSinResolver|tareasVencidas|enProcesoSinMovimiento)$",
    ),
    stage: Optional[str] = Query(None, description="Filtro de estado al corte"),
    bucket: Optional[str] = Query(None, description="Bucket YYYY-MM"),
    orderBy: str = Query("estado", pattern="^(estado|monto|created_at|fecha_cierre|probabilidad)$"),
    orderDir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    # When secondary filters (stage/bucket) or alertKey are active we must load
    # all matching rows to post-filter, then page in Python.  In the common case
    # (no secondary filters) we push everything to SQL.
    if alertKey or stage or bucket:
        oportunidades = fetch_current_oportunidades_for_dashboard(
            session=session,
            start_date=startDate,
            end_date=endDate,
            tipo_operacion_ids=_parse_int_list(tipoOperacion),
            tipo_propiedad=_parse_str_list(tipoPropiedad),
            responsable_ids=_parse_int_list(responsable),
            propietario=propietario,
            emprendimiento_ids=_parse_int_list(emprendimiento),
        )

        start = date.fromisoformat(startDate)
        end = date.fromisoformat(endDate)
        proceso_states = {
            EstadoOportunidad.ABIERTA.value,
            EstadoOportunidad.VISITA.value,
            EstadoOportunidad.COTIZA.value,
        }

        def _filter_by_kpi(data: list[CRMOportunidad]) -> list[CRMOportunidad]:
            if kpiKey == "prospect":
                return [op for op in data if op.estado == EstadoOportunidad.PROSPECT.value]
            if kpiKey == "proceso":
                return [op for op in data if op.estado in proceso_states]
            if kpiKey == "reserva":
                return [op for op in data if op.estado == EstadoOportunidad.RESERVA.value]
            if kpiKey == "cerrada":
                return [
                    op for op in data
                    if op.estado in (EstadoOportunidad.GANADA.value, EstadoOportunidad.PERDIDA.value)
                    and op.fecha_estado is not None
                    and start <= op.fecha_estado.date() <= end
                ]
            return data

        filtered = (
            filter_current_oportunidades_by_alert(oportunidades, alertKey, session)
            if alertKey
            else _filter_by_kpi(oportunidades)
        )
        entries = [
            build_dashboard_detail_entry_from_oportunidad(op, alertKey or kpiKey)
            for op in filtered
        ]

        if stage:
            entries = [item for item in entries if item["estado_al_corte"] == stage]
        if bucket:
            entries = [item for item in entries if item["bucket"] == bucket]

        reverse = orderDir == "desc"
        order_map = {
            "estado": lambda item: (item["estado_al_corte"] or "", item["oportunidad"].id or 0),
            "monto": lambda item: item["monto"] or 0.0,
            "created_at": lambda item: item["fecha_creacion"],
            "fecha_cierre": lambda item: item["fecha_cierre"] or "",
            "probabilidad": lambda item: item["oportunidad"].probabilidad or 0,
        }
        entries = sorted(entries, key=order_map.get(orderBy, order_map["monto"]), reverse=reverse)

        total_count = len(entries)
        start_index = (page - 1) * perPage
        paged = entries[start_index: start_index + perPage]
        data = [{**item, "oportunidad": filtrar_respuesta(item["oportunidad"])} for item in paged]
        return {"data": data, "total": total_count, "page": page, "perPage": perPage}

    # Fast path: all filtering and pagination done in SQL
    oportunidades_paged, total_count = fetch_current_oportunidades_for_detail(
        session=session,
        kpi_key=kpiKey,
        start_date=startDate,
        end_date=endDate,
        tipo_operacion_ids=_parse_int_list(tipoOperacion),
        tipo_propiedad=_parse_str_list(tipoPropiedad),
        responsable_ids=_parse_int_list(responsable),
        propietario=propietario,
        emprendimiento_ids=_parse_int_list(emprendimiento),
        order_by=orderBy,
        order_dir=orderDir,
        page=page,
        per_page=perPage,
    )
    data = [
        {
            **build_dashboard_detail_entry_from_oportunidad(op, kpiKey),
            "oportunidad": filtrar_respuesta(op),
        }
        for op in oportunidades_paged
    ]
    return {"data": data, "total": total_count, "page": page, "perPage": perPage}


@router.get("/selectors")
def get_crm_dashboard_selectors(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    tipoOperacion: Optional[str] = Query(None),
    tipoPropiedad: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    emprendimiento: Optional[str] = Query(None),
    propietario: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    """Conteo rápido por estado sin cargar logs ni relaciones."""
    try:
        return fetch_selector_summary_fast(
            session=session,
            start_date=startDate,
            end_date=endDate,
            tipo_operacion_ids=_parse_int_list(tipoOperacion),
            tipo_propiedad=_parse_str_list(tipoPropiedad),
            responsable_ids=_parse_int_list(responsable),
            propietario=propietario,
            emprendimiento_ids=_parse_int_list(emprendimiento),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/bundle")
def get_crm_dashboard_bundle(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD periodo actual"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD periodo actual"),
    tipoOperacion: Optional[str] = Query(None),
    tipoPropiedad: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    emprendimiento: Optional[str] = Query(None),
    propietario: Optional[str] = Query(None),
    limitTop: int = Query(5, ge=1, le=20),
    periodType: str = Query("trimestre"),
    trendSteps: str = Query("-3,-2,-1,0", description="Pasos de trend separados por coma"),
    previousStep: int = Query(-1, description="Paso para el periodo anterior"),
    session: Session = Depends(get_session),
):
    """Devuelve current + previous + trend en un solo request."""
    def _parse_steps(raw: str) -> List[int]:
        result: List[int] = []
        for chunk in raw.split(","):
            chunk = chunk.strip()
            try:
                result.append(int(chunk))
            except ValueError:
                continue
        return result

    try:
        payload = build_crm_dashboard_bundle(
            session=session,
            start_date=startDate,
            end_date=endDate,
            period_type=periodType,
            trend_steps=_parse_steps(trendSteps),
            previous_step=previousStep,
            tipo_operacion_ids=_parse_int_list(tipoOperacion),
            tipo_propiedad=_parse_str_list(tipoPropiedad),
            responsable_ids=_parse_int_list(responsable),
            propietario=propietario,
            emprendimiento_ids=_parse_int_list(emprendimiento),
            limit_top=limitTop,
            filters_ctx={
                "tipoOperacion": _parse_int_list(tipoOperacion),
                "tipoPropiedad": _parse_str_list(tipoPropiedad),
                "responsable": _parse_int_list(responsable),
                "emprendimiento": _parse_int_list(emprendimiento),
                "propietario": propietario,
            },
        )
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/alerta-item")
def get_crm_dashboard_alerta_item(
    id: int = Query(..., description="ID de la oportunidad"),
    alertKey: str = Query(
        ...,
        pattern="^(mensajesSinLeer|prospectSinResolver|tareasVencidas|enProcesoSinMovimiento)$",
    ),
    session: Session = Depends(get_session),
):
    """Indica si una oportunidad concreta sigue teniendo activa la alerta indicada."""
    try:
        tiene_alerta = check_oportunidad_alert(
            oportunidad_id=id,
            alert_key=alertKey,
            session=session,
        )
        return {"id": id, "alertKey": alertKey, "hasAlert": tiene_alerta}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc
