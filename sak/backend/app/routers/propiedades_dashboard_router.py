"""
Dashboard de Propiedades — Router
==================================
Expone los indicadores de vacancia y gestión del portfolio inmobiliario.

Conceptos clave
---------------
* **Vacancia**: período en que una propiedad no está ocupada (estados
  Recibida, En Reparación o Disponible).
* **Ciclo de vacancia**: secuencia continua de estados vacantes que comienza
  cuando la propiedad entra a Recibida (desde un estado terminal) y termina
  al pasar a Realizada o Retirada.
* **Intervalo de vacancia**: sub-tramo dentro de un ciclo asociado a un único
  estado (p.ej. los días que estuvo en Reparación dentro de ese ciclo).
* **Período**: rango [startDate, endDate] sobre el que se calculan los KPIs.
  Los días se calculan por solapamiento: solo se cuentan los días del intervalo
  que caen dentro del período, independientemente del estado actual.
* **Período anterior**: rango equivalente corrido `previousStep` períodos hacia
  atrás.  Se usa para calcular `variacion_vs_anterior`.
* **Tendencia** (`trend`): lista de puntos temporales, cada uno calculado con
  el mismo tipo de período pero desplazado según `trendSteps`.

Indicadores principales (respuesta de /bundle)
----------------------------------------------
kpis

  dias_vacancia_periodo
    total                   Días-propiedad de vacancia acumulados en el período
                            (suma de solapamiento de todos los intervalos).
    por_estado
      recibida              Días acumulados mientras la propiedad estaba en
                            estado Recibida (orden 1).
      en_reparacion         Días acumulados en estado En Reparación (orden 2).
      disponible            Días acumulados en estado Disponible (orden 3).
                            Invariante: recibida + en_reparacion + disponible == total.
    variacion_vs_anterior   Variación porcentual del total vs. el período anterior.

period_summary
  activas_inicio            Vacantes estimadas al inicio del período
                            (activas_fin + resueltas - nuevas).
  activas_fin               Vacantes al final del período (== vacantes_activas.count).
  netas                     activas_fin − activas_inicio.
  nuevas_vacancias          Propiedades cuyo ciclo de vacancia comenzó en el período.
  vacancias_resueltas       Propiedades cuyo ciclo de vacancia terminó en el período.

alerts
  vencimiento_lt_60   Contratos venciendo en menos de 60 días.
  renovacion_lt_60    Fechas de renovación en menos de 60 días.

trend  (lista de puntos temporales)
  bucket          Etiqueta del tramo (p.ej. "T1 26", "Feb 26").
  count_vacantes  Cantidad de propiedades con al menos 1 día de vacancia en el tramo.
  dias_total      Total de días-propiedad de vacancia en el tramo.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.services.propiedades_dashboard import (
    build_prop_dashboard_bundle,
    build_prop_detalle,
    build_prop_detalle_alerta,
    build_prop_detalle_alerta_vacancia,
    build_prop_selectors,
    build_propiedades_dashboard,
    build_realizada_vencimientos,
)

router = APIRouter(prefix="/api/dashboard/propiedades", tags=["dashboard-propiedades"])


def _opt_int(value: Optional[str]) -> Optional[int]:
    if not value or value.strip().lower() == "todos":
        return None
    try:
        return int(value)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Nuevos endpoints — bundle / selectors / detalle / detalle-alerta
# ---------------------------------------------------------------------------

@router.get("/bundle")
def get_bundle(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    tipoOperacionId: Optional[str] = Query(None, description="ID o 'todos'"),
    emprendimientoId: Optional[str] = Query(None, description="ID o 'todos'"),
    periodType: str = Query("trimestre", description="mes|trimestre|cuatrimestre|semestre|anio"),
    trendSteps: str = Query("-3,-2,-1,0", description="Pasos para evolución temporal"),
    previousStep: str = Query("-1", description="Paso para período anterior"),
    session: Session = Depends(get_session),
):
    """
    Retorna el bundle completo del dashboard de propiedades para un período dado.

    La respuesta incluye tres secciones:

    **current / previous** — datos del período actual y del período anterior:
    - `kpis.dias_vacancia_periodo.total`: días-propiedad de vacancia acumulados
      en el período (suma del solapamiento de todos los intervalos de vacancia
      con el rango [startDate, endDate]).
    - `kpis.dias_vacancia_periodo.por_estado`: desglose de esos días por estado
      (recibida / en_reparacion / disponible).
    - `kpis.*.variacion_vs_anterior`: variación porcentual respecto al período
      anterior (determinado por `previousStep`).
    - `period_summary`: nuevas vacancias, resueltas y netas dentro del período.

    **trend** — lista de `len(trendSteps)` puntos, uno por cada paso:
    - `bucket`: etiqueta del tramo (p.ej. "T1 26").
    - `count_vacantes`: propiedades con al menos 1 día de vacancia en el tramo.
    - `dias_total`: días-propiedad de vacancia en ese tramo.

    Parámetros de período:
    - `periodType`: unidad de desplazamiento (mes, trimestre, cuatrimestre,
      semestre, anio).
    - `trendSteps`: pasos relativos separados por coma (ej. "-3,-2,-1,0").
    - `previousStep`: paso para el período contra el que se calcula la variación
      (por defecto "-1": un período hacia atrás).
    """
    try:
        return build_prop_dashboard_bundle(
            session=session,
            start_date=startDate,
            end_date=endDate,
            tipo_operacion_id=_opt_int(tipoOperacionId),
            emprendimiento_id=_opt_int(emprendimientoId),
            period_type=periodType,
            trend_steps=trendSteps,
            previous_step=previousStep,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/selectors")
def get_selectors(
    tipoOperacionId: Optional[str] = Query(None, description="ID o 'todos'"),
    emprendimientoId: Optional[str] = Query(None, description="ID o 'todos'"),
    pivotDate: Optional[str] = Query(None, description="Fecha pivot YYYY-MM-DD"),
    session: Session = Depends(get_session),
):
    """
    Retorna el snapshot de conteos por estado actual del portfolio.

    Útil para poblar los selectores/filtros de la UI sin necesidad de
    indicar un rango de fechas.

    Estructura de respuesta:
    - `recibida.count` — propiedades en estado Recibida.
    - `en_reparacion.count` — propiedades en estado En Reparación.
    - `disponible.count` — propiedades en estado Disponible.
    - `realizada.count` — propiedades en estado Realizada (ocupadas).
      - `vencimiento_lt_60`: contratos vencidos o venciendo dentro de los días configurados desde `pivotDate`.
      - `renovacion_lt_60`: renovaciones vencidas o dentro de los días configurados desde `pivotDate`.
    - `retirada.count` — propiedades retiradas del portfolio.
      - `lt_30`: retiradas hace ≤ 30 días desde `pivotDate`.
      - `gt_30`: retiradas hace > 30 días desde `pivotDate`.

    `pivotDate` por defecto es la fecha de hoy.
    """
    try:
        pivot = date.fromisoformat(pivotDate) if pivotDate else None
        return build_prop_selectors(
            session=session,
            tipo_operacion_id=_opt_int(tipoOperacionId),
            emprendimiento_id=_opt_int(emprendimientoId),
            pivot_date=pivot,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/detalle")
def get_detalle(
    selectorKey: str = Query(..., description="recibida|en_reparacion|disponible|realizada|retirada"),
    subBucket: Optional[str] = Query(None, description="Sub-bucket opcional"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(15, ge=1, le=200),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    tipoOperacionId: Optional[str] = Query(None),
    emprendimientoId: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    """
    Retorna el listado paginado de propiedades para un estado (selector) dado.

    `selectorKey` acepta:
    - `recibida`       — propiedades recién ingresadas, pendientes de diagnóstico.
    - `en_reparacion`  — propiedades en proceso de reparación/acondicionamiento.
    - `disponible`     — propiedades listas para ser ofrecidas.
    - `realizada`      — propiedades con contrato activo.
    - `retirada`       — propiedades dadas de baja del portfolio.

    `subBucket` permite filtrar sub-grupos dentro del estado:
    - Para `realizada`: `vencimiento_lt_60`, `renovacion_lt_60`.
    - Para `retirada`:  `lt_30`, `gt_30`.

    Cuando se proveen `startDate` / `endDate`, cada ítem incluye
    `dias_vacancia` calculado por solapamiento con ese rango.

    Respuesta: `{ total, page, pageSize, data: [ {id, nombre, ...}, ... ] }`
    """
    try:
        return build_prop_detalle(
            session=session,
            selector_key=selectorKey,
            sub_bucket=subBucket,
            page=page,
            page_size=pageSize,
            start_date=startDate,
            end_date=endDate,
            tipo_operacion_id=_opt_int(tipoOperacionId),
            emprendimiento_id=_opt_int(emprendimientoId),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/detalle-alerta")
def get_detalle_alerta(
    alertKey: str = Query(..., description="vencimiento_lt_60|renovacion_lt_60|vacancia_gt_90"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(15, ge=1, le=200),
    tipoOperacionId: Optional[str] = Query(None),
    emprendimientoId: Optional[str] = Query(None),
    pivotDate: Optional[str] = Query(None, description="Fecha pivot YYYY-MM-DD"),
    session: Session = Depends(get_session),
):
    """
    Retorna el listado paginado de propiedades con alertas de vencimiento próximas
    o con vacancia prolongada.

    `alertKey` acepta:
    - `vencimiento_lt_60`  — contratos con `vencimiento_contrato` vencido o dentro
      de los días configurados desde `pivotDate`.
    - `renovacion_lt_60`   — contratos con `fecha_renovacion` vencida o dentro de
      los días configurados, siempre que sea anterior o igual al vencimiento.
    - `vacancia_gt_90`     — propiedades vacantes con más de 90 días de vacancia,
      ordenadas por días descendente.

    `pivotDate` por defecto es la fecha de hoy.
    Respuesta: `{ total, page, pageSize, data: [ {id, nombre, ...}, ... ] }`
    """
    try:
        if alertKey == "vacancia_gt_90":
            pivot = date.fromisoformat(pivotDate) if pivotDate else None
            return build_prop_detalle_alerta_vacancia(
                session=session,
                page=page,
                page_size=pageSize,
                tipo_operacion_id=_opt_int(tipoOperacionId),
                emprendimiento_id=_opt_int(emprendimientoId),
                pivot_date=pivot,
            )
        pivot = date.fromisoformat(pivotDate) if pivotDate else None
        return build_prop_detalle_alerta(
            session=session,
            alert_key=alertKey,
            page=page,
            page_size=pageSize,
            tipo_operacion_id=_opt_int(tipoOperacionId),
            emprendimiento_id=_opt_int(emprendimientoId),
            pivot_date=pivot,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


# ---------------------------------------------------------------------------
# Helpers legacy no registrados como endpoints.
# ---------------------------------------------------------------------------

def get_dashboard(
    pivotDate: Optional[str] = Query(None, description="Fecha pivot YYYY-MM-DD"),
    tipoOperacionId: Optional[int] = Query(None, description="ID tipo de operacion"),
    session: Session = Depends(get_session),
):
    """
    [LEGACY] Dashboard general de propiedades (snapshot).
    Preferir `/bundle` para dashboards nuevos.
    """
    try:
        if pivotDate:
            pivot = date.fromisoformat(pivotDate)
        else:
            pivot = date.today()
        return build_propiedades_dashboard(
            session=session,
            pivot_date=pivot,
            tipo_operacion_id=tipoOperacionId,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)})


def get_realizada_vencimientos(
    pivotDate: Optional[str] = Query(None, description="Fecha pivot YYYY-MM-DD"),
    tipoOperacionId: Optional[int] = Query(None, description="ID tipo de operacion"),
    session: Session = Depends(get_session),
):
    """
    [LEGACY] Listado de propiedades Realizadas con vencimientos próximos.
    Preferir `/detalle-alerta` para implementaciones nuevas.
    """
    try:
        if pivotDate:
            pivot = date.fromisoformat(pivotDate)
        else:
            pivot = date.today()
        return build_realizada_vencimientos(
            session=session,
            pivot_date=pivot,
            tipo_operacion_id=tipoOperacionId,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)})

