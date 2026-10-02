from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_map import ErpCashMap


erp_cash_map_crud = GenericCRUD(ErpCashMap)
erp_cash_map_router = create_generic_router(
    model=ErpCashMap,
    crud=erp_cash_map_crud,
    prefix="/erp/cash/maps",
    tags=["erp-cash-maps"],
)