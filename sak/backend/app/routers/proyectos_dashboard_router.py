from typing import List, Optional
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.models.base import filtrar_respuesta
from app.models.proyecto import Proyecto
from app.services.proyectos_dashboard import (
    CalculatedProyecto,  # 🚀 Tipo para nuevas funciones optimizadas
    build_dashboard_detail_entry_from_calculated_proyecto,  # 🚀 Nueva función optimizada
    build_proyectos_dashboard_payload,
    check_proyecto_alert,
    fetch_current_proyectos_for_dashboard,
    fetch_proyectos_for_dashboard_optimized,  # 🚀 Función optimizada con single query
    fetch_selector_summary_fast,
    filter_proyectos_by_alert,
)

router = APIRouter(prefix="/api/dashboard/proyectos", tags=["dashboard-proyectos"])


def _parse_int_list(value: Optional[str]) -> Optional[List[int]]:
    """Parsea lista de enteros separados por coma"""
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
    """Parsea lista de strings separados por coma"""
    if not value:
        return None
    result = [chunk.strip() for chunk in value.split(",") if chunk.strip()]
    return result or None


@router.get("")
def get_proyectos_dashboard(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    selectorPeriodo: str = Query("mensual", pattern="^(mensual|trimestral|semestral|anual)$", description="Tipo de período para KPIs"),
    proyecto: Optional[str] = Query(None, description="IDs de proyectos separados por coma"),
    responsable: Optional[str] = Query(None, description="IDs de responsables separados por coma"),
    estado: Optional[str] = Query(None, description="Estados separados por coma"),
    centroCosto: Optional[str] = Query(None, description="IDs de centro de costo separados por coma"),
    limitTop: int = Query(5, ge=1, le=20),
    session: Session = Depends(get_session),
):
    """Endpoint principal del dashboard de proyectos con KPIs y rankings"""
    try:
        # 🚀 OPTIMIZACIÓN: Usar función con single query + JOINs
        items = fetch_proyectos_for_dashboard_optimized(
            session=session,
            start_date=startDate,
            end_date=endDate,
            proyecto_ids=_parse_int_list(proyecto),
            responsable_ids=_parse_int_list(responsable),
            estado_ids=_parse_str_list(estado),
            centro_costo_ids=_parse_int_list(centroCosto),
        )
        
        payload = build_proyectos_dashboard_payload(
            items,
            start_date=startDate,
            end_date=endDate,
            limit_top=limitTop,
            filters={
                "proyecto": _parse_int_list(proyecto),
                "responsable": _parse_int_list(responsable),
                "estado": _parse_str_list(estado),
                "centroCosto": _parse_int_list(centroCosto),
            },
            session=session,
            periodo_tipo=selectorPeriodo,
        )

        # Filtrar respuestas en rankings
        for ranking_type in ["por_avance", "por_presupuesto", "por_horas"]:
            ranking = payload.get("ranking", {}).get(ranking_type, [])
            for entry in ranking:
                if "proyecto" in entry:
                    entry["proyecto"] = filtrar_respuesta(entry["proyecto"])

        return payload

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/detalle-alerta")
def get_proyectos_dashboard_alert_detail(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    proyecto: Optional[str] = Query(None, description="IDs de proyectos separados por coma"),
    responsable: Optional[str] = Query(None, description="IDs de responsables separados por coma"),
    estado: Optional[str] = Query(None, description="Estados separados por coma"),
    centroCosto: Optional[str] = Query(None, description="IDs de centro de costo separados por coma"),
    alertKey: str = Query(
        ...,
        pattern="^(mensajes|eventos|ordenes_rechazadas)$",
        description="Tipo de alerta"
    ),
    orderBy: str = Query("nombre", pattern="^(nombre|estado|avance|fecha_creacion|importe|costo_ejecutado)$"),
    orderDir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    """Detalle de proyectos con una alerta específica"""
    try:
        # 🚀 OPTIMIZACIÓN: Usar función con single query + JOINs
        # Obtener proyectos calculados
        proyectos = fetch_proyectos_for_dashboard_optimized(
            session=session,
            start_date=startDate,
            end_date=endDate,
            proyecto_ids=_parse_int_list(proyecto),
            responsable_ids=_parse_int_list(responsable),
            estado_ids=_parse_str_list(estado),
            centro_costo_ids=_parse_int_list(centroCosto),
        )
        
        # Filtrar por alerta específica 
        filtered = filter_proyectos_by_alert(
            proyectos=proyectos,
            alert_key=alertKey,
            session=session,
        )
        
        # 🚀 OPTIMIZACIÓN: Usar nueva función que no requiere queries batch adicionales
        entries = [
            build_dashboard_detail_entry_from_calculated_proyecto(
                calculated_proyecto=item, 
                context_key=alertKey
            )
            for item in filtered
        ]
        
        # Ordenamiento
        reverse = orderDir == "desc"
        order_map = {
            "nombre": lambda item: (item["proyecto"].nombre or "", item["proyecto"].id or 0),
            "estado": lambda item: (item["estado_al_corte"] or "", item["proyecto"].id or 0),
            "avance": lambda item: item["avance"],
            "fecha_creacion": lambda item: item["fecha_creacion"] or date.min,
            "importe": lambda item: item["importe_ejecutado"],
            "costo_ejecutado": lambda item: item["costo_ejecutado"],
        }
        
        sort_key = order_map.get(orderBy, order_map["nombre"])
        entries = sorted(entries, key=sort_key, reverse=reverse)
        
        # Paginación
        total_count = len(entries)
        start_index = (page - 1) * perPage
        end_index = start_index + perPage
        paged = entries[start_index:end_index]
        
        # Filtrar respuestas
        data = [
            {**item, "proyecto": filtrar_respuesta(item["proyecto"])}
            for item in paged
        ]
        
        return {
            "data": data,
            "total": total_count,
            "page": page,
            "perPage": perPage,
        }
        
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/alerta-item")
def get_proyectos_dashboard_alerta_item(
    id: int = Query(..., description="ID del proyecto"),
    alertKey: str = Query(
        ...,
        pattern="^(mensajes|eventos|ordenes_rechazadas)$",
        description="Tipo de alerta"
    ),
    session: Session = Depends(get_session),
):
    """Indica si un proyecto concreto sigue teniendo activa la alerta indicada."""
    try:
        tiene_alerta = check_proyecto_alert(
            proyecto_id=id,
            alert_key=alertKey,
            session=session,
        )
        return {"id": id, "alertKey": alertKey, "hasAlert": tiene_alerta}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/detalle")
def get_proyectos_dashboard_detalle(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    proyecto: Optional[str] = Query(None, description="IDs de proyectos separados por coma"),
    responsable: Optional[str] = Query(None, description="IDs de responsables separados por coma"),
    estado: Optional[str] = Query(None, description="Estados separados por coma"),
    centroCosto: Optional[str] = Query(None, description="IDs de centro de costo separados por coma"),
    kpiKey: str = Query("activos", pattern="^(activos|completados|nuevos|todos)$"),
    orderBy: str = Query("nombre", pattern="^(nombre|estado|avance|fecha_creacion|importe|costo_ejecutado)$"),
    orderDir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    session: Session = Depends(get_session),
):
    """Detalle de proyectos con filtros avanzados y paginación"""
    try:
        # 🚀 OPTIMIZACIÓN: Usar función con single query + JOINs
        proyectos = fetch_proyectos_for_dashboard_optimized(
            session=session,
            start_date=startDate,
            end_date=endDate,
            proyecto_ids=_parse_int_list(proyecto),
            responsable_ids=_parse_int_list(responsable),
            estado_ids=_parse_str_list(estado),
            centro_costo_ids=_parse_int_list(centroCosto),
        )
        
        # Filtrar por KPI usando CalculatedProyecto
        start = date.fromisoformat(startDate)
        end = date.fromisoformat(endDate)
        
        def _filter_by_kpi(data: List[CalculatedProyecto]) -> List[CalculatedProyecto]:
            if kpiKey == "activos":
                return [p for p in data if p.es_activo]
            elif kpiKey == "completados":
                return [p for p in data if p.es_completado_periodo]
            elif kpiKey == "nuevos":
                return [p for p in data if p.es_nuevo_periodo]
            else:  # "todos"
                return data
        
        filtered_proyectos = _filter_by_kpi(proyectos)
        
        # 🚀 OPTIMIZACIÓN: Usar nueva función que no requiere queries batch adicionales
        entries = [
            build_dashboard_detail_entry_from_calculated_proyecto(
                calculated_proyecto=calculated_proyecto, 
                context_key=kpiKey
            )
            for calculated_proyecto in filtered_proyectos
        ]
        
        # Ordenamiento
        reverse = orderDir == "desc"
        order_map = {
            "nombre": lambda item: (item["proyecto"].nombre or "", item["proyecto"].id or 0),
            "estado": lambda item: (item["estado_al_corte"] or "", item["proyecto"].id or 0),
            "avance": lambda item: item["avance"],
            "fecha_creacion": lambda item: item["fecha_creacion"] or date.min,
            "importe": lambda item: item["importe_ejecutado"],
            "costo_ejecutado": lambda item: item["costo_ejecutado"],
        }
        
        sort_key = order_map.get(orderBy, order_map["nombre"])
        entries = sorted(entries, key=sort_key, reverse=reverse)
        
        # Paginación
        total_count = len(entries)
        start_index = (page - 1) * perPage
        end_index = start_index + perPage
        paged = entries[start_index:end_index]
        
        # Filtrar respuestas
        data = [
            {**item, "proyecto": filtrar_respuesta(item["proyecto"])}
            for item in paged
        ]
        
        return {
            "data": data,
            "total": total_count,
            "page": page,
            "perPage": perPage,
        }
        
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/selectors")
def get_proyectos_dashboard_selectors(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    proyecto: Optional[str] = Query(None, description="IDs de proyectos separados por coma"),
    responsable: Optional[str] = Query(None, description="IDs de responsables separados por coma"),
    estado: Optional[str] = Query(None, description="Estados separados por coma"),
    centroCosto: Optional[str] = Query(None, description="IDs de centro de costo separados por coma"),
    session: Session = Depends(get_session),
):
    """Datos rápidos para selectores de filtros sin cargar relaciones completas"""
    try:
        return fetch_selector_summary_fast(
            session=session,
            start_date=startDate,
            end_date=endDate,
            proyecto_ids=_parse_int_list(proyecto),
            responsable_ids=_parse_int_list(responsable),
            estado_ids=_parse_str_list(estado),
            centro_costo_ids=_parse_int_list(centroCosto),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/metricas-avance")
def get_proyectos_metricas_avance(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    proyecto: Optional[str] = Query(None, description="IDs de proyectos separados por coma"),
    responsable: Optional[str] = Query(None, description="IDs de responsables separados por coma"),
    estado: Optional[str] = Query(None, description="Estados separados por coma"),
    centroCosto: Optional[str] = Query(None, description="IDs de centro de costo separados por coma"),
    session: Session = Depends(get_session),
):
    """Métricas específicas de avance de proyectos"""
    try:
        # 🚀 OPTIMIZACIÓN: Usar función con single query + JOINs
        items = fetch_proyectos_for_dashboard_optimized(
            session=session,
            start_date=startDate,
            end_date=endDate,
            proyecto_ids=_parse_int_list(proyecto),
            responsable_ids=_parse_int_list(responsable),
            estado_ids=_parse_str_list(estado),
            centro_costo_ids=_parse_int_list(centroCosto),
        )
        
        # Métricas de avance
        total_proyectos = len(items)
        proyectos_sin_avance = len([item for item in items if item.avance_total == 0])
        proyectos_iniciados = len([item for item in items if 0 < item.avance_total < 100])
        proyectos_completados = len([item for item in items if item.avance_total >= 100])
        
        # Distribución por rangos de avance
        rangos = {
            "0%": 0,
            "1-25%": 0,
            "26-50%": 0,
            "51-75%": 0,
            "76-99%": 0,
            "100%": 0,
        }
        
        for item in items:
            avance = float(item.avance_total)
            if avance == 0:
                rangos["0%"] += 1
            elif avance <= 25:
                rangos["1-25%"] += 1
            elif avance <= 50:
                rangos["26-50%"] += 1
            elif avance <= 75:
                rangos["51-75%"] += 1
            elif avance < 100:
                rangos["76-99%"] += 1
            else:
                rangos["100%"] += 1
        
        # Promedio de avance ponderado por presupuesto
        if items:
            total_presupuesto = sum(float(item.presupuesto_total or 0) for item in items)
            if total_presupuesto > 0:
                avance_ponderado = sum(
                    float(item.avance_total) * (float(item.presupuesto_total or 0) / total_presupuesto)
                    for item in items
                )
            else:
                avance_ponderado = sum(float(item.avance_total) for item in items) / len(items)
        else:
            avance_ponderado = 0
        
        return {
            "resumen": {
                "total_proyectos": total_proyectos,
                "sin_avance": proyectos_sin_avance,
                "en_progreso": proyectos_iniciados,
                "completados": proyectos_completados,
                "avance_promedio_ponderado": round(avance_ponderado, 1),
            },
            "distribucion_rangos": rangos,
            "periodo": {"start": startDate, "end": endDate},
        }
        
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/alertas")
def get_proyectos_alertas(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    responsable: Optional[str] = Query(None, description="IDs de responsables separados por coma"),
    estado: Optional[str] = Query(None, description="Estados separados por coma"),
    centroCosto: Optional[str] = Query(None, description="IDs de centro de costo separados por coma"),
    session: Session = Depends(get_session),
):
    """Alertas y proyectos que requieren atención"""
    try:
        proyectos = fetch_current_proyectos_for_dashboard(
            session=session,
            start_date=startDate,
            end_date=endDate,
            responsable_ids=_parse_int_list(responsable),
            estado_ids=_parse_str_list(estado),
            centro_costo_ids=_parse_int_list(centroCosto),
        )
        
        alertas = {
            "proyectos_sin_avance": [],
            "proyectos_vencidos": [],
            "proyectos_sin_actividad": [],
        }
        
        cutoff_date = datetime.now().date() - timedelta(days=30)
        
        for proyecto in proyectos:
            # Proyectos sin avance
            if not proyecto.avances or all(a.avance == 0 for a in proyecto.avances):
                alertas["proyectos_sin_avance"].append({
                    "proyecto": filtrar_respuesta(proyecto),
                    "dias_desde_creacion": (datetime.now().date() - (proyecto.created_at.date() if proyecto.created_at else datetime.now().date())).days,
                })
            
            # Proyectos vencidos
            if (proyecto.fecha_final and 
                proyecto.fecha_final < datetime.now().date() and 
                proyecto.estado not in ["COMPLETADO", "CANCELADO"]):
                alertas["proyectos_vencidos"].append({
                    "proyecto": filtrar_respuesta(proyecto),
                    "dias_vencido": (datetime.now().date() - proyecto.fecha_final).days,
                })
            
            # Proyectos sin actividad reciente
            if proyecto.avances:
                ultimo_avance = max(proyecto.avances, key=lambda a: a.fecha_registracion)
                if ultimo_avance.fecha_registracion < cutoff_date:
                    alertas["proyectos_sin_actividad"].append({
                        "proyecto": filtrar_respuesta(proyecto),
                        "dias_sin_actividad": (datetime.now().date() - ultimo_avance.fecha_registracion).days,
                    })
        
        # Calcular totales
        totales = {
            "sin_avance": len(alertas["proyectos_sin_avance"]),
            "vencidos": len(alertas["proyectos_vencidos"]),
            "sin_actividad": len(alertas["proyectos_sin_actividad"]),
            "total_alertas": (
                len(alertas["proyectos_sin_avance"]) + 
                len(alertas["proyectos_vencidos"]) + 
                len(alertas["proyectos_sin_actividad"])
            ),
        }
        
        return {
            "totales": totales,
            "alertas": alertas,
            "periodo": {"start": startDate, "end": endDate},
        }
        
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc
