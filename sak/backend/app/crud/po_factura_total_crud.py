from __future__ import annotations

from typing import Any, Dict, Optional

from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.models.compras import PoFacturaTotal
from app.services.po_factura_totales import recalculate_po_factura_totales


class PoFacturaTotalCRUD(GenericCRUD[PoFacturaTotal]):
    def create(self, session: Session, data: Dict[str, Any]) -> PoFacturaTotal:
        payload = dict(data)
        payload["tipo"] = "impuesto"
        obj = super().create(session, payload)
        recalculate_po_factura_totales(session, obj.factura_id)
        return obj

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: Dict[str, Any],
        check_version: bool = True,
    ) -> Optional[PoFacturaTotal]:
        payload = dict(data)
        payload["tipo"] = "impuesto"
        obj = super().update(session, obj_id, payload, check_version=check_version)
        if obj:
            recalculate_po_factura_totales(session, obj.factura_id)
        return obj

    def update_partial(self, session: Session, obj_id: Any, data: Dict[str, Any]):
        return self.update(session, obj_id, data, check_version=False)

    def delete(self, session: Session, obj_id: Any, hard: bool = False) -> bool:
        obj = self.get(session, obj_id)
        if not obj:
            return False
        factura_id = obj.factura_id
        ok = super().delete(session, obj_id, hard=hard)
        if ok:
            recalculate_po_factura_totales(session, factura_id)
        return ok


po_factura_total_crud = PoFacturaTotalCRUD(PoFacturaTotal)
