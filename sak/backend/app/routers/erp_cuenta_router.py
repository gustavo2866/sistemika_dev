from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cuenta import ErpCuenta

erp_cuenta_crud = GenericCRUD(ErpCuenta)
erp_cuenta_router = create_generic_router(
    model=ErpCuenta,
    crud=erp_cuenta_crud,
    prefix="/erp/cuentas",
    tags=["erp-cuentas"],
)
