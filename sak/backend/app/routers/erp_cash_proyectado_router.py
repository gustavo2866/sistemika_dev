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
    calculate_projection_quick_edit,
    get_projection_quick_edit,
    save_projection_quick_edit,
)
from app.services.cash_projection_service import ProjectionDataError


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
    importe_pendiente: Decimal = Decimal("0")
    importe_comprometido: Decimal = Decimal("0")
    descripcion: str | None = Field(default=None, max_length=255)

    @field_validator("periodo")
    @classmethod
    def validate_month_start(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("periodo debe ser el primer día del mes")
        return value


class ProjectionQuickEditPayload(BaseModel):
    values: list[ProjectionQuickEditValue] = Field(min_length=24, max_length=24)
    metodo_proyeccion_id: int | None = Field(default=None, gt=0)


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
    pending_values = {
        item.periodo: item.importe_pendiente for item in payload.values
    }
    committed_values = {
        item.periodo: (item.importe_comprometido, item.descripcion)
        for item in payload.values
    }
    if len(values) != len(payload.values):
        raise HTTPException(status_code=400, detail="Hay períodos duplicados")
    try:
        return save_projection_quick_edit(
            session,
            cuenta_cash_id,
            _quick_edit_year(anio),
            values,
            payload.metodo_proyeccion_id,
            committed_values,
            pending_values,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_proyectado_router.post("/quick-edit/calculate")
def calculate_erp_cash_projection_quick_edit(
    cuenta_cash_id: int = Query(..., gt=0),
    anio: int = Query(...),
    metodo_proyeccion_id: int | None = Query(default=None, gt=0),
    periodo_desde: date | None = Query(default=None),
    periodo_hasta: date | None = Query(default=None),
    session: Session = Depends(get_session),
):
    try:
        return calculate_projection_quick_edit(
            session,
            cuenta_cash_id,
            _quick_edit_year(anio),
            metodo_proyeccion_id,
            periodo_desde,
            periodo_hasta,
        )
    except ProjectionDataError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(exc),
                "reason": exc.reason,
                "cash_account_id": exc.cash_account_id,
                "missing_month": exc.missing_month.isoformat(),
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
