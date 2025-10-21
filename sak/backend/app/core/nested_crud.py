from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime, date
from decimal import Decimal
from typing import Any, Dict, Iterable, Mapping, Optional, Type, Union, get_args, get_origin

from sqlmodel import Session

from .generic_crud import GenericCRUD


class NestedCRUD(GenericCRUD):
    """CRUD que soporta sincronizar relaciones one-to-many embebidas en el payload."""

    def __init__(
        self,
        model: Type,
        nested_relations: Mapping[str, Mapping[str, Any]],
    ) -> None:
        """
        Args:
            model: Modelo principal.
            nested_relations: Configuración por relación. Requiere al menos:
                {
                    "detalles": {
                        "model": ParteDiarioDetalle,
                        "fk_field": "parte_diario_id",
                        "allow_delete": True,  # opcional (default True)
                    }
                }
        """
        super().__init__(model)
        self._nested_relations = nested_relations

    # ------------------------------------------------------------------ helpers
    def _extract_nested_payloads(self, data: Dict[str, Any]) -> Dict[str, Any]:
        nested_payloads: Dict[str, Any] = {}
        for relation in self._nested_relations.keys():
            if relation in data:
                nested_payloads[relation] = data.pop(relation)
        return nested_payloads

    def _filter_payload(self, model_cls: Type, payload: Dict[str, Any], exclude: Iterable[str] = ()) -> Dict[str, Any]:
        valid_fields = set(getattr(model_cls, "model_fields", {}).keys()) - set(exclude)
        return {k: v for k, v in payload.items() if k in valid_fields}

    def _coerce_for_model(self, model_cls: Type, field_name: str, value: Any) -> Any:
        if value is None:
            return None

        field_info = getattr(model_cls, "model_fields", {}).get(field_name)
        expected_type = getattr(field_info, "annotation", None) if field_info else None

        if expected_type is not None:
            origin = get_origin(expected_type)
            if origin is Union:
                args = [arg for arg in get_args(expected_type) if arg is not type(None)]
                if len(args) == 1:
                    expected_type = args[0]

        if isinstance(value, str) and value.strip() == "":
            if expected_type is not str:
                return None
            return value

        try:
            if expected_type is datetime:
                if isinstance(value, str):
                    s = value
                    if s.endswith("Z"):
                        s = s[:-1] + "+00:00"
                    try:
                        return datetime.fromisoformat(s)
                    except Exception:
                        try:
                            d = date.fromisoformat(s)
                            return datetime(d.year, d.month, d.day, tzinfo=UTC)
                        except Exception:
                            return value
                return value

            if expected_type is date:
                if isinstance(value, str):
                    try:
                        return date.fromisoformat(value)
                    except Exception:
                        return value
                return value

            if expected_type is Decimal:
                if isinstance(value, (int, float, str)):
                    try:
                        return Decimal(str(value))
                    except Exception:
                        return value
                return value

            if expected_type is int and isinstance(value, str) and value.isdigit():
                try:
                    return int(value)
                except Exception:
                    return value

            if expected_type is bool and isinstance(value, str):
                s = value.strip().lower()
                if s in ("true", "1", "yes", "on"):
                    return True
                if s in ("false", "0", "no", "off"):
                    return False

        except Exception:
            return value

        return value

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

            model_cls: Type = relation_cfg["model"]
            fk_field: str = relation_cfg["fk_field"]
            allow_delete: bool = relation_cfg.get("allow_delete", True)

            existing_items = list(getattr(obj, relation_name, []) or [])
            existing_by_id = {item.id: item for item in existing_items if getattr(item, "id", None) is not None}
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
                        filtered_payload[field] = self._coerce_for_model(model_cls, field, raw_value)
                    new_detail = model_cls(**filtered_payload)
                    session.add(new_detail)

            if not is_create and allow_delete:
                for existing_id, existing_obj in existing_by_id.items():
                    if existing_id not in seen_ids:
                        session.delete(existing_obj)

        session.commit()
        session.refresh(obj)

    # ------------------------------------------------------------------ overrides
    def create(self, session: Session, data: Dict[str, Any]):
        data_copy = dict(data)
        nested_payloads = self._extract_nested_payloads(data_copy)

        obj = super().create(session, data_copy)

        if nested_payloads:
            self._sync_nested_relations(session, obj, nested_payloads, is_create=True)

        return obj

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: Dict[str, Any],
        check_version: bool = True,
    ):
        data_copy = dict(data)
        nested_payloads = self._extract_nested_payloads(data_copy)

        obj = super().update(session, obj_id, data_copy, check_version=check_version)

        if obj and nested_payloads:
            self._sync_nested_relations(session, obj, nested_payloads, is_create=False)

        return obj

    def update_partial(self, session: Session, obj_id: Any, data: Dict[str, Any]):
        return self.update(session, obj_id, data, check_version=False)
