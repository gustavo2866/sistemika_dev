from typing import Sequence

from fastapi import Depends, Response
from sqlalchemy import or_
from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.erp.cash_diario_panel import get_ledger_accounts
from app.models.erp.cash_map import ErpCashMap


class ErpCashMapCRUD(GenericCRUD[ErpCashMap]):
    def _apply_filters(self, stmt, filters):
        filters = dict(filters)
        cuenta_cash_id = filters.pop("cuenta_cash_id", None)
        stmt = super()._apply_filters(stmt, filters)
        if cuenta_cash_id is not None:
            stmt = stmt.where(or_(
                ErpCashMap.map_debe_id == int(cuenta_cash_id),
                ErpCashMap.map_haber_id == int(cuenta_cash_id),
            ))
        return stmt

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


@erp_cash_map_router.get("/categorias")
def list_cash_map_categories(response: Response, session: Session = Depends(get_session)):
    values = session.exec(
        select(ErpCashMap.categoria)
        .where(ErpCashMap.deleted_at.is_(None))
        .where(ErpCashMap.categoria.is_not(None))
        .distinct()
    ).all()
    categories = sorted({value.strip() for value in values if value and value.strip()}, key=str.casefold)
    response.headers["Content-Range"] = f"items 0-{max(len(categories) - 1, 0)}/{len(categories)}"
    return [{"id": category, "name": category} for category in categories]
