from typing import Sequence

from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_diario_panel import get_ledger_accounts
from app.models.erp.cash_map import ErpCashMap


class ErpCashMapCRUD(GenericCRUD[ErpCashMap]):
    def _populate_calculated(
        self,
        session: Session,
        objs: Sequence[ErpCashMap],
    ) -> None:
        super()._populate_calculated(session, objs)
        accounts = get_ledger_accounts(session, {obj.nro_cta for obj in objs})
        for obj in objs:
            account = accounts.get(obj.nro_cta)
            object.__setattr__(obj, "cuenta_nombre", account[1] if account else None)


erp_cash_map_crud = ErpCashMapCRUD(ErpCashMap)
erp_cash_map_router = create_generic_router(
    model=ErpCashMap,
    crud=erp_cash_map_crud,
    prefix="/erp/cash/maps",
    tags=["erp-cash-maps"],
)
