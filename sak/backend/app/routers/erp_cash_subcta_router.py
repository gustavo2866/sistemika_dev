from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.erp.cash_subcta import ErpCashSubcta


class CashSubctaCRUD(GenericCRUD):
    def _validated_payload(self, data, existing=None):
        payload = dict(data)
        categoria = payload.get("categoria", existing.categoria if existing else None)
        categoria = str(categoria or "").strip() or None
        estado = payload.get("estado", existing.estado if existing else "error")
        if "estado" not in payload and categoria and (existing is None or existing.estado == "error"):
            estado = "activa"
        if estado not in {"activa", "error", "bloqueada"}:
            raise ValueError("Estado inválido: usar activa, error o bloqueada")
        if categoria and categoria.casefold() == "error":
            raise ValueError("ERROR es un estado, no una categoría")
        if estado == "activa" and not categoria:
            raise ValueError("Una subcuenta activa requiere categoría")
        payload.update(estado=estado, categoria=categoria)
        return payload

    def create(self, session, data, auto_commit=True):
        return super().create(session, self._validated_payload(data), auto_commit=auto_commit)

    def update(self, session, obj_id, data, check_version=True, auto_commit=True):
        existing = self.get(session, obj_id)
        if existing is None:
            return None
        return super().update(session, obj_id, self._validated_payload(data, existing),
                              check_version=check_version, auto_commit=auto_commit)


erp_cash_subcta_crud = CashSubctaCRUD(ErpCashSubcta)
erp_cash_subcta_router = create_generic_router(
    model=ErpCashSubcta,
    crud=erp_cash_subcta_crud,
    prefix="/erp/cash/subctas",
    tags=["erp-cash-subctas"],
)
