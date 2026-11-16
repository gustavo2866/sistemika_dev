from sqlmodel import select

from app.core.generic_crud import GenericCRUD
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.metodo_proyeccion import MetodoProyeccion, MetodoProyeccionDetalle
from app.services.cash_projection_configuration import (
    lock_projection_configuration, validate_cash_dependencies, validate_method_rules,
)


class MetodoProyeccionCRUD(NestedCRUD):
    def _save(self, session, data, obj_id=None, check_version=True):
        lock_projection_configuration(session)
        payload = dict(data)
        payload.pop("cuentas", None)
        existing = self.get(session, obj_id) if obj_id is not None else None
        if obj_id is not None and existing is None:
            return None
        kind = existing.tipo_calculo if existing else "HISTORICO"
        if "tipo_calculo" in payload and payload["tipo_calculo"] != kind:
            if existing is None:
                raise ValueError("Los nuevos métodos deben ser Históricos; Pendientes y Relacional se crean mediante seeds")
            raise ValueError("El tipo de cálculo es de solo lectura y no puede modificarse")
        payload["tipo_calculo"] = kind
        rules = payload.get("detalles", list(existing.detalles) if existing else [])
        if kind != "HISTORICO" and "detalles" not in payload:
            rules = []
            payload["detalles"] = []
        validate_method_rules(kind, rules)
        nested = self._extract_nested_payloads(payload)
        try:
            if existing is None:
                obj = GenericCRUD.create(self, session, payload, auto_commit=False)
            else:
                obj = GenericCRUD.update(self, session, obj_id, payload, check_version=check_version, auto_commit=False)
            self._sync_nested_relations(session, obj, nested, is_create=existing is None)
            if kind != "RELACIONAL":
                for account in session.exec(select(ErpCashCuenta).where(ErpCashCuenta.id_metodo_proyeccion == obj.id)).all():
                    account.cuenta_cash_referencia_id = None
                    account.porcentaje = None
            session.flush()
            validate_cash_dependencies(session)
            session.commit()
            session.refresh(obj)
            return obj
        except Exception:
            session.rollback()
            raise

    def create(self, session, data):
        return self._save(session, data)

    def update(self, session, obj_id, data, check_version=True):
        return self._save(session, data, obj_id, check_version)


metodo_proyeccion_crud = MetodoProyeccionCRUD(MetodoProyeccion, nested_relations={
    "detalles": {"model": MetodoProyeccionDetalle, "fk_field": "id_metodo_proyeccion", "allow_delete": True},
})
metodo_proyeccion_router = create_generic_router(
    model=MetodoProyeccion, crud=metodo_proyeccion_crud,
    prefix="/metodos-proyeccion", tags=["metodos-proyeccion"],
)
