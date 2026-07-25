from typing import Iterator

from fastapi import Body, HTTPException, Response

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.libro_diario_sync import parse_periodo, run_sync

erp_libro_diario_crud = GenericCRUD(ErpLibroDiario)
erp_libro_diario_router = create_generic_router(
    model=ErpLibroDiario,
    crud=erp_libro_diario_crud,
    prefix="/erp/libro-diario",
    tags=["erp-libro-diario"],
)


@erp_libro_diario_router.post("/sync", status_code=204)
def sync_erp_libro_diario(payload: dict = Body(...)):
    periodo = payload.get("periodo")
    batch_size = int(payload.get("batch_size", 5000))
    dry_run = _parse_dry_run(payload.get("dry_run", False))

    if not periodo:
        raise HTTPException(status_code=400, detail="periodo es requerido (YYYY-MM o YYYYMM)")

    try:
        run_sync(periodo=str(periodo), batch_size=batch_size, dry_run=dry_run)
        return Response(status_code=204)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _parse_dry_run(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _iter_periods(periodo_desde: str, periodo_hasta: str) -> Iterator[str]:
    anio_desde, mes_desde = parse_periodo(periodo_desde)
    anio_hasta, mes_hasta = parse_periodo(periodo_hasta)

    start_idx = anio_desde * 12 + (mes_desde - 1)
    end_idx = anio_hasta * 12 + (mes_hasta - 1)
    if end_idx < start_idx:
        raise ValueError("periodo_hasta debe ser mayor o igual a periodo_desde")

    for month_idx in range(start_idx, end_idx + 1):
        anio = month_idx // 12
        mes = (month_idx % 12) + 1
        yield f"{anio:04d}{mes:02d}"


@erp_libro_diario_router.post("/sync-range", status_code=204)
def sync_erp_libro_diario_range(payload: dict = Body(...)):
    periodo_desde = payload.get("periodo_desde")
    periodo_hasta = payload.get("periodo_hasta")
    batch_size = int(payload.get("batch_size", 5000))
    dry_run = _parse_dry_run(payload.get("dry_run", False))

    if not periodo_desde or not periodo_hasta:
        raise HTTPException(
            status_code=400,
            detail="periodo_desde y periodo_hasta son requeridos (YYYY-MM o YYYYMM)",
        )

    try:
        periodos = list(_iter_periods(str(periodo_desde), str(periodo_hasta)))
        for periodo in periodos:
            run_sync(periodo=periodo, batch_size=batch_size, dry_run=dry_run)

        return Response(status_code=204)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
