from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.base import filtrar_respuesta
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


class DuplicateMetodoProyeccionPayload(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)

    @field_validator("nombre", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


@metodo_proyeccion_router.post("/{method_id}/duplicar", status_code=201)
def duplicate_metodo_proyeccion(
    method_id: int, payload: DuplicateMetodoProyeccionPayload,
    session: Session = Depends(get_session),
):
    lock_projection_configuration(session)
    source = session.exec(select(MetodoProyeccion).where(
        MetodoProyeccion.id == method_id, MetodoProyeccion.deleted_at.is_(None),
    ).with_for_update()).first()
    if source is None:
        raise HTTPException(status_code=404, detail="El método de proyección no existe")
    if source.tipo_calculo != "HISTORICO":
        raise HTTPException(status_code=400, detail="Los métodos Relacional y Pendiente no se pueden duplicar")
    if session.exec(select(MetodoProyeccion.id).where(
        func.lower(func.trim(MetodoProyeccion.nombre)) == payload.nombre.lower(),
    )).first() is not None:
        raise HTTPException(status_code=409, detail="Ya existe un método de proyección con ese nombre")
    try:
        copy = metodo_proyeccion_crud.create(session, {
            "nombre": payload.nombre, "descripcion": source.descripcion,
            "activo": source.activo, "tipo_calculo": "HISTORICO",
            "detalles": [{field: getattr(rule, field) for field in (
                "mes_destino", "mes_base_desde", "mes_base_hasta", "funcion", "factor",
            )} for rule in source.detalles if rule.deleted_at is None],
        })
        return filtrar_respuesta(metodo_proyeccion_crud.get(session, copy.id))
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un método de proyección con ese nombre") from None
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
