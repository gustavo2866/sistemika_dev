from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_subcta import ErpCashSubcta


erp_cash_subcta_crud = GenericCRUD(ErpCashSubcta)
erp_cash_subcta_router = create_generic_router(
    model=ErpCashSubcta,
    crud=erp_cash_subcta_crud,
    prefix="/erp/cash/subctas",
    tags=["erp-cash-subctas"],
)