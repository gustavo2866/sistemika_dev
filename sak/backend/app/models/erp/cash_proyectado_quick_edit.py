from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.base import current_utc_time
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.metodo_proyeccion import MetodoProyeccion
from app.services.cash_projection_service import project_cash_account_range


QUICK_EDIT_TYPE = "PROYECCION"
QUICK_EDIT_PENDING_TYPE = "pend"
QUICK_EDIT_COMMITTED_TYPE = "COMPROMETIDO"
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
    pending_rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.tipo == QUICK_EDIT_PENDING_TYPE,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    pending_amounts = {
        row.fecha_periodo: Decimal(row.importe or 0) for row in pending_rows
    }
    committed_rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.tipo == QUICK_EDIT_COMMITTED_TYPE,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    committed_by_month = {row.fecha_periodo: row for row in committed_rows}
    real_rows = session.exec(
        select(
            ErpCashDiario.periodo_anio,
            ErpCashDiario.periodo_mes,
            func.sum(-(ErpCashDiario.debe + ErpCashDiario.haber)).label("importe"),
        )
        .where(
            ErpCashDiario.deleted_at.is_(None),
            ErpCashDiario.cuenta_cash_id == account_id,
            ErpCashDiario.fecha >= months[0],
            ErpCashDiario.fecha < projection_months(year + 2)[0],
        )
        .group_by(ErpCashDiario.periodo_anio, ErpCashDiario.periodo_mes)
    ).all()
    real_amounts = {
        date(int(period_year), int(period_month), 1): Decimal(str(amount or 0))
        for period_year, period_month, amount in real_rows
    }
    period_rows = session.exec(
        select(ErpCashPeriodo.fecha_periodo, ErpCashPeriodo.estado).where(
            ErpCashPeriodo.deleted_at.is_(None),
            ErpCashPeriodo.fecha_periodo >= months[0],
            ErpCashPeriodo.fecha_periodo <= months[-1],
        )
    ).all()
    period_statuses = {
        period_month: str(status).strip().upper()
        for period_month, status in period_rows
    }
    return {
        "cuenta_cash_id": account_id,
        "cuenta_cash_nombre": account.descripcion,
        "metodo_proyeccion_id": account.id_metodo_proyeccion,
        "anio": year,
        "tipo": QUICK_EDIT_TYPE,
        "values": [
            {
                "periodo": month.isoformat(),
                "importe": float(amounts.get(month, Decimal("0"))),
                "importe_real": (
                    float(real_amounts[month]) if month in real_amounts else None
                ),
                "estado_periodo": period_statuses.get(month, "ABIERTO"),
                "importe_pendiente": float(
                    pending_amounts.get(month, Decimal("0"))
                ),
                "importe_comprometido": float(
                    committed_by_month[month].importe
                    if month in committed_by_month
                    else Decimal("0")
                ),
                "descripcion": (
                    committed_by_month[month].observacion
                    if month in committed_by_month
                    else None
                ),
            }
            for month in months
        ],
    }


def calculate_projection_quick_edit(
    session: Session,
    account_id: int,
    year: int,
    projection_method_id: int | None = None,
    period_from: date | None = None,
    period_to: date | None = None,
) -> dict[str, object]:
    account = _editable_account(session, account_id)
    months = projection_months(year)
    if (period_from is None) != (period_to is None):
        raise ValueError("Debe indicar ambos limites del rango a calcular")
    calculation_from = period_from or months[0]
    calculation_to = period_to or months[-1]
    if calculation_from.day != 1 or calculation_to.day != 1:
        raise ValueError("Los periodos a calcular deben comenzar el primer dia del mes")
    if calculation_from < months[0] or calculation_to > months[-1]:
        raise ValueError("El rango a calcular debe estar dentro de los 24 meses visibles")
    calculations = project_cash_account_range(
        session,
        cash_account_id=account_id,
        period_from=calculation_from,
        period_to=calculation_to,
        projection_method_id=projection_method_id,
    )
    return {
        "cuenta_cash_id": account_id,
        "cuenta_cash_nombre": account.descripcion,
        "metodo_proyeccion_id": (
            projection_method_id or account.id_metodo_proyeccion
        ),
        "anio": year,
        "periodo_desde": calculation_from.isoformat(),
        "periodo_hasta": calculation_to.isoformat(),
        "tipo": QUICK_EDIT_TYPE,
        "values": [
            {
                "periodo": calculation.target_month.isoformat(),
                "importe": float(calculation.projected_value),
                "parametros": {
                    "metodo_proyeccion_id": calculation.projection_method_id,
                    "metodo_proyeccion_nombre": calculation.projection_method_name,
                    "detalle_id": calculation.projection_detail_id,
                    "mes_base_desde": calculation.base_month_from,
                    "mes_base_hasta": calculation.base_month_to,
                    "funcion": calculation.function.value,
                    "factor": float(calculation.factor),
                    "cuentas_erp": list(calculation.erp_account_numbers),
                    "valor_base": float(calculation.base_value),
                    "valores_base": [
                        {
                            "periodo": base.month.isoformat(),
                            "estado_periodo": base.period_status,
                            "origen": base.source,
                            "valor": float(base.value),
                        }
                        for base in calculation.base_values
                    ],
                },
            }
            for calculation in calculations
        ],
    }


def save_projection_quick_edit(
    session: Session,
    account_id: int,
    year: int,
    values: dict[date, Decimal],
    projection_method_id: int | None = None,
    committed_values: dict[date, tuple[Decimal, str | None]] | None = None,
    pending_values: dict[date, Decimal] | None = None,
) -> dict[str, int | str | None]:
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
    existing_pending_rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.tipo == QUICK_EDIT_PENDING_TYPE,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    existing_pending_by_month = {
        row.fecha_periodo: row for row in existing_pending_rows
    }
    existing_committed_rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.tipo == QUICK_EDIT_COMMITTED_TYPE,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    existing_committed_by_month = {
        row.fecha_periodo: row for row in existing_committed_rows
    }
    period_rows = session.exec(
        select(ErpCashPeriodo.fecha_periodo, ErpCashPeriodo.estado).where(
            ErpCashPeriodo.deleted_at.is_(None),
            ErpCashPeriodo.fecha_periodo >= months[0],
            ErpCashPeriodo.fecha_periodo <= months[-1],
        )
    ).all()
    period_statuses = {
        period_month: str(status).strip().upper()
        for period_month, status in period_rows
    }
    created = updated = unchanged = 0
    pending_created = pending_updated = pending_unchanged = 0
    committed_created = committed_updated = committed_unchanged = 0
    committed_skipped_closed = 0
    now = current_utc_time()
    try:
        if projection_method_id is not None:
            method = session.exec(
                select(MetodoProyeccion).where(
                    MetodoProyeccion.id == projection_method_id,
                    MetodoProyeccion.activo.is_(True),
                    MetodoProyeccion.deleted_at.is_(None),
                )
            ).one_or_none()
            if method is None:
                raise ValueError("El metodo de proyeccion no existe o no esta activo")
            if account.id_metodo_proyeccion != projection_method_id:
                account.id_metodo_proyeccion = projection_method_id
                account.updated_at = now
                account.version = int(account.version or 0) + 1
                session.add(account)

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

            if pending_values is not None:
                raw_pending = pending_values[month]
                if not raw_pending.is_finite():
                    raise ValueError(
                        f"El importe pendiente de {month:%Y-%m} debe ser finito"
                    )
                pending_amount = raw_pending.quantize(Decimal("0.01"))
                pending = existing_pending_by_month.get(month)
                if pending is None:
                    if pending_amount == 0:
                        pending_unchanged += 1
                    else:
                        session.add(
                            ErpCashProyectado(
                                cuenta_cash_id=account_id,
                                fecha_periodo=month,
                                tipo=QUICK_EDIT_PENDING_TYPE,
                                importe=pending_amount,
                                observacion="EDICION RAPIDA PANEL CASH",
                            )
                        )
                        pending_created += 1
                elif Decimal(pending.importe or 0) != pending_amount:
                    pending.importe = pending_amount
                    pending.observacion = "EDICION RAPIDA PANEL CASH"
                    pending.updated_at = now
                    pending.version = int(pending.version or 0) + 1
                    session.add(pending)
                    pending_updated += 1
                else:
                    pending_unchanged += 1

            if committed_values is None:
                continue
            if period_statuses.get(month, "ABIERTO") == "CERRADO":
                committed_skipped_closed += 1
                continue

            raw_committed, raw_description = committed_values[month]
            if not raw_committed.is_finite():
                raise ValueError(
                    f"El importe comprometido de {month:%Y-%m} debe ser finito"
                )
            committed_amount = raw_committed.quantize(Decimal("0.01"))
            description = str(raw_description or "").strip() or None
            committed = existing_committed_by_month.get(month)
            if committed is None:
                if committed_amount == 0 and description is None:
                    committed_unchanged += 1
                    continue
                session.add(
                    ErpCashProyectado(
                        cuenta_cash_id=account_id,
                        fecha_periodo=month,
                        tipo=QUICK_EDIT_COMMITTED_TYPE,
                        importe=committed_amount,
                        observacion=description,
                    )
                )
                committed_created += 1
            elif (
                Decimal(committed.importe or 0) != committed_amount
                or committed.observacion != description
            ):
                committed.importe = committed_amount
                committed.observacion = description
                committed.updated_at = now
                committed.version = int(committed.version or 0) + 1
                session.add(committed)
                committed_updated += 1
            else:
                committed_unchanged += 1
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "cuenta_cash_id": account_id,
        "cuenta_cash_nombre": account.descripcion,
        "metodo_proyeccion_id": account.id_metodo_proyeccion,
        "anio": year,
        "created": created,
        "updated": updated,
        "unchanged": unchanged,
        "pending_created": pending_created,
        "pending_updated": pending_updated,
        "pending_unchanged": pending_unchanged,
        "committed_created": committed_created,
        "committed_updated": committed_updated,
        "committed_unchanged": committed_unchanged,
        "committed_skipped_closed": committed_skipped_closed,
    }
