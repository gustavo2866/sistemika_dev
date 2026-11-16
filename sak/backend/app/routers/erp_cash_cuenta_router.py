from fastapi import HTTPException
from sqlmodel import select

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.metodo_proyeccion import MetodoProyeccion
from app.services.cash_projection_configuration import lock_projection_configuration, validate_cash_dependencies


class CashCuentaCRUD(GenericCRUD):
    def delete(self, session, obj_id, hard=False):
        lock_projection_configuration(session)
        projection_id = session.exec(
            select(ErpCashProyectado.id)
            .where(ErpCashProyectado.cuenta_cash_id == obj_id)
            .limit(1)
        ).first()
        if projection_id is not None:
            raise HTTPException(
                status_code=409,
                detail="No se puede eliminar la cuenta Cash porque tiene registros en Cash proyectado.",
            )
        return super().delete(session, obj_id, hard=hard)

    def _save(self, session, data, obj_id=None, check_version=True, auto_commit=True):
        lock_projection_configuration(session)
        existing = self.get(session, obj_id) if obj_id is not None else None
        if obj_id is not None and existing is None:
            return None
        payload = dict(data)
        method_id = payload.get("id_metodo_proyeccion", existing.id_metodo_proyeccion if existing else None)
        method = session.get(MetodoProyeccion, int(method_id)) if method_id else None
        if method_id and (method is None or method.deleted_at is not None or not method.activo):
            raise ValueError("El método de proyección no existe o está inactivo")
        if method is None or method.tipo_calculo != "RELACIONAL":
            payload.update(cuenta_cash_referencia_id=None, porcentaje=None)
        try:
            if existing is None:
                obj = super().create(session, payload, auto_commit=False)
            else:
                obj = super().update(session, obj_id, payload, check_version=check_version, auto_commit=False)
            session.flush()
            validate_cash_dependencies(session)
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


erp_cash_cuenta_crud = CashCuentaCRUD(ErpCashCuenta)
erp_cash_cuenta_router = create_generic_router(
    model=ErpCashCuenta,
    crud=erp_cash_cuenta_crud,
    prefix="/erp/cash/cuentas",
    tags=["erp-cash-cuentas"],
)
