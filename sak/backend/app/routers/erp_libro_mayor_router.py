from datetime import date

from fastapi import Body, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.erp.cash_diario_sync import get_fondo_mappings_by_cuenta
from app.models.erp.libro_mayor import ErpLibroMayor, get_libro_mayor_saldos
from app.models.erp.libro_mayor_sync import (
    sync_libro_mayor_periodo,
    sync_libro_mayor_rango,
)
from app.services.erp_libro_mayor_index_service import (
    update_libro_mayor_totals_by_icc,
)
from app.services.erp_libro_mayor_panel_service import get_libro_mayor_reales_panel


erp_libro_mayor_crud = GenericCRUD(ErpLibroMayor)

erp_libro_mayor_router = create_generic_router(
    model=ErpLibroMayor,
    crud=erp_libro_mayor_crud,
    prefix="/erp/libro-mayor",
    tags=["erp-libro-mayor"],
)


@erp_libro_mayor_router.post("/sync")
def sync_erp_libro_mayor(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    periodo = payload.get("periodo")
    if not periodo:
        raise HTTPException(status_code=400, detail="periodo es requerido (YYYY-MM o YYYYMM)")

    try:
        return sync_libro_mayor_periodo(session, str(periodo))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@erp_libro_mayor_router.post("/sync-range")
def sync_erp_libro_mayor_range(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    periodo_desde = payload.get("periodo_desde")
    periodo_hasta = payload.get("periodo_hasta")
    if not periodo_desde or not periodo_hasta:
        raise HTTPException(
            status_code=400,
            detail="periodo_desde y periodo_hasta son requeridos (YYYY-MM o YYYYMM)",
        )

    try:
        return sync_libro_mayor_rango(
            session,
            str(periodo_desde),
            str(periodo_hasta),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@erp_libro_mayor_router.post("/update-icc")
def update_erp_libro_mayor_by_icc(
    periodo_destino: date | None = Query(
        default=None,
        description=(
            "Mes destino; por defecto se utiliza el mes actual. "
            "Si no tiene ICC, se usa el último período anterior disponible"
        ),
    ),
    session: Session = Depends(get_session),
):
    try:
        return update_libro_mayor_totals_by_icc(
            session,
            periodo_destino=periodo_destino,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_libro_mayor_router.get("/panel")
def get_erp_libro_mayor_panel(
    anio_desde: int = Query(default=2024, ge=2024),
    anio_hasta: int | None = Query(default=None),
    estado: str | None = Query(default="02-ejecucion"),
    proyecto_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
):
    try:
        return get_libro_mayor_reales_panel(
            session,
            anio_desde=anio_desde,
            anio_hasta=anio_hasta,
            estado=estado,
            proyecto_id=proyecto_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
