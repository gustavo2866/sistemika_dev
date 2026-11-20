"""Conciliación de Cash por empresa, mes y cuenta ERP de Fondo, sin modificar datos."""
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.libro_diario import ErpLibroDiario
from app.models.erp.cash_diario_sync import CASH_EMPRESA_IDS, _asiento_key
from app.services.cash_projection_horizon import shift_month
from app.services.erp_cash_mapping_service import get_fondo_mappings_by_cuenta


def reconcile_cash(session: Session, months: set[date]) -> dict:
    funds = set(get_fondo_mappings_by_cuenta(session))
    if not months or not funds:
        return {"consistente": None, "controles": 0, "diferencias": 0, "detalle": []}
    first, last = min(months), max(months)
    previous = shift_month(first, -1)
    balances = session.exec(select(
        ErpCashSaldo.empresa_id, ErpCashSaldo.periodo_anio, ErpCashSaldo.periodo_mes,
        ErpCashSaldo.cuenta_codigo, func.sum(ErpCashSaldo.saldo_anterior),
        func.sum(ErpCashSaldo.saldo_periodo), func.sum(ErpCashSaldo.saldo_acumulado),
        func.sum(ErpCashSaldo.total_debe + ErpCashSaldo.total_haber),
    ).where(
        ErpCashSaldo.deleted_at.is_(None), ErpCashSaldo.nivel == "subcuenta",
        ErpCashSaldo.cuenta_codigo.in_(funds),
        ErpCashSaldo.periodo_anio * 12 + ErpCashSaldo.periodo_mes >= previous.year * 12 + previous.month,
        ErpCashSaldo.periodo_anio * 12 + ErpCashSaldo.periodo_mes <= last.year * 12 + last.month,
    ).group_by(ErpCashSaldo.empresa_id, ErpCashSaldo.periodo_anio,
               ErpCashSaldo.periodo_mes, ErpCashSaldo.cuenta_codigo)).all()
    grouped_balances = {
        (company, date(year, month, 1), account): tuple(Decimal(v or 0) for v in values)
        for company, year, month, account, *values in balances
    }
    entries = session.exec(select(
        ErpCashDiario.empresa_id, ErpCashDiario.periodo_anio, ErpCashDiario.periodo_mes,
        ErpCashDiario.fecha, ErpCashDiario.tipo_asiento, ErpCashDiario.nro_asiento,
        ErpCashDiario.cuenta_codigo, func.sum(ErpCashDiario.debe + ErpCashDiario.haber),
    ).where(
        ErpCashDiario.deleted_at.is_(None),
        ErpCashDiario.periodo_anio * 12 + ErpCashDiario.periodo_mes >= first.year * 12 + first.month,
        ErpCashDiario.periodo_anio * 12 + ErpCashDiario.periodo_mes <= last.year * 12 + last.month,
    ).group_by(ErpCashDiario.empresa_id, ErpCashDiario.periodo_anio,
               ErpCashDiario.periodo_mes, ErpCashDiario.fecha,
               ErpCashDiario.tipo_asiento, ErpCashDiario.nro_asiento,
               ErpCashDiario.cuenta_codigo)).all()
    fund_movements = defaultdict(Decimal)
    entry_totals = defaultdict(Decimal)
    for company, year, month, day, kind, number, account, amount in entries:
        period = date(year, month, 1)
        if period not in months:
            continue
        entry_totals[(company, period, day, kind, number)] += Decimal(amount or 0)
        if account in funds:
            fund_movements[(company, period, account)] += Decimal(amount or 0)
    checks = differences = 0
    details = []

    def check(kind, company, period, actual, expected, **context):
        nonlocal checks, differences
        checks += 1
        if abs(actual - expected) > Decimal("0.01"):
            differences += 1
            if len(details) < 100:
                details.append({"control": kind, "empresa_id": company,
                    "periodo": period.strftime("%Y-%m"), "actual": str(actual),
                    "esperado": str(expected), "diferencia": str(actual - expected), **context})

    for (company, period, day, kind, number), total in entry_totals.items():
        check("asiento_balanceado", company, period, total, Decimal(0),
              fecha=day.isoformat(), tipo_asiento=kind, nro_asiento=number)
    # También detectar asientos enteros omitidos o pares de renglones que se
    # compensan: un diario incompleto puede seguir estando balanceado.
    source_rows = session.exec(select(
        ErpLibroDiario.source_id, ErpLibroDiario.empresa_id, ErpLibroDiario.fecha,
        ErpLibroDiario.tipo_asiento, ErpLibroDiario.nro_asiento, ErpLibroDiario.cuenta_codigo,
        ErpLibroDiario.periodo_anio, ErpLibroDiario.periodo_mes,
    ).where(
        ErpLibroDiario.deleted_at.is_(None), ErpLibroDiario.empresa_id.in_(CASH_EMPRESA_IDS),
        ErpLibroDiario.periodo_anio * 12 + ErpLibroDiario.periodo_mes >= first.year * 12 + first.month,
        ErpLibroDiario.periodo_anio * 12 + ErpLibroDiario.periodo_mes <= last.year * 12 + last.month,
    )).all()
    cash_entries = {_asiento_key(row) for row in source_rows if row.cuenta_codigo in funds}
    expected = defaultdict(set)
    for row in source_rows:
        period = date(row.periodo_anio, row.periodo_mes, 1)
        if period in months and _asiento_key(row) in cash_entries:
            expected[(row.empresa_id, period)].add(row.source_id)
    stored_ids = set(session.exec(select(ErpCashDiario.source_id).where(
        ErpCashDiario.deleted_at.is_(None),
        ErpCashDiario.periodo_anio * 12 + ErpCashDiario.periodo_mes >= first.year * 12 + first.month,
        ErpCashDiario.periodo_anio * 12 + ErpCashDiario.periodo_mes <= last.year * 12 + last.month,
    )).all())
    for (company, period), source_ids in expected.items():
        missing = source_ids - stored_ids
        check("renglones_origen_faltantes", company, period, Decimal(len(missing)), Decimal(0),
              source_ids=sorted(missing)[:20])
    keys = {key for key in grouped_balances if key[1] in months} | set(fund_movements)
    for key in sorted(keys):
        company, period, account = key
        opening, movement, closing, ledger_movement = grouped_balances.get(key, (Decimal(0),) * 4)
        check("saldo_anterior_mas_movimiento", company, period, closing, opening + movement,
              cuenta_codigo=account)
        check("movimiento_mayor", company, period, movement, ledger_movement, cuenta_codigo=account)
        check("movimiento_diario", company, period, fund_movements.get(key, Decimal(0)), movement,
              cuenta_codigo=account)
        previous_balance = grouped_balances.get((company, shift_month(period, -1), account))
        if previous_balance is not None:
            check("continuidad_saldos", company, period, opening, previous_balance[2], cuenta_codigo=account)
    return {"consistente": differences == 0 if checks else None,
            "controles": checks, "diferencias": differences, "detalle": details}
