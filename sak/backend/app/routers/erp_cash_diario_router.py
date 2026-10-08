from datetime import date
from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_diario_panel import get_cash_panel, get_cash_panel_detail
from app.models.erp.cash_diario_sync import sync_cash_diario_periodo
from app.models.erp.cash_budget_excel import (
    cash_budget_workbook_bytes,
    import_cash_budget_workbook,
)


erp_cash_diario_crud = GenericCRUD(ErpCashDiario)
erp_cash_diario_router = create_generic_router(
    model=ErpCashDiario,
    crud=erp_cash_diario_crud,
    prefix="/erp/cash/diario",
    tags=["erp-cash-diario"],
)
erp_cash_panel_router = APIRouter(prefix="/erp/cash", tags=["erp-cash-panel"])


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
def get_erp_cash_diario_panel_legacy(
    periodo: str = Query(..., description="Periodo en formato YYYY-MM o YYYYMM"),
    session: Session = Depends(get_session),
):
    try:
        return get_cash_panel(session, periodo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_panel_router.get("/panel")
def get_erp_cash_panel(
    periodo: str = Query(..., description="Mes inicial en formato YYYY-MM o YYYYMM"),
    session: Session = Depends(get_session),
):
    try:
        return get_cash_panel(session, periodo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_panel_router.get("/panel/detail")
def get_erp_cash_panel_detail(
    periodo: str = Query(..., description="Mes en formato YYYY-MM o YYYYMM"),
    group_key: str | None = Query(default=None),
    cuenta_cash_id: str | None = Query(default=None, description="ID de cuenta Cash o 'null'"),
    cuenta_codigo: int | None = Query(default=None),
    importe_mode: str = Query(default="cash", pattern="^(cash|saldo)$"),
    session: Session = Depends(get_session),
):
    filter_cash_account = cuenta_cash_id is not None
    parsed_cash_account_id: int | None = None
    if cuenta_cash_id is not None and cuenta_cash_id.lower() != "null":
        try:
            parsed_cash_account_id = int(cuenta_cash_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="cuenta_cash_id inválido") from exc

    try:
        return get_cash_panel_detail(
            session,
            periodo,
            group_key=group_key,
            filter_cash_account=filter_cash_account,
            cuenta_cash_id=parsed_cash_account_id,
            cuenta_codigo=cuenta_codigo,
            importe_mode=importe_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _budget_year(value: int | None) -> int:
    year = value or date.today().year
    if year < 2000 or year > 2200:
        raise HTTPException(status_code=400, detail="anio debe estar entre 2000 y 2200")
    return year


@erp_cash_panel_router.get("/panel/budget/export")
def export_erp_cash_budget(
    anio: int | None = Query(default=None),
    session: Session = Depends(get_session),
):
    year = _budget_year(anio)
    content = cash_budget_workbook_bytes(session, year)
    filename = f"presupuesto_cash_{year}_{year + 1}.xlsx"
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@erp_cash_panel_router.post("/panel/budget/import")
async def import_erp_cash_budget(
    file: UploadFile = File(...),
    anio: int | None = Query(default=None),
    session: Session = Depends(get_session),
):
    year = _budget_year(anio)
    if not str(file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Debe seleccionar un archivo .xlsx")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo supera el máximo de 5 MB")
    try:
        return import_cash_budget_workbook(session, content, year)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
