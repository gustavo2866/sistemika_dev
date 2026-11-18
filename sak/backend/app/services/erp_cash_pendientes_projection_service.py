from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation

from sqlmodel import Session, select

from app.models.base import current_utc_time
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado, projection_method_values
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.empresa import ErpEmpresa
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.services.cash_projection_horizon import get_projection_horizon
from app.services.erp_cash_mapping_service import get_blocked_subcuenta_keys


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _parse_date(value: object) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    for separator in ("/", "-"):
        parts = text.split(separator)
        if len(parts) != 3:
            continue
        try:
            if len(parts[0]) == 4:
                year, month, day = map(int, parts)
            else:
                day, month, year = map(int, parts)
            return date(year, month, day)
        except ValueError:
            continue
    return None


def _parse_decimal(value: object) -> Decimal | None:
    text = str(value or "").strip().replace(" ", "")
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        parsed = Decimal(text)
    except InvalidOperation:
        return None
    return parsed if parsed.is_finite() else None


def _parse_int(value: object) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def rebuild_pending_cash_projection(
    session: Session, *, period_from: date | None = None, period_to: date | None = None,
    auto_commit: bool = True,
) -> dict[str, object]:
    horizon = get_projection_horizon(session)
    last_closed_period = horizon.last_closed
    first_open_period = horizon.start

    inputs = session.exec(
        select(ErpCashPendientesInput)
        .where(ErpCashPendientesInput.deleted_at.is_(None))
        .order_by(ErpCashPendientesInput.id)
    ).all()

    closed_periods = set(session.exec(select(ErpCashPeriodo.fecha_periodo).where(
        ErpCashPeriodo.deleted_at.is_(None), ErpCashPeriodo.estado == "CERRADO",
    )).all())
    def included(period: date) -> bool:
        return period not in closed_periods and (period_from is None or period >= period_from) and (period_to is None or period <= period_to)

    totals: dict[tuple[int, date], Decimal] = defaultdict(Decimal)
    blocked_keys = get_blocked_subcuenta_keys(session)
    unmapped = invalid = rolled_to_first_open = blocked = 0
    for item in inputs:
        if (_parse_int(item.tipsub_raw), _parse_int(item.nrosub_raw)) in blocked_keys:
            blocked += 1
            continue
        if item.cuenta_cash_id is None:
            unmapped += 1
            continue

        due_date = _parse_date(item.fecvenc_raw)
        amount = _parse_decimal(item.saldo_raw)
        if not item.is_valid or due_date is None or amount is None:
            invalid += 1
            continue

        due_period = _month_start(due_date)
        effective_period = due_period
        if due_period < first_open_period:
            effective_period = first_open_period
            rolled_to_first_open += 1
        if effective_period is None:
            invalid += 1
            continue
        if included(effective_period):
            totals[(int(item.cuenta_cash_id), effective_period)] += amount

    nonzero_totals = {
        key: amount.quantize(Decimal("0.01"))
        for key, amount in totals.items()
        if amount != 0
    }

    rows = session.exec(select(ErpCashProyectado).where(ErpCashProyectado.deleted_at.is_(None))).all()
    existing = {(row.cuenta_cash_id, row.fecha_periodo): row for row in rows}
    reset_count = created = updated = 0
    now = current_utc_time()
    try:
        for key, row in existing.items():
            if not included(row.fecha_periodo):
                continue
            amount = nonzero_totals.get(key, Decimal("0"))
            if row.importe_pendiente != amount:
                if row.importe_pendiente != 0 and amount == 0:
                    reset_count += 1
                row.importe_pendiente = amount
                row.updated_at = now
                row.version += 1
                session.add(row)
                updated += 1
        methods = {}
        for (account_id, period), amount in sorted(nonzero_totals.items()):
            if (account_id, period) in existing:
                continue
            if account_id not in methods:
                methods[account_id] = projection_method_values(session, account_id)
            session.add(ErpCashProyectado(
                cuenta_cash_id=account_id,
                fecha_periodo=period,
                importe_pendiente=amount,
                origen_proyectado="CALCULADO",
                **methods[account_id],
            ))
            created += 1
        if auto_commit:
            session.commit()
        else:
            session.flush()
    except Exception:
        session.rollback()
        raise

    return {
        "ultimo_periodo_cerrado": (
            last_closed_period.isoformat() if last_closed_period is not None else None
        ),
        "primer_periodo_abierto": (
            first_open_period.isoformat() if first_open_period is not None else None
        ),
        "inputs_processed": len(inputs),
        "inputs_unmapped": unmapped,
        "inputs_invalid": invalid,
        "inputs_blocked": blocked,
        "inputs_rolled_to_first_open": rolled_to_first_open,
        "rows_reset": reset_count,
        "rows_updated": updated,
        "rows_created": created,
        "zero_groups_omitted": len(totals) - len(nonzero_totals),
    }


def get_pending_projection_detail(
    session: Session,
    *,
    cuenta_cash_id: int,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
) -> dict[str, object]:
    if fecha_desde is not None and fecha_hasta is not None and fecha_desde > fecha_hasta:
        raise ValueError("fecha_desde no puede ser posterior a fecha_hasta")

    cash_account = session.get(ErpCashCuenta, cuenta_cash_id)
    if cash_account is None or cash_account.deleted_at is not None:
        raise ValueError("La cuenta Cash no existe")

    candidates = session.exec(
        select(ErpCashPendientesInput)
        .where(
            ErpCashPendientesInput.deleted_at.is_(None),
            ErpCashPendientesInput.cuenta_cash_id == cuenta_cash_id,
        )
        .order_by(ErpCashPendientesInput.id)
    ).all()
    matched: list[tuple[date, Decimal, ErpCashPendientesInput]] = []
    blocked_keys = get_blocked_subcuenta_keys(session)
    for item in candidates:
        if (_parse_int(item.tipsub_raw), _parse_int(item.nrosub_raw)) in blocked_keys:
            continue
        due_date = _parse_date(item.fecvenc_raw)
        amount = _parse_decimal(item.saldo_raw)
        if (
            not item.is_valid
            or due_date is None
            or amount is None
            or (fecha_desde is not None and due_date < fecha_desde)
            or (fecha_hasta is not None and due_date > fecha_hasta)
        ):
            continue
        matched.append((due_date, amount, item))
    matched.sort(key=lambda entry: (entry[0], int(entry[2].id or 0)))

    company_ids = {item.erp_empresa_id for _, _, item in matched}
    companies = (
        session.exec(
            select(ErpEmpresa).where(
                ErpEmpresa.id.in_(company_ids),
                ErpEmpresa.deleted_at.is_(None),
            )
        ).all()
        if company_ids
        else []
    )
    companies_by_id = {company.id: company.empresa_nombre for company in companies}

    account_numbers = {
        number
        for _, _, item in matched
        if (number := _parse_int(item.nrocta_raw)) is not None
    }
    erp_accounts = (
        session.exec(
            select(ErpCuenta)
            .where(
                ErpCuenta.nro_cuenta.in_(account_numbers),
                ErpCuenta.deleted_at.is_(None),
            )
            .order_by(ErpCuenta.id)
        ).all()
        if account_numbers
        else []
    )
    erp_accounts_by_number: dict[int, ErpCuenta] = {}
    for account in erp_accounts:
        erp_accounts_by_number.setdefault(account.nro_cuenta, account)

    values = []
    total = Decimal("0")
    for due_date, amount, item in matched:
        total += amount
        raw_account_number = _parse_int(item.nrocta_raw)
        erp_account = (
            erp_accounts_by_number.get(raw_account_number)
            if raw_account_number is not None
            else None
        )
        values.append(
            {
                "id": item.id,
                "empresa": companies_by_id.get(item.erp_empresa_id),
                "tipcomp": item.tipcomp_raw,
                "nrocomp": item.nrocomp_raw,
                "nombre": item.nombre_raw,
                "nrocta": item.nrocta_raw,
                "cuenta_codigo": erp_account.cod_cuenta if erp_account else None,
                "cuenta_nombre": erp_account.descripcion if erp_account else None,
                "descripcion": item.descrip_raw,
                "tipsub": item.tipsub_raw,
                "nrosub": item.nrosub_raw,
                "subcuenta_nombre": item.subs_descrip_raw,
                "fecha_vencimiento": due_date.isoformat(),
                "saldo": str(amount),
            }
        )

    return {
        "cuenta_cash_id": cuenta_cash_id,
        "cuenta_cash_nombre": cash_account.descripcion,
        "fecha_desde": fecha_desde.isoformat() if fecha_desde else None,
        "fecha_hasta": fecha_hasta.isoformat() if fecha_hasta else None,
        "count": len(values),
        "importe_total": str(total.quantize(Decimal("0.01"))),
        "data": values,
    }
