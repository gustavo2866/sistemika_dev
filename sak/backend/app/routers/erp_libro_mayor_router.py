from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.models.erp.cash_diario_sync import get_fondo_mappings_by_cuenta
from app.models.erp.libro_mayor import get_libro_mayor_saldos


erp_libro_mayor_router = APIRouter(
    prefix="/erp/libro-mayor",
    tags=["erp-libro-mayor"],
)


@erp_libro_mayor_router.get("/saldos")
def get_erp_libro_mayor_saldos(
    periodo: str = Query(..., description="Periodo en formato YYYY-MM o YYYYMM"),
    session: Session = Depends(get_session),
):
    try:
        fondo_account_codes = set(get_fondo_mappings_by_cuenta(session))
        return get_libro_mayor_saldos(periodo, fondo_account_codes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
