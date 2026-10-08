from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_saldo import ErpCashSaldo


erp_cash_saldo_crud = GenericCRUD(ErpCashSaldo)
erp_cash_saldo_router = create_generic_router(
    model=ErpCashSaldo,
    crud=erp_cash_saldo_crud,
    prefix="/erp/cash/saldos",
    tags=["erp-cash-saldos"],
)