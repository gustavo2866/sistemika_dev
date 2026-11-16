from __future__ import annotations

from decimal import Decimal, InvalidOperation

from sqlmodel import Session, select

from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.cash_subcta import ErpCashSubcta
from app.services.erp_cash_mapping_service import (
    build_cash_mappings_by_key,
    get_fondo_mappings_by_cuenta,
    resolve_cash_account_id,
)


def _parse_int(value: object) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _parse_decimal(value: object) -> Decimal | None:
    text = str(value or "").strip().replace(" ", "")
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _subcuenta_key(row: ErpCashPendientesInput) -> tuple[int, int] | None:
    tipo = _parse_int(row.tipsub_raw)
    numero = _parse_int(row.nrosub_raw)
    if tipo is None or numero is None:
        return None
    return tipo, numero


def assign_cash_accounts_to_pendientes(
    session: Session,
    *,
    erp_empresa_id: int | None = None,
    overwrite: bool = False,
    auto_commit: bool = True,
) -> dict[str, int | bool | None]:
    statement = select(ErpCashPendientesInput).where(
        ErpCashPendientesInput.deleted_at.is_(None)
    )
    if erp_empresa_id is not None:
        statement = statement.where(
            ErpCashPendientesInput.erp_empresa_id == erp_empresa_id
        )
    if not overwrite:
        statement = statement.where(
            ErpCashPendientesInput.cuenta_cash_id.is_(None)
        )

    rows = session.exec(statement.order_by(ErpCashPendientesInput.id)).all()
    mappings_by_key = build_cash_mappings_by_key(session)
    fondo_mappings_by_cuenta = get_fondo_mappings_by_cuenta(session)
    subcuentas = session.exec(
        select(ErpCashSubcta)
        .where(ErpCashSubcta.deleted_at.is_(None))
        .order_by(ErpCashSubcta.id)
    ).all()
    categories_by_subcuenta: dict[tuple[int, int], str] = {}
    for subcuenta in subcuentas:
        categories_by_subcuenta.setdefault(
            (subcuenta.tpo_subcta, subcuenta.nro_subcta),
            subcuenta.categoria,
        )

    assigned = unchanged = unmapped = invalid = 0
    for row in rows:
        cuenta_codigo = _parse_int(row.nrocta_raw)
        saldo = _parse_decimal(row.saldo_raw)
        if cuenta_codigo is None or saldo is None:
            invalid += 1
            continue

        side = "debe" if saldo > 0 else "haber" if saldo < 0 else None
        cuenta_cash_id = resolve_cash_account_id(
            cuenta_codigo=cuenta_codigo,
            side=side,
            subcuenta_key=_subcuenta_key(row),
            mappings_by_key=mappings_by_key,
            fondo_mappings_by_cuenta=fondo_mappings_by_cuenta,
            categories_by_subcuenta=categories_by_subcuenta,
        )
        if cuenta_cash_id is None:
            unmapped += 1
            if overwrite and row.cuenta_cash_id is not None:
                row.cuenta_cash_id = None
                row.version = int(row.version or 0) + 1
                session.add(row)
            continue
        if row.cuenta_cash_id == cuenta_cash_id:
            unchanged += 1
            continue

        row.cuenta_cash_id = cuenta_cash_id
        row.version = int(row.version or 0) + 1
        session.add(row)
        assigned += 1

    try:
        if auto_commit:
            session.commit()
        else:
            session.flush()
    except Exception:
        session.rollback()
        raise

    return {
        "erp_empresa_id": erp_empresa_id,
        "overwrite": overwrite,
        "rows_processed": len(rows),
        "rows_assigned": assigned,
        "rows_unchanged": unchanged,
        "rows_unmapped": unmapped,
        "rows_invalid": invalid,
    }
