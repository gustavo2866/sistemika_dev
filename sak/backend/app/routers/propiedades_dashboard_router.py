from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.services.propiedades_dashboard import (
    build_propiedades_dashboard,
    build_realizada_vencimientos,
)

router = APIRouter(prefix="/api/dashboard/propiedades", tags=["dashboard-propiedades"])


@router.get("")
def get_dashboard(
    pivotDate: str | None = Query(None, description="Fecha pivot YYYY-MM-DD"),
    tipoOperacionId: int | None = Query(None, description="ID tipo de operacion"),
    session: Session = Depends(get_session),
):
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
    except Exception as exc:  # pragma: no cover - fallback de seguridad
        raise HTTPException(status_code=400, detail={"error": str(exc)})


@router.get("/realizada-vencimientos")
def get_realizada_vencimientos(
    pivotDate: str | None = Query(None, description="Fecha pivot YYYY-MM-DD"),
    tipoOperacionId: int | None = Query(None, description="ID tipo de operacion"),
    session: Session = Depends(get_session),
):
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
    except Exception as exc:  # pragma: no cover - fallback de seguridad
        raise HTTPException(status_code=400, detail={"error": str(exc)})
