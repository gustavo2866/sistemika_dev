from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.services.erp_financial_dashboard import build_erp_financial_dashboard_payload


router = APIRouter(
    prefix="/api/dashboard/proyectos-financiero",
    tags=["dashboard-proyectos-financiero"],
)


@router.get("")
def get_erp_financial_dashboard(
    startDate: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    endDate: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    selectorPeriodo: str = Query(
        "mensual",
        pattern="^(mensual|trimestral|semestral|anual)$",
        description="Tipo de periodo solicitado por el selector",
    ),
    proyecto: str | None = Query(None, description="IDs de proyectos separados por coma"),
    estado: str | None = Query(None, description="Estados separados por coma"),
    session: Session = Depends(get_session),
):
    try:
        return build_erp_financial_dashboard_payload(
            session=session,
            start_date=startDate,
            end_date=endDate,
            selector_periodo=selectorPeriodo,
            proyecto=proyecto,
            estado=estado,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc
