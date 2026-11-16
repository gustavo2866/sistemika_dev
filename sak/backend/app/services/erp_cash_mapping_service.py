from __future__ import annotations

from typing import Literal

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_map import ErpCashMap


def normalize_cash_category(value: object) -> str:
    return " ".join(str(value or "").strip().split()).casefold()


def build_cash_mappings_by_key(session: Session) -> dict[tuple[int, str], ErpCashMap]:
    mappings = session.exec(
        select(ErpCashMap)
        .where(ErpCashMap.deleted_at.is_(None))
        .order_by(ErpCashMap.id)
    ).all()
    mappings_by_key: dict[tuple[int, str], ErpCashMap] = {}
    for mapping in mappings:
        key = (mapping.nro_cta, normalize_cash_category(mapping.categoria))
        # Los duplicados conservan la resolución histórica: gana el menor ID.
        mappings_by_key.setdefault(key, mapping)
    return mappings_by_key


def get_fondo_mappings_by_cuenta(session: Session) -> dict[int, ErpCashMap]:
    mappings = session.exec(
        select(ErpCashMap)
        .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashMap.map_debe_id)
        .where(
            ErpCashMap.deleted_at.is_(None),
            ErpCashCuenta.deleted_at.is_(None),
            func.upper(func.trim(ErpCashCuenta.tipo)) == "FONDO",
        )
        .order_by(ErpCashMap.id)
    ).all()

    mappings_by_cuenta: dict[int, ErpCashMap] = {}
    for mapping in mappings:
        mappings_by_cuenta.setdefault(mapping.nro_cta, mapping)
    return mappings_by_cuenta


def resolve_cash_mapping(
    cuenta_codigo: int,
    subcuenta_key: tuple[int, int] | None,
    mappings_by_key: dict[tuple[int, str], ErpCashMap],
    categories_by_subcuenta: dict[tuple[int, int], str],
) -> ErpCashMap | None:
    if subcuenta_key is not None:
        categoria = normalize_cash_category(
            categories_by_subcuenta.get(subcuenta_key, "ERROR")
        )
        specific_mapping = mappings_by_key.get((cuenta_codigo, categoria))
        if specific_mapping is not None:
            return specific_mapping
    return mappings_by_key.get((cuenta_codigo, ""))


def resolve_cash_account_id(
    *,
    cuenta_codigo: int,
    side: Literal["debe", "haber"] | None,
    subcuenta_key: tuple[int, int] | None,
    mappings_by_key: dict[tuple[int, str], ErpCashMap],
    fondo_mappings_by_cuenta: dict[int, ErpCashMap],
    categories_by_subcuenta: dict[tuple[int, int], str],
) -> int | None:
    is_fondo = cuenta_codigo in fondo_mappings_by_cuenta
    mapping = (
        fondo_mappings_by_cuenta.get(cuenta_codigo)
        if is_fondo
        else resolve_cash_mapping(
            cuenta_codigo,
            subcuenta_key,
            mappings_by_key,
            categories_by_subcuenta,
        )
    )
    if mapping is None:
        return None
    if is_fondo or side == "debe":
        return mapping.map_debe_id
    if side == "haber":
        return mapping.map_haber_id
    return None
