from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_periodo import ErpCashPeriodo


erp_cash_periodo_crud = GenericCRUD(ErpCashPeriodo)
erp_cash_periodo_router = create_generic_router(
    model=ErpCashPeriodo,
    crud=erp_cash_periodo_crud,
    prefix="/erp/cash/periodos",
    tags=["erp-cash-periodos"],
)
