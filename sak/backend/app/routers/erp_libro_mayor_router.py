from fastapi import APIRouter, HTTPException, Query

from app.models.erp.libro_mayor import get_libro_mayor_saldos


erp_libro_mayor_router = APIRouter(
    prefix="/erp/libro-mayor",
    tags=["erp-libro-mayor"],
)


@erp_libro_mayor_router.get("/saldos")
def get_erp_libro_mayor_saldos(
    periodo: str = Query(..., description="Periodo en formato YYYY-MM o YYYYMM"),
    rubro: str = Query(..., min_length=1, description="Nombre o prefijo normalizado del rubro"),
):
    try:
        return get_libro_mayor_saldos(periodo, rubro)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
