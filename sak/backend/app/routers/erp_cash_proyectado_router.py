from datetime import date
from decimal import Decimal

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_proyectado_quick_edit import (
    get_projection_quick_edit,
    save_projection_quick_edit,
)


erp_cash_proyectado_crud = GenericCRUD(ErpCashProyectado)
erp_cash_proyectado_router = create_generic_router(
    model=ErpCashProyectado,
    crud=erp_cash_proyectado_crud,
    prefix="/erp/cash/proyectado",
    tags=["erp-cash-proyectado"],
)


class ProjectionQuickEditValue(BaseModel):
    periodo: date
    importe: Decimal

    @field_validator("periodo")
    @classmethod
    def validate_month_start(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("periodo debe ser el primer día del mes")
        return value


class ProjectionQuickEditPayload(BaseModel):
    values: list[ProjectionQuickEditValue] = Field(min_length=24, max_length=24)


def _quick_edit_year(value: int) -> int:
    if value < 2000 or value > 2200:
        raise HTTPException(status_code=400, detail="anio debe estar entre 2000 y 2200")
    return value


@erp_cash_proyectado_router.get("/quick-edit/values")
def get_erp_cash_projection_quick_edit(
    cuenta_cash_id: int = Query(..., gt=0),
    anio: int = Query(...),
    session: Session = Depends(get_session),
):
    try:
        return get_projection_quick_edit(
            session,
            cuenta_cash_id,
            _quick_edit_year(anio),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_proyectado_router.put("/quick-edit/values")
def update_erp_cash_projection_quick_edit(
    payload: ProjectionQuickEditPayload,
    cuenta_cash_id: int = Query(..., gt=0),
    anio: int = Query(...),
    session: Session = Depends(get_session),
):
    values = {item.periodo: item.importe for item in payload.values}
    if len(values) != len(payload.values):
        raise HTTPException(status_code=400, detail="Hay períodos duplicados")
    try:
        return save_projection_quick_edit(
            session,
            cuenta_cash_id,
            _quick_edit_year(anio),
            values,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
