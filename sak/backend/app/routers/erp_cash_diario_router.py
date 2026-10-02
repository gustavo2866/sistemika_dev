from fastapi import Body, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_diario_panel import get_cash_diario_panel
from app.models.erp.cash_diario_sync import sync_cash_diario_periodo


erp_cash_diario_crud = GenericCRUD(ErpCashDiario)
erp_cash_diario_router = create_generic_router(
    model=ErpCashDiario,
    crud=erp_cash_diario_crud,
    prefix="/erp/cash/diario",
    tags=["erp-cash-diario"],
)


@erp_cash_diario_router.post("/sync")
def sync_erp_cash_diario(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    periodo = payload.get("periodo")
    if not periodo:
        raise HTTPException(status_code=400, detail="periodo es requerido (YYYY-MM o YYYYMM)")

    try:
        return sync_cash_diario_periodo(session, str(periodo))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_diario_router.get("/panel")
def get_erp_cash_diario_panel(
    periodo: str = Query(..., description="Periodo en formato YYYY-MM o YYYYMM"),
    session: Session = Depends(get_session),
):
    try:
        return get_cash_diario_panel(session, periodo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
