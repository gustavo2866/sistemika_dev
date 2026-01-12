from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, Dict, Mapping
from sqlmodel import Session

from app.core.nested_crud import NestedCRUD
from app.models.compras import PoFactura
from app.services.po_factura_totales import recalculate_po_factura_totales


class PoFacturaCRUD(NestedCRUD):
    def __init__(
        self,
        model: type[PoFactura],
        nested_relations: Mapping[str, Mapping[str, Any]],
    ) -> None:
        super().__init__(model, nested_relations)

    def _extract_nested_payloads(self, data: Dict[str, Any]) -> Dict[str, Any]:
        nested_payloads = super()._extract_nested_payloads(data)
        if "totales" not in nested_payloads:
            return nested_payloads

        filtered: list[dict[str, Any]] = []
        for item in nested_payloads.get("totales") or []:
            if not isinstance(item, dict):
                continue
            if item.get("tipo") == "subtotal":
                continue
            item["tipo"] = "impuesto"
            filtered.append(item)

        nested_payloads["totales"] = filtered
        return nested_payloads

    def _sync_nested_relations(
        self,
        session: Session,
        obj: Any,
        nested_payloads: Dict[str, Any],
        *,
        is_create: bool = False,
    ) -> None:
        for relation_name, items in nested_payloads.items():
            if items is None:
                continue

            relation_cfg = self._nested_relations.get(relation_name)
            if not relation_cfg:
                continue

            model_cls = relation_cfg["model"]
            fk_field: str = relation_cfg["fk_field"]
            allow_delete: bool = relation_cfg.get("allow_delete", True)

            existing_items = list(getattr(obj, relation_name, []) or [])
            if relation_name == "totales":
                existing_items = [
                    item for item in existing_items if getattr(item, "tipo", None) != "subtotal"
                ]
            existing_by_id = {
                item.id: item for item in existing_items if getattr(item, "id", None) is not None
            }
            seen_ids: set[int] = set()

            for item_payload in items:
                if not isinstance(item_payload, dict):
                    continue

                payload = deepcopy(item_payload)
                item_id = payload.get("id")

                filtered_payload = self._filter_payload(model_cls, payload, exclude=(fk_field,))

                if item_id and item_id in existing_by_id:
                    detail_obj = existing_by_id[item_id]
                    for field, raw_value in filtered_payload.items():
                        coerced_value = self._coerce_for_model(model_cls, field, raw_value)
                        setattr(detail_obj, field, coerced_value)
                    if hasattr(detail_obj, "updated_at"):
                        setattr(detail_obj, "updated_at", datetime.now(UTC))
                    seen_ids.add(item_id)
                else:
                    filtered_payload[fk_field] = obj.id
                    for field, raw_value in list(filtered_payload.items()):
                        filtered_payload[field] = self._coerce_for_model(
                            model_cls, field, raw_value
                        )
                    new_detail = model_cls(**filtered_payload)
                    session.add(new_detail)

            if not is_create and allow_delete:
                for existing_id, existing_obj in existing_by_id.items():
                    if existing_id not in seen_ids:
                        session.delete(existing_obj)

        session.commit()
        session.refresh(obj)

    def create(self, session: Session, data: Dict[str, Any]):
        obj = super().create(session, data)
        recalculate_po_factura_totales(session, obj.id)
        return obj

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: Dict[str, Any],
        check_version: bool = True,
    ):
        obj = super().update(session, obj_id, data, check_version=check_version)
        if obj:
            recalculate_po_factura_totales(session, obj.id)
        return obj

    def update_partial(self, session: Session, obj_id: Any, data: Dict[str, Any]):
        return self.update(session, obj_id, data, check_version=False)
