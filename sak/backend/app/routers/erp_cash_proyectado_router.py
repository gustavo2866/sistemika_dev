from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field, StrictBool, field_validator
from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.erp.cash_proyectado import ErpCashProyectado, projection_method_values
from app.models.erp.cash_proyectado_quick_edit import (
    calculate_projection_quick_edit,
    get_projection_quick_edit,
    save_projection_quick_edit,
)
from app.services.cash_projection_service import ProjectionDataError
from app.services.erp_cash_pendientes_projection_service import (
    rebuild_pending_cash_projection,
)


class CashProyectadoCRUD(GenericCRUD[ErpCashProyectado]):
    def create(self, session, data, auto_commit=True):
        data = dict(data)
        data.pop("total_proyectado", None)
        data["origen_proyectado"] = "MANUAL"
        data.update(projection_method_values(session, int(data["cuenta_cash_id"]), data.get("id_metodo_proyeccion")))
        return super().create(session, data, auto_commit=auto_commit)

    def update(self, session, obj_id, data, check_version=True, auto_commit=True):
        existing = self.get(session, obj_id)
        if existing is None:
            return None
        data = dict(data)
        data.pop("total_proyectado", None)
        data.pop("tipo_calculo", None)
        data.pop("origen_proyectado", None)
        if "importe_proyectado" in data and Decimal(str(data["importe_proyectado"])) != existing.importe_proyectado:
            data["origen_proyectado"] = "MANUAL"
        if "id_metodo_proyeccion" in data or "cuenta_cash_id" in data:
            data.update(projection_method_values(
                session, int(data.get("cuenta_cash_id", existing.cuenta_cash_id)),
                data.get("id_metodo_proyeccion", existing.id_metodo_proyeccion),
            ))
        return super().update(session, obj_id, data, check_version=check_version, auto_commit=auto_commit)


erp_cash_proyectado_crud = CashProyectadoCRUD(ErpCashProyectado)
erp_cash_proyectado_router = create_generic_router(
    model=ErpCashProyectado,
    crud=erp_cash_proyectado_crud,
    prefix="/erp/cash/proyectado",
    tags=["erp-cash-proyectado"],
)


@erp_cash_proyectado_router.post("/rebuild-pending")
def rebuild_erp_cash_pending_projection(
    session: Session = Depends(get_session),
):
    return rebuild_pending_cash_projection(session)


class ProjectionQuickEditValue(BaseModel):
    periodo: date
    importe_proyectado: Decimal
    origen_proyectado: Literal["MANUAL", "CALCULADO"] = "MANUAL"
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
    values: list[ProjectionQuickEditValue] = Field(min_length=1)
    metodo_proyeccion_id: int | None = Field(default=None, gt=0)
    cuenta_cash_referencia_id: int | None = Field(default=None, gt=0)
    porcentaje: Decimal | None = Field(default=None, max_digits=12, decimal_places=6)
    periodo_referencia: date | None = None
    confirmar_historico: StrictBool = False


def _quick_edit_year(value: int) -> int:
    if value < 2000 or value > 2200:
        raise HTTPException(status_code=400, detail="anio debe estar entre 2000 y 2200")
    return value


@erp_cash_proyectado_router.get("/quick-edit/values")
def get_erp_cash_projection_quick_edit(
    cuenta_cash_id: int = Query(..., gt=0),
    anio: int | None = Query(default=None),
    session: Session = Depends(get_session),
):
    try:
        return get_projection_quick_edit(
            session,
            cuenta_cash_id,
            _quick_edit_year(anio) if anio is not None else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_proyectado_router.put("/quick-edit/values")
def update_erp_cash_projection_quick_edit(
    payload: ProjectionQuickEditPayload,
    cuenta_cash_id: int = Query(..., gt=0),
    anio: int | None = Query(default=None),
    session: Session = Depends(get_session),
):
    values = {item.periodo: item.importe_proyectado for item in payload.values}
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
            _quick_edit_year(anio) if anio is not None else None,
            values,
            payload.metodo_proyeccion_id,
            committed_values,
            pending_values,
            {item.periodo: item.origen_proyectado for item in payload.values},
            {"cuenta_cash_referencia_id": payload.cuenta_cash_referencia_id, "porcentaje": payload.porcentaje}
            if {"cuenta_cash_referencia_id", "porcentaje"} & payload.model_fields_set else None,
            reference_from=payload.periodo_referencia,
            historical_confirmed=payload.confirmar_historico,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_proyectado_router.post("/quick-edit/calculate")
def calculate_erp_cash_projection_quick_edit(
    cuenta_cash_id: int = Query(..., gt=0),
    anio: int | None = Query(default=None),
    metodo_proyeccion_id: int | None = Query(default=None, gt=0),
    periodo_desde: date | None = Query(default=None),
    periodo_hasta: date | None = Query(default=None),
    cuenta_cash_referencia_id: int | None = Query(default=None, gt=0),
    porcentaje: Decimal | None = Query(default=None, max_digits=12, decimal_places=6),
    session: Session = Depends(get_session),
    payload: ProjectionQuickEditPayload | None = None,
):
    preview = {item.periodo: (item.importe_proyectado, item.origen_proyectado) for item in payload.values} if payload else None
    if payload and len(preview) != len(payload.values):
        raise HTTPException(status_code=400, detail="Hay períodos duplicados")
    try:
        return calculate_projection_quick_edit(
            session,
            cuenta_cash_id,
            _quick_edit_year(anio) if anio is not None else None,
            metodo_proyeccion_id,
            periodo_desde,
            periodo_hasta,
            {"cuenta_cash_referencia_id": cuenta_cash_referencia_id, "porcentaje": porcentaje}
            if cuenta_cash_referencia_id is not None or porcentaje is not None else None,
            preview_values=preview,
            reference_from=payload.periodo_referencia if payload else None,
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
