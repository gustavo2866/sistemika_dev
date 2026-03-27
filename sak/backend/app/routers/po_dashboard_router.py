from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.models.base import filtrar_respuesta
from app.services.po_dashboard import (
    build_po_dashboard_bundle,
    build_po_dashboard_payload,
    check_po_alert,
    fetch_po_orders_for_dashboard,
    fetch_po_selector_summary_fast,
    filter_po_dashboard_items_by_alert,
    filter_po_dashboard_items_by_kpi,
)

router = APIRouter(prefix="/api/dashboard/po", tags=["dashboard-po"])


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
    result: List[str] = []
    for chunk in value.split(","):
        chunk = chunk.strip()
        if chunk:
            result.append(chunk)
    return result or None


def _serialize_item(item) -> dict:
    return {
        "order": filtrar_respuesta(item.order),
        "fecha_creacion": item.fecha_creacion.isoformat(),
        "fecha_estado": item.fecha_estado.isoformat(),
        "dias_abierta": item.dias_abierta,
        "monto": float(item.monto_total),
        "bucket": item.bucket_creacion,
        "estado": item.estado,
    }


@router.get("")
def get_po_dashboard(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    solicitante: Optional[str] = Query(None, description="IDs de solicitante separados por coma"),
    proveedor: Optional[str] = Query(None, description="IDs de proveedor separados por coma"),
    tipoSolicitud: Optional[str] = Query(None, description="IDs de tipo de solicitud separados por coma"),
    departamento: Optional[str] = Query(None, description="IDs de departamento separados por coma"),
    tipoCompra: Optional[str] = Query(None, description="Tipos de orden separados por coma"),
    limitTop: int = Query(8, ge=1, le=20),
    session: Session = Depends(get_session),
):
    try:
        items = fetch_po_orders_for_dashboard(
            session=session,
            start_date=startDate,
            end_date=endDate,
            solicitante_ids=_parse_int_list(solicitante),
            proveedor_ids=_parse_int_list(proveedor),
            tipo_solicitud_ids=_parse_int_list(tipoSolicitud),
            departamento_ids=_parse_int_list(departamento),
            tipo_compra_values=_parse_str_list(tipoCompra),
        )
        return build_po_dashboard_payload(
            items,
            start_date=startDate,
            end_date=endDate,
            limit_top=limitTop,
            filters={
                "solicitante": _parse_int_list(solicitante),
                "proveedor": _parse_int_list(proveedor),
                "tipoSolicitud": _parse_int_list(tipoSolicitud),
                "departamento": _parse_int_list(departamento),
                "tipoCompra": _parse_str_list(tipoCompra),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/detalle-alerta")
def get_po_dashboard_detalle_alerta(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    solicitante: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    tipoSolicitud: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    tipoCompra: Optional[str] = Query(None),
    alertKey: str = Query(
        ...,
        pattern="^(rechazadas|solicitudes_vencidas|emitidas_vencidas)$",
    ),
    orderBy: str = Query("created_at", pattern="^(created_at|updated_at|total|dias)$"),
    orderDir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    items = fetch_po_orders_for_dashboard(
        session=session,
        start_date=startDate,
        end_date=endDate,
        solicitante_ids=_parse_int_list(solicitante),
        proveedor_ids=_parse_int_list(proveedor),
        tipo_solicitud_ids=_parse_int_list(tipoSolicitud),
        departamento_ids=_parse_int_list(departamento),
        tipo_compra_values=_parse_str_list(tipoCompra),
    )

    filtered = filter_po_dashboard_items_by_alert(items, alertKey)

    reverse = orderDir == "desc"
    order_map = {
        "created_at": lambda item: item.fecha_creacion,
        "updated_at": lambda item: item.fecha_estado,
        "total": lambda item: item.monto_total or Decimal("0"),
        "dias": lambda item: item.dias_abierta,
    }
    sort_key = order_map.get(orderBy, order_map["created_at"])
    filtered = sorted(filtered, key=sort_key, reverse=reverse)

    total = len(filtered)
    start_index = (page - 1) * perPage
    end_index = start_index + perPage
    paged = filtered[start_index:end_index]

    return {
        "data": [_serialize_item(item) for item in paged],
        "total": total,
        "page": page,
        "perPage": perPage,
    }


@router.get("/detalle")
def get_po_dashboard_detalle(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    solicitante: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    tipoSolicitud: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    tipoCompra: Optional[str] = Query(None),
    kpiKey: str = Query(
        "pendientes",
        pattern="^(pendientes|solicitadas|emitidas|en_proceso|facturadas)$",
    ),
    alertKey: Optional[str] = Query(
        None,
        pattern="^(rechazadas|solicitudes_vencidas|emitidas_vencidas)$",
    ),
    bucket: Optional[str] = Query(None, description="Bucket YYYY-MM"),
    orderBy: str = Query("created_at", pattern="^(created_at|updated_at|total|dias)$"),
    orderDir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    items = fetch_po_orders_for_dashboard(
        session=session,
        start_date=startDate,
        end_date=endDate,
        solicitante_ids=_parse_int_list(solicitante),
        proveedor_ids=_parse_int_list(proveedor),
        tipo_solicitud_ids=_parse_int_list(tipoSolicitud),
        departamento_ids=_parse_int_list(departamento),
        tipo_compra_values=_parse_str_list(tipoCompra),
    )

    filtered = (
        filter_po_dashboard_items_by_alert(items, alertKey)
        if alertKey
        else filter_po_dashboard_items_by_kpi(items, kpiKey)
    )

    if bucket:
        filtered = [item for item in filtered if item.bucket_creacion == bucket]

    reverse = orderDir == "desc"
    order_map = {
        "created_at": lambda item: item.fecha_creacion,
        "updated_at": lambda item: item.fecha_estado,
        "total": lambda item: item.monto_total or Decimal("0"),
        "dias": lambda item: item.dias_abierta,
    }
    sort_key = order_map.get(orderBy, order_map["created_at"])
    filtered = sorted(filtered, key=sort_key, reverse=reverse)

    total = len(filtered)
    start_index = (page - 1) * perPage
    end_index = start_index + perPage
    paged = filtered[start_index:end_index]

    return {
        "data": [_serialize_item(item) for item in paged],
        "total": total,
        "page": page,
        "perPage": perPage,
    }


@router.get("/selectors")
def get_po_dashboard_selectors(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    solicitante: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    tipoSolicitud: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    tipoCompra: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    """Conteo rápido por estado sin cargar relaciones."""
    try:
        return fetch_po_selector_summary_fast(
            session=session,
            start_date=startDate,
            end_date=endDate,
            solicitante_ids=_parse_int_list(solicitante),
            proveedor_ids=_parse_int_list(proveedor),
            tipo_solicitud_ids=_parse_int_list(tipoSolicitud),
            departamento_ids=_parse_int_list(departamento),
            tipo_compra_values=_parse_str_list(tipoCompra),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/bundle")
def get_po_dashboard_bundle(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD periodo actual"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD periodo actual"),
    solicitante: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    tipoSolicitud: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    tipoCompra: Optional[str] = Query(None),
    limitTop: int = Query(8, ge=1, le=20),
    periodType: str = Query("mes"),
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
                pass
        return result or [-3, -2, -1, 0]

    try:
        return build_po_dashboard_bundle(
            session=session,
            start_date=startDate,
            end_date=endDate,
            period_type=periodType,
            trend_steps=_parse_steps(trendSteps),
            previous_step=previousStep,
            solicitante_ids=_parse_int_list(solicitante),
            proveedor_ids=_parse_int_list(proveedor),
            tipo_solicitud_ids=_parse_int_list(tipoSolicitud),
            departamento_ids=_parse_int_list(departamento),
            tipo_compra_values=_parse_str_list(tipoCompra),
            limit_top=limitTop,
            filters_ctx={
                "solicitante": _parse_int_list(solicitante),
                "proveedor": _parse_int_list(proveedor),
                "tipoSolicitud": _parse_int_list(tipoSolicitud),
                "departamento": _parse_int_list(departamento),
                "tipoCompra": _parse_str_list(tipoCompra),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/alerta-item")
def get_po_dashboard_alerta_item(
    id: int = Query(..., description="ID de la orden de compra"),
    alertKey: str = Query(
        ...,
        pattern="^(rechazadas|solicitudes_vencidas|emitidas_vencidas)$",
    ),
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    solicitante: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    tipoSolicitud: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    tipoCompra: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    """Indica si una orden concreta sigue teniendo activa la alerta indicada."""
    try:
        tiene_alerta = check_po_alert(
            order_id=id,
            alert_key=alertKey,
            start_date=startDate,
            end_date=endDate,
            session=session,
            solicitante_ids=_parse_int_list(solicitante),
            proveedor_ids=_parse_int_list(proveedor),
            tipo_solicitud_ids=_parse_int_list(tipoSolicitud),
            departamento_ids=_parse_int_list(departamento),
            tipo_compra_values=_parse_str_list(tipoCompra),
        )
        return {"id": id, "alertKey": alertKey, "hasAlert": tiene_alerta}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc
