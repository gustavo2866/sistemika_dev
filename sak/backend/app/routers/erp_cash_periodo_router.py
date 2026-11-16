from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.services.cash_projection_configuration import lock_projection_configuration
from app.services.cash_projection_horizon import ensure_projection_horizon


class CashPeriodoCRUD(GenericCRUD):
    def _save(self, session, data, obj_id=None, check_version=True, auto_commit=True):
        lock_projection_configuration(session)
        existing = self.get(session, obj_id) if obj_id is not None else None
        if obj_id is not None and existing is None:
            return None
        previous_state = existing.estado if existing else None
        previous_month = existing.fecha_periodo if existing else None
        try:
            if obj_id is None:
                obj = super().create(session, data, auto_commit=False)
            else:
                obj = super().update(session, obj_id, data, check_version=check_version, auto_commit=False)
            session.flush()
            if obj.estado != previous_state or obj.fecha_periodo != previous_month:
                ensure_projection_horizon(session)
            if auto_commit:
                session.commit()
                session.refresh(obj)
            return obj
        except Exception:
            session.rollback()
            raise

    def create(self, session, data, auto_commit=True):
        return self._save(session, data, auto_commit=auto_commit)

    def update(self, session, obj_id, data, check_version=True, auto_commit=True):
        return self._save(session, data, obj_id, check_version, auto_commit)


erp_cash_periodo_crud = CashPeriodoCRUD(ErpCashPeriodo)
erp_cash_periodo_router = create_generic_router(
    model=ErpCashPeriodo,
    crud=erp_cash_periodo_crud,
    prefix="/erp/cash/periodos",
    tags=["erp-cash-periodos"],
)
