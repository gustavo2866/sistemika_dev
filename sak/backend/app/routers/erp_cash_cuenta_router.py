from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_cuenta import ErpCashCuenta


erp_cash_cuenta_crud = GenericCRUD(ErpCashCuenta)
erp_cash_cuenta_router = create_generic_router(
    model=ErpCashCuenta,
    crud=erp_cash_cuenta_crud,
    prefix="/erp/cash/cuentas",
    tags=["erp-cash-cuentas"],
)