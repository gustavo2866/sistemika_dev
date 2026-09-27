from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Any

from sqlmodel import Session, select

from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_diario_sync import normalize_rubro
from app.models.erp.libro_diario_sync import parse_periodo


def build_week_ranges(anio: int, mes: int) -> list[dict[str, str]]:
    last_day = monthrange(anio, mes)[1]
    weeks: list[dict[str, str]] = []

    for start_day, end_day in ((1, 7), (8, 14), (15, 21), (22, last_day)):
        start = date(anio, mes, start_day)
        end = date(anio, mes, end_day)
        weeks.append(
            {
                "key": start.isoformat(),
                "label": f"{start.day:02d}-{end.day:02d}",
                "start": start.isoformat(),
                "end": end.isoformat(),
            }
        )

    return weeks


def _week_key(fecha: date, weeks: list[dict[str, str]]) -> str:
    for week in weeks:
        if date.fromisoformat(week["start"]) <= fecha <= date.fromisoformat(week["end"]):
            return week["key"]
    raise ValueError(f"La fecha {fecha.isoformat()} no pertenece al período solicitado")


def build_cash_diario_panel(
    rows: list[tuple[ErpCashDiario, str | None]],
    *,
    anio: int,
    mes: int,
) -> dict[str, Any]:
    weeks = build_week_ranges(anio, mes)
    week_keys = [week["key"] for week in weeks]
    groups: dict[str, dict[str, Any]] = {
        key: {
            "key": key,
            "label": label,
            "weeks": {week_key: Decimal("0") for week_key in week_keys},
            "total": Decimal("0"),
            "accounts": {},
        }
        for key, label in (
            ("INGRESOS", "INGRESOS"),
            ("EGRESOS", "EGRESOS"),
            ("SIN_CUENTA", "SIN CUENTA"),
        )
    }
    totals = {key: Decimal("0") for key in week_keys}

    for row, cuenta_cash_nombre in rows:
        if normalize_rubro(row.rubro).startswith("01-DISP"):
            continue

        importe = -(Decimal(str(row.debe or 0)) + Decimal(str(row.haber or 0)))
        group_key = "SIN_CUENTA" if row.cuenta_cash_id is None else ("INGRESOS" if importe >= 0 else "EGRESOS")
        group = groups[group_key]
        accounts = group["accounts"]
        account_name = cuenta_cash_nombre or "Sin cuenta Cash"
        account_key = (row.cuenta_cash_id, account_name)
        if account_key not in accounts:
            accounts[account_key] = {
                "cuenta_cash_id": row.cuenta_cash_id,
                "cuenta_cash_nombre": account_name,
                "weeks": {key: Decimal("0") for key in week_keys},
                "total": Decimal("0"),
                "movements": [],
            }

        week_key = _week_key(row.fecha, weeks)
        account = accounts[account_key]
        account["weeks"][week_key] += importe
        account["total"] += importe
        group["weeks"][week_key] += importe
        group["total"] += importe
        totals[week_key] += importe
        account["movements"].append(
            {
                "id": row.id,
                "empresa_id": row.empresa_id,
                "fecha": row.fecha.isoformat(),
                "tipo_asiento": row.tipo_asiento,
                "nro_asiento": row.nro_asiento,
                "cuenta_codigo": row.cuenta_codigo,
                "tipo_subcuenta": row.tipo_subcuenta,
                "nro_subcuenta": row.nro_subcuenta,
                "week_key": week_key,
                "importe": float(importe),
                "descripcion": row.descripcion,
            }
        )

    group_rows: list[dict[str, Any]] = []
    for group in groups.values():
        account_rows = sorted(
            group["accounts"].values(),
            key=lambda item: (item["cuenta_cash_id"] is None, item["cuenta_cash_nombre"].upper()),
        )
        for account in account_rows:
            account["weeks"] = {key: float(value) for key, value in account["weeks"].items()}
            account["total"] = float(account["total"])
            account["movements"].sort(key=lambda item: (item["fecha"], item["id"]))
        group["accounts"] = account_rows
        group["weeks"] = {key: float(value) for key, value in group["weeks"].items()}
        group["total"] = float(group["total"])
        group_rows.append(group)

    return {
        "periodo": f"{anio:04d}-{mes:02d}",
        "weeks": weeks,
        "groups": group_rows,
        "totals": {key: float(value) for key, value in totals.items()},
        "total": float(sum(totals.values(), Decimal("0"))),
    }


def get_cash_diario_panel(session: Session, periodo: str) -> dict[str, Any]:
    anio, mes = parse_periodo(periodo)
    rows = session.exec(
        select(ErpCashDiario, ErpCashCuenta.descripcion)
        .join(ErpCashCuenta, ErpCashCuenta.id == ErpCashDiario.cuenta_cash_id, isouter=True)
        .where(
            ErpCashDiario.periodo_anio == anio,
            ErpCashDiario.periodo_mes == mes,
            ErpCashDiario.deleted_at.is_(None),
        )
        .order_by(ErpCashDiario.fecha, ErpCashDiario.id)
    ).all()
    return build_cash_diario_panel(list(rows), anio=anio, mes=mes)
