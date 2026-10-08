from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date
from decimal import Decimal
from functools import lru_cache
from types import SimpleNamespace
from typing import Any

import psycopg
from sqlalchemy import Integer, cast, func
from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_diario_sync import get_fondo_mappings_by_cuenta
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_saldo import ErpCashSaldo
from app.models.erp.cuenta import ErpCuenta
from app.models.erp.libro_diario_sync import get_source_connection_kwargs, parse_periodo


logger = logging.getLogger(__name__)


def _shift_month(anio: int, mes: int, offset: int) -> tuple[int, int]:
    absolute_month = anio * 12 + (mes - 1) + offset
    shifted_year, shifted_month = divmod(absolute_month, 12)
    return shifted_year, shifted_month + 1


def build_month_ranges(anio: int, mes: int, count: int = 12) -> list[dict[str, str]]:
    months: list[dict[str, str]] = []
    for offset in range(count):
        month_year, month_number = _shift_month(anio, mes, offset)
        start = date(month_year, month_number, 1)
        end = date(month_year, month_number, monthrange(month_year, month_number)[1])
        months.append(
            {
                "key": f"{month_year:04d}-{month_number:02d}",
                "label": f"{month_number:02d}/{month_year:04d}",
                "start": start.isoformat(),
                "end": end.isoformat(),
            }
        )
    return months


def build_cash_balance_totals(
    rows: list[Any],
    months: list[dict[str, str]],
    ledger_accounts: dict[int, tuple[str, str]] | None = None,
) -> dict[str, Any]:
    month_keys = [month["key"] for month in months]
    valid_month_keys = set(month_keys)
    saldo_anterior = {key: Decimal("0") for key in month_keys}
    saldo_periodo = {key: Decimal("0") for key in month_keys}
    saldo_final = {key: Decimal("0") for key in month_keys}
    record_counts = {key: 0 for key in month_keys}
    accounts: dict[int, dict[str, Any]] = {}

    for row in rows:
        month_key = f"{row.periodo_anio:04d}-{row.periodo_mes:02d}"
        if month_key not in valid_month_keys:
            continue
        previous_value = Decimal(str(row.saldo_anterior or 0))
        movement_value = Decimal(str(row.saldo_periodo or 0))
        final_value = Decimal(str(row.saldo_acumulado or 0))
        record_count = int(getattr(row, "record_count", 1))
        cuenta_codigo = int(row.cuenta_codigo)

        saldo_anterior[month_key] += previous_value
        saldo_periodo[month_key] += movement_value
        saldo_final[month_key] += final_value
        record_counts[month_key] += record_count

        if cuenta_codigo not in accounts:
            extended_code, account_name = (ledger_accounts or {}).get(
                cuenta_codigo,
                (None, f"Cuenta {cuenta_codigo}"),
            )
            accounts[cuenta_codigo] = {
                "cuenta_codigo": cuenta_codigo,
                "cuenta_contable_codigo": extended_code,
                "cuenta_nombre": account_name,
                "saldo_anterior": {key: Decimal("0") for key in month_keys},
                "saldo_periodo": {key: Decimal("0") for key in month_keys},
                "saldo_final": {key: Decimal("0") for key in month_keys},
                "record_counts": {key: 0 for key in month_keys},
            }
        account = accounts[cuenta_codigo]
        account["saldo_anterior"][month_key] += previous_value
        account["saldo_periodo"][month_key] += movement_value
        account["saldo_final"][month_key] += final_value
        account["record_counts"][month_key] += record_count

    account_rows = []
    for account in sorted(accounts.values(), key=lambda item: item["cuenta_codigo"]):
        for field in ("saldo_anterior", "saldo_periodo", "saldo_final"):
            account[field] = {key: float(value) for key, value in account[field].items()}
        account_rows.append(account)

    return {
        "saldo_anterior": {key: float(value) for key, value in saldo_anterior.items()},
        "saldo_periodo": {key: float(value) for key, value in saldo_periodo.items()},
        "saldo_final": {key: float(value) for key, value in saldo_final.items()},
        "record_counts": record_counts,
        "accounts": account_rows,
        "projected_months": [],
    }


def apply_projected_balance_totals(
    panel: dict[str, Any],
    balances: dict[str, Any],
    period_states: dict[str, str],
    *,
    opening_balance: Decimal | float | int = Decimal("0"),
) -> dict[str, Any]:
    """Completa saldos de nivel 1 para periodos explicitamente abiertos."""

    groups = {group["key"]: group for group in panel["groups"]}
    ingresos = groups["INGRESOS"]["projected_months"]
    egresos = groups["EGRESOS"]["projected_months"]
    previous_final = Decimal(str(opening_balance or 0))
    projected_months: list[str] = []

    for month in panel["months"]:
        month_key = month["key"]
        if period_states.get(month_key) == "ABIERTO":
            movement = Decimal(str(ingresos.get(month_key, 0))) + Decimal(
                str(egresos.get(month_key, 0))
            )
            balances["saldo_anterior"][month_key] = float(previous_final)
            balances["saldo_periodo"][month_key] = float(movement)
            previous_final += movement
            balances["saldo_final"][month_key] = float(previous_final)
            projected_months.append(month_key)
        else:
            previous_final = Decimal(str(balances["saldo_final"].get(month_key, 0) or 0))

    balances["projected_months"] = projected_months
    return balances


def _month_key(fecha: date, month_keys: set[str]) -> str:
    key = f"{fecha.year:04d}-{fecha.month:02d}"
    if key not in month_keys:
        raise ValueError(f"La fecha {fecha.isoformat()} no pertenece al período solicitado")
    return key


def _group_key(cuenta_cash_id: int | None, cuenta_cash_tipo: str | None) -> str:
    if cuenta_cash_id is None:
        return "SIN_CUENTA"

    normalized_type = str(cuenta_cash_tipo or "").strip().upper()
    if normalized_type == "INGRESO":
        return "INGRESOS"
    if normalized_type == "EGRESO":
        return "EGRESOS"
    if normalized_type == "FONDO":
        return "FONDOS"
    return "SIN_CUENTA"


@lru_cache(maxsize=32)
def _get_source_ledger_accounts(
    account_codes: frozenset[int],
) -> dict[int, tuple[str, str]]:
    if not account_codes:
        return {}

    query = """
        SELECT DISTINCT ON (nro_cta)
            nro_cta,
            extendido,
            nombre
        FROM public.dim_cuenta
        WHERE nro_cta = ANY(%s)
        ORDER BY nro_cta
    """
    try:
        with psycopg.connect(**get_source_connection_kwargs()) as source_conn:
            with source_conn.cursor() as source_cur:
                source_cur.execute(query, (sorted(account_codes),))
                return {
                    int(nro_cuenta): (str(codigo or "").strip(), str(nombre or "").strip())
                    for nro_cuenta, codigo, nombre in source_cur.fetchall()
                    if nombre
                }
    except (psycopg.Error, RuntimeError) as exc:
        logger.warning("No se pudieron completar nombres contables desde dim_cuenta: %s", exc)
        return {}


def get_ledger_accounts(
    session: Session,
    account_codes: set[int],
) -> dict[int, tuple[str, str]]:
    if not account_codes:
        return {}

    accounts: dict[int, tuple[str, str]] = {}
    ledger_rows = session.exec(
        select(ErpCuenta.nro_cuenta, ErpCuenta.cod_cuenta, ErpCuenta.descripcion)
        .where(
            ErpCuenta.nro_cuenta.in_(account_codes),
            ErpCuenta.deleted_at.is_(None),
        )
        .order_by(ErpCuenta.id)
    ).all()
    for nro_cuenta, cod_cuenta, descripcion in ledger_rows:
        accounts.setdefault(nro_cuenta, (cod_cuenta, descripcion))

    missing_codes = account_codes - accounts.keys()
    for nro_cuenta, account_data in _get_source_ledger_accounts(frozenset(missing_codes)).items():
        accounts.setdefault(nro_cuenta, account_data)

    return accounts


def build_cash_panel(
    rows: list[tuple[Any, str | None, str | None, str | None, str | None]],
    *,
    anio: int,
    mes: int,
    projected_rows: list[Any] | None = None,
) -> dict[str, Any]:
    months = build_month_ranges(anio, mes)
    month_keys = [month["key"] for month in months]
    valid_month_keys = set(month_keys)
    groups: dict[str, dict[str, Any]] = {
        key: {
            "key": key,
            "label": label,
            "months": {month_key: Decimal("0") for month_key in month_keys},
            "total": Decimal("0"),
            "projected_months": {month_key: Decimal("0") for month_key in month_keys},
            "projected_total": Decimal("0"),
            "accounts": {},
        }
        for key, label in (
            ("INGRESOS", "INGRESOS"),
            ("EGRESOS", "EGRESOS"),
            ("SIN_CUENTA", "SIN CUENTA"),
            ("FONDOS", "FONDO"),
        )
    }
    totals = {key: Decimal("0") for key in month_keys}

    for row, cuenta_cash_nombre, cuenta_cash_tipo, cuenta_contable_codigo, cuenta_contable_nombre in rows:
        aggregated_importe = getattr(row, "importe", None)
        importe = (
            Decimal(str(aggregated_importe))
            if aggregated_importe is not None
            else -(Decimal(str(row.debe or 0)) + Decimal(str(row.haber or 0)))
        )
        movement_count = int(getattr(row, "movement_count", 1))
        group_key = _group_key(row.cuenta_cash_id, cuenta_cash_tipo)
        group = groups[group_key]
        accounts = group["accounts"]
        account_name = cuenta_cash_nombre or "Sin cuenta Cash"
        account_key = (row.cuenta_cash_id, account_name)
        if account_key not in accounts:
            accounts[account_key] = {
                "cuenta_cash_id": row.cuenta_cash_id,
                "cuenta_cash_nombre": account_name,
                "months": {key: Decimal("0") for key in month_keys},
                "total": Decimal("0"),
                "projected_months": {key: Decimal("0") for key in month_keys},
                "projected_total": Decimal("0"),
                "movement_count": 0,
                "ledger_accounts": {},
            }

        month_key = _month_key(row.fecha, valid_month_keys)
        account = accounts[account_key]
        ledger_accounts = account["ledger_accounts"]
        ledger_name = cuenta_contable_nombre or f"Cuenta {row.cuenta_codigo}"
        ledger_key = (row.cuenta_codigo, cuenta_contable_codigo, ledger_name)
        if ledger_key not in ledger_accounts:
            ledger_accounts[ledger_key] = {
                "cuenta_codigo": row.cuenta_codigo,
                "cuenta_contable_codigo": cuenta_contable_codigo,
                "cuenta_nombre": ledger_name,
                "months": {key: Decimal("0") for key in month_keys},
                "total": Decimal("0"),
                "movement_count": 0,
            }

        ledger_account = ledger_accounts[ledger_key]
        ledger_account["months"][month_key] += importe
        ledger_account["total"] += importe
        ledger_account["movement_count"] += movement_count
        account["months"][month_key] += importe
        account["total"] += importe
        group["months"][month_key] += importe
        group["total"] += importe
        totals[month_key] += importe
        account["movement_count"] += movement_count

    for row in projected_rows or []:
        group_key = _group_key(row.cuenta_cash_id, row.cuenta_cash_tipo)
        if group_key not in {"INGRESOS", "EGRESOS"}:
            continue

        group = groups[group_key]
        account_name = row.cuenta_cash_nombre or "Sin cuenta Cash"
        account_key = (row.cuenta_cash_id, account_name)
        if account_key not in group["accounts"]:
            group["accounts"][account_key] = {
                "cuenta_cash_id": row.cuenta_cash_id,
                "cuenta_cash_nombre": account_name,
                "months": {key: Decimal("0") for key in month_keys},
                "total": Decimal("0"),
                "projected_months": {key: Decimal("0") for key in month_keys},
                "projected_total": Decimal("0"),
                "movement_count": 0,
                "ledger_accounts": {},
            }

        month_key = _month_key(row.fecha_periodo, valid_month_keys)
        importe = Decimal(str(row.importe or 0))
        account = group["accounts"][account_key]
        account["projected_months"][month_key] += importe
        account["projected_total"] += importe
        group["projected_months"][month_key] += importe
        group["projected_total"] += importe

    group_rows: list[dict[str, Any]] = []
    for group in groups.values():
        account_rows = sorted(
            group["accounts"].values(),
            key=lambda item: (item["cuenta_cash_id"] is None, item["cuenta_cash_nombre"].upper()),
        )
        for account in account_rows:
            ledger_account_rows = sorted(
                account["ledger_accounts"].values(),
                key=lambda item: (item["cuenta_codigo"], item["cuenta_nombre"].upper()),
            )
            for ledger_account in ledger_account_rows:
                ledger_account["months"] = {
                    key: float(value) for key, value in ledger_account["months"].items()
                }
                ledger_account["total"] = float(ledger_account["total"])
            account["ledger_accounts"] = ledger_account_rows
            account["months"] = {key: float(value) for key, value in account["months"].items()}
            account["total"] = float(account["total"])
            account["projected_months"] = {
                key: float(value) for key, value in account["projected_months"].items()
            }
            account["projected_total"] = float(account["projected_total"])
        group["accounts"] = account_rows
        group["months"] = {key: float(value) for key, value in group["months"].items()}
        group["total"] = float(group["total"])
        group["projected_months"] = {
            key: float(value) for key, value in group["projected_months"].items()
        }
        group["projected_total"] = float(group["projected_total"])
        group_rows.append(group)

    return {
        "periodo": f"{anio:04d}-{mes:02d}",
        "months": months,
        "groups": group_rows,
        "totals": {key: float(value) for key, value in totals.items()},
        "total": float(sum(totals.values(), Decimal("0"))),
    }


def get_cash_panel(session: Session, periodo: str) -> dict[str, Any]:
    anio, mes = parse_periodo(periodo)
    months = build_month_ranges(anio, mes)
    start_date = date.fromisoformat(months[0]["start"])
    end_date = date.fromisoformat(months[-1]["end"])
    cash_rows = session.exec(
        select(
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
            ErpCashDiario.cuenta_cash_id,
            ErpCashDiario.cuenta_codigo,
            ErpCashCuenta.descripcion.label("cuenta_cash_nombre"),
            ErpCashCuenta.tipo.label("cuenta_cash_tipo"),
            func.sum(-(ErpCashDiario.debe + ErpCashDiario.haber)).label("importe"),
            func.count(ErpCashDiario.id).label("movement_count"),
        )
        .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashDiario.cuenta_cash_id, isouter=True)
        .where(
            ErpCashDiario.fecha >= start_date,
            ErpCashDiario.fecha <= end_date,
            ErpCashDiario.deleted_at.is_(None),
        )
        .group_by(
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
            ErpCashDiario.cuenta_cash_id,
            ErpCashDiario.cuenta_codigo,
            ErpCashCuenta.descripcion,
            ErpCashCuenta.tipo,
        )
        .order_by(
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
            ErpCashDiario.cuenta_cash_id,
            ErpCashDiario.cuenta_codigo,
        )
    ).all()
    projected_rows = session.exec(
        select(
            ErpCashProyectado.cuenta_cash_id,
            ErpCashProyectado.fecha_periodo,
            ErpCashCuenta.descripcion.label("cuenta_cash_nombre"),
            ErpCashCuenta.tipo.label("cuenta_cash_tipo"),
            func.sum(ErpCashProyectado.importe).label("importe"),
        )
        .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashProyectado.cuenta_cash_id)
        .where(
            ErpCashProyectado.fecha_periodo >= start_date,
            ErpCashProyectado.fecha_periodo <= end_date,
            ErpCashProyectado.tipo == "PROYECCION",
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashCuenta.deleted_at.is_(None),
        )
        .group_by(
            ErpCashProyectado.cuenta_cash_id,
            ErpCashProyectado.fecha_periodo,
            ErpCashCuenta.descripcion,
            ErpCashCuenta.tipo,
        )
        .order_by(
            ErpCashProyectado.fecha_periodo,
            ErpCashProyectado.cuenta_cash_id,
        )
    ).all()
    fondo_account_codes = set(get_fondo_mappings_by_cuenta(session))
    start_period = anio * 100 + mes
    end_year, end_month = _shift_month(anio, mes, 11)
    end_period = end_year * 100 + end_month
    balance_rows = []
    if fondo_account_codes:
        balance_period = (
            cast(ErpCashSaldo.periodo_anio, Integer) * 100
            + cast(ErpCashSaldo.periodo_mes, Integer)
        )
        balance_rows = session.exec(
            select(
                ErpCashSaldo.periodo_anio,
                ErpCashSaldo.periodo_mes,
                ErpCashSaldo.cuenta_codigo,
                func.sum(ErpCashSaldo.saldo_anterior).label("saldo_anterior"),
                func.sum(ErpCashSaldo.saldo_periodo).label("saldo_periodo"),
                func.sum(ErpCashSaldo.saldo_acumulado).label("saldo_acumulado"),
                func.count(ErpCashSaldo.id).label("record_count"),
            ).where(
                balance_period >= start_period,
                balance_period <= end_period,
                ErpCashSaldo.nivel == "subcuenta",
                ErpCashSaldo.cuenta_codigo.in_(fondo_account_codes),
                ErpCashSaldo.deleted_at.is_(None),
            ).group_by(
                ErpCashSaldo.periodo_anio,
                ErpCashSaldo.periodo_mes,
                ErpCashSaldo.cuenta_codigo,
            )
        ).all()
    account_codes = {int(row.cuenta_codigo) for row in cash_rows}
    account_codes.update(int(row.cuenta_codigo) for row in balance_rows)
    ledger_accounts_by_number = get_ledger_accounts(session, account_codes)

    rows = [
        (
            SimpleNamespace(
                fecha=date(row.periodo_anio, row.periodo_mes, 1),
                cuenta_cash_id=row.cuenta_cash_id,
                cuenta_codigo=row.cuenta_codigo,
                importe=row.importe,
                movement_count=row.movement_count,
            ),
            row.cuenta_cash_nombre,
            "Fondo" if row.cuenta_codigo in fondo_account_codes else row.cuenta_cash_tipo,
            *ledger_accounts_by_number.get(int(row.cuenta_codigo), (None, None)),
        )
        for row in cash_rows
    ]
    panel = build_cash_panel(
        rows,
        anio=anio,
        mes=mes,
        projected_rows=list(projected_rows),
    )
    balances = build_cash_balance_totals(
        balance_rows,
        months,
        ledger_accounts_by_number,
    )
    period_rows = session.exec(
        select(ErpCashPeriodo.fecha_periodo, ErpCashPeriodo.estado).where(
            ErpCashPeriodo.fecha_periodo >= start_date,
            ErpCashPeriodo.fecha_periodo <= end_date,
            ErpCashPeriodo.deleted_at.is_(None),
        )
    ).all()
    period_states = {
        f"{fecha_periodo.year:04d}-{fecha_periodo.month:02d}": str(estado).upper()
        for fecha_periodo, estado in period_rows
    }

    opening_balance = Decimal("0")
    if period_states.get(months[0]["key"]) == "ABIERTO":
        last_closed_period = session.exec(
            select(ErpCashPeriodo.fecha_periodo)
            .where(
                ErpCashPeriodo.fecha_periodo < start_date,
                ErpCashPeriodo.estado == "CERRADO",
                ErpCashPeriodo.deleted_at.is_(None),
            )
            .order_by(ErpCashPeriodo.fecha_periodo.desc())
        ).first()
        if last_closed_period is not None:
            closed_period = last_closed_period.year * 100 + last_closed_period.month
            if fondo_account_codes:
                saldo_period = (
                    cast(ErpCashSaldo.periodo_anio, Integer) * 100
                    + cast(ErpCashSaldo.periodo_mes, Integer)
                )
                opening_balance = Decimal(
                    str(
                        session.exec(
                            select(func.coalesce(func.sum(ErpCashSaldo.saldo_acumulado), 0)).where(
                                saldo_period == closed_period,
                                ErpCashSaldo.nivel == "subcuenta",
                                ErpCashSaldo.cuenta_codigo.in_(fondo_account_codes),
                                ErpCashSaldo.deleted_at.is_(None),
                            )
                        ).one()
                        or 0
                    )
                )

            previous_projection = session.exec(
                select(func.coalesce(func.sum(ErpCashProyectado.importe), 0))
                .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashProyectado.cuenta_cash_id)
                .where(
                    ErpCashProyectado.fecha_periodo > last_closed_period,
                    ErpCashProyectado.fecha_periodo < start_date,
                    ErpCashProyectado.tipo == "PROYECCION",
                    ErpCashProyectado.deleted_at.is_(None),
                    ErpCashCuenta.deleted_at.is_(None),
                    func.upper(ErpCashCuenta.tipo).in_(["INGRESO", "EGRESO"]),
                )
            ).one()
            opening_balance += Decimal(str(previous_projection or 0))

    panel["balances"] = apply_projected_balance_totals(
        panel,
        balances,
        period_states,
        opening_balance=opening_balance,
    )
    return panel


def get_cash_panel_detail(
    session: Session,
    periodo: str,
    *,
    group_key: str | None = None,
    filter_cash_account: bool = False,
    cuenta_cash_id: int | None = None,
    cuenta_codigo: int | None = None,
    importe_mode: str = "cash",
) -> dict[str, Any]:
    anio, mes = parse_periodo(periodo)
    if group_key is not None and group_key not in {"INGRESOS", "EGRESOS", "SIN_CUENTA", "FONDOS"}:
        raise ValueError("Grupo Cash inválido")

    if importe_mode not in {"cash", "saldo"}:
        raise ValueError("Modo de importe invalido")

    start_date = date(anio, mes, 1)
    end_date = date(anio, mes, monthrange(anio, mes)[1])
    statement = (
        select(ErpCashDiario, ErpCashCuenta.tipo)
        .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashDiario.cuenta_cash_id, isouter=True)
        .where(
            ErpCashDiario.fecha >= start_date,
            ErpCashDiario.fecha <= end_date,
            ErpCashDiario.deleted_at.is_(None),
        )
        .order_by(
            ErpCashDiario.fecha,
            ErpCashDiario.empresa_id,
            ErpCashDiario.tipo_asiento,
            ErpCashDiario.nro_asiento,
            ErpCashDiario.nro_renglon,
            ErpCashDiario.id,
        )
    )
    if filter_cash_account:
        if cuenta_cash_id is None:
            statement = statement.where(ErpCashDiario.cuenta_cash_id.is_(None))
        else:
            statement = statement.where(ErpCashDiario.cuenta_cash_id == cuenta_cash_id)
    if cuenta_codigo is not None:
        statement = statement.where(ErpCashDiario.cuenta_codigo == cuenta_codigo)

    fondo_account_codes = set(get_fondo_mappings_by_cuenta(session))
    movements: list[dict[str, Any]] = []
    total = Decimal("0")
    for row, cuenta_cash_tipo in session.exec(statement).all():
        effective_cash_tipo = (
            "Fondo" if row.cuenta_codigo in fondo_account_codes else cuenta_cash_tipo
        )
        if group_key is not None and _group_key(row.cuenta_cash_id, effective_cash_tipo) != group_key:
            continue

        debe = Decimal(str(row.debe or 0))
        haber = Decimal(str(row.haber or 0))
        signed_movement = debe + haber
        importe = signed_movement if importe_mode == "saldo" else -signed_movement
        total += importe
        movements.append(
            {
                "id": row.id,
                "empresa_id": row.empresa_id,
                "fecha": row.fecha.isoformat(),
                "tipo_asiento": row.tipo_asiento,
                "nro_asiento": row.nro_asiento,
                "nro_renglon": row.nro_renglon,
                "cuenta_codigo": row.cuenta_codigo,
                "tipo_subcuenta": row.tipo_subcuenta,
                "nro_subcuenta": row.nro_subcuenta,
                "descripcion": row.descripcion,
                "debe": float(debe),
                "haber": float(haber),
                "importe": float(importe),
            }
        )

    return {
        "periodo": f"{anio:04d}-{mes:02d}",
        "movement_count": len(movements),
        "movements": movements,
        "total": float(total),
    }


# Compatibilidad para integraciones internas que todavía importan los nombres anteriores.
build_cash_diario_panel = build_cash_panel
get_cash_diario_panel = get_cash_panel
