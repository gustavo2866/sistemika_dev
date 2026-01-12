from app.core.router import create_generic_router
from app.models.adm import AdmConcepto
from app.crud.adm_concepto_crud import adm_concepto_crud

adm_concepto_router = create_generic_router(
    model=AdmConcepto,
    crud=adm_concepto_crud,
    prefix="/api/v1/adm/conceptos",
    tags=["adm-conceptos"],
)