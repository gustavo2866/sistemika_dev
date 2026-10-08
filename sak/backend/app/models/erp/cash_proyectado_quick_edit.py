from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlmodel import Session, select

from app.models.base import current_utc_time
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_proyectado import ErpCashProyectado


QUICK_EDIT_TYPE = "PROYECCION"
QUICK_EDIT_MONTHS = 24


def projection_months(year: int) -> tuple[date, ...]:
    start_index = year * 12
    return tuple(
        date((start_index + offset) // 12, (start_index + offset) % 12 + 1, 1)
        for offset in range(QUICK_EDIT_MONTHS)
    )


def _editable_account(session: Session, account_id: int) -> ErpCashCuenta:
    account = session.get(ErpCashCuenta, account_id)
    if account is None or account.deleted_at is not None:
        raise ValueError("La cuenta Cash no existe")
    account_type = str(account.tipo or "").strip().upper()
    if account_type not in {"INGRESO", "EGRESO"}:
        raise ValueError("Solo se pueden editar proyecciones de cuentas de Ingreso o Egreso")
    return account


def get_projection_quick_edit(
    session: Session,
    account_id: int,
    year: int,
) -> dict[str, object]:
    account = _editable_account(session, account_id)
    months = projection_months(year)
    rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.tipo == QUICK_EDIT_TYPE,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    amounts = {row.fecha_periodo: Decimal(row.importe or 0) for row in rows}
    return {
        "cuenta_cash_id": account_id,
        "cuenta_cash_nombre": account.descripcion,
        "anio": year,
        "tipo": QUICK_EDIT_TYPE,
        "values": [
            {"periodo": month.isoformat(), "importe": float(amounts.get(month, Decimal("0")))}
            for month in months
        ],
    }


def save_projection_quick_edit(
    session: Session,
    account_id: int,
    year: int,
    values: dict[date, Decimal],
) -> dict[str, int | str]:
    account = _editable_account(session, account_id)
    months = projection_months(year)
    expected = set(months)
    received = set(values)
    if received != expected:
        missing = sorted(expected - received)
        extra = sorted(received - expected)
        details: list[str] = []
        if missing:
            details.append("faltan " + ", ".join(month.strftime("%Y-%m") for month in missing))
        if extra:
            details.append("sobran " + ", ".join(month.strftime("%Y-%m") for month in extra))
        raise ValueError("Los períodos no corresponden a los 24 meses requeridos: " + "; ".join(details))

    existing_rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.tipo == QUICK_EDIT_TYPE,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    existing_by_month = {row.fecha_periodo: row for row in existing_rows}
    created = updated = unchanged = 0
    now = current_utc_time()
    try:
        for month in months:
            raw_amount = values[month]
            if not raw_amount.is_finite():
                raise ValueError(f"El importe de {month:%Y-%m} debe ser finito")
            amount = raw_amount.quantize(Decimal("0.01"))
            existing = existing_by_month.get(month)
            if existing is None:
                session.add(
                    ErpCashProyectado(
                        cuenta_cash_id=account_id,
                        fecha_periodo=month,
                        tipo=QUICK_EDIT_TYPE,
                        importe=amount,
                        observacion="EDICION RAPIDA PANEL CASH",
                    )
                )
                created += 1
            elif Decimal(existing.importe or 0) != amount:
                existing.importe = amount
                existing.observacion = "EDICION RAPIDA PANEL CASH"
                existing.updated_at = now
                existing.version = int(existing.version or 0) + 1
                session.add(existing)
                updated += 1
            else:
                unchanged += 1
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "cuenta_cash_id": account_id,
        "cuenta_cash_nombre": account.descripcion,
        "anio": year,
        "created": created,
        "updated": updated,
        "unchanged": unchanged,
    }
