from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.models.base import filtrar_respuesta
from app.services.vacancia_dashboard import build_dashboard_payload, fetch_vacancias_for_dashboard

router = APIRouter(prefix="/api/dashboard/vacancias", tags=["dashboard-vacancias"])


@router.get("")
def get_dashboard(
    startDate: str = Query(..., description="Fecha inicio rango YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin rango YYYY-MM-DD"),
    estadoPropiedad: str | None = Query(None),
    propietario: str | None = Query(None),
    ambientes: int | None = Query(None),
    limitTop: int = Query(5, ge=1, le=50),
    includeItems: bool = Query(False, description="Incluir lista completa de vacancias calculadas"),
    session: Session = Depends(get_session),
):
    try:
        items = fetch_vacancias_for_dashboard(
            session=session,
            start_date=startDate,
            end_date=endDate,
            estado_propiedad=estadoPropiedad,
            propietario=propietario,
            ambientes=ambientes,
        )
        payload = build_dashboard_payload(items, start_date=startDate, end_date=endDate, limit_top=limitTop)

        # Filtrar respuesta de vacancias/propiedades para no exponer campos internos
        for entry in payload.get("top", []):
            entry["vacancia"] = filtrar_respuesta(entry["vacancia"])

        if includeItems:
            payload["items"] = [
                {
                    "vacancia": filtrar_respuesta(item.vacancia),
                    "dias_totales": item.dias_totales,
                    "dias_reparacion": item.dias_reparacion,
                    "dias_disponible": item.dias_disponible,
                    "estado_corte": item.estado_corte,
                    "bucket": item.bucket,
                }
                for item in items
            ]

        return payload
    except Exception as exc:  # pragma: no cover - fallback de seguridad
        raise HTTPException(status_code=400, detail={"error": str(exc)})


@router.get("/detalle")
def get_dashboard_detalle(
    startDate: str = Query(..., description="Fecha inicio rango YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin rango YYYY-MM-DD"),
    estadoPropiedad: str | None = Query(None),
    propietario: str | None = Query(None),
    ambientes: int | None = Query(None),
    page: int = Query(1, ge=1),
    perPage: int = Query(25, ge=1, le=200),
    orderBy: str = Query("dias_totales"),
    orderDir: str = Query("desc", pattern="^(asc|desc)$"),
    session: Session = Depends(get_session),
):
    items = fetch_vacancias_for_dashboard(
        session=session,
        start_date=startDate,
        end_date=endDate,
        estado_propiedad=estadoPropiedad,
        propietario=propietario,
        ambientes=ambientes,
    )

    reverse = orderDir.lower() == "desc"
    key_map = {
        "dias_totales": lambda i: i.dias_totales,
        "dias_reparacion": lambda i: i.dias_reparacion,
        "dias_disponible": lambda i: i.dias_disponible,
    }
    sort_key = key_map.get(orderBy, key_map["dias_totales"])
    items_sorted = sorted(items, key=sort_key, reverse=reverse)

    total = len(items_sorted)
    start_idx = (page - 1) * perPage
    end_idx = start_idx + perPage
    paged = items_sorted[start_idx:end_idx]

    response_items = [
        {
            "vacancia": filtrar_respuesta(item.vacancia),
            "dias_totales": item.dias_totales,
            "dias_reparacion": item.dias_reparacion,
            "dias_disponible": item.dias_disponible,
            "estado_corte": item.estado_corte,
            "bucket": item.bucket,
        }
        for item in paged
    ]

    return {"data": response_items, "total": total, "page": page, "perPage": perPage}
