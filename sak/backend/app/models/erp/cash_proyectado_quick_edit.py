from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.base import current_utc_time
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_proyectado import ErpCashProyectado, clean_projection_observation, projection_method_values
from app.services.cash_projection_service import project_cash_account_range
from app.services.cash_projection_horizon import HISTORY_START, get_projection_horizon, month_range, shift_month


def _reference_start(reference_from: date | None, operational_start: date) -> date:
    if reference_from is None:
        return operational_start
    if reference_from.day != 1 or not HISTORY_START <= reference_from <= operational_start:
        raise ValueError("Período desde debe estar entre enero de 2026 y el primer período en cierre o abierto")
    return reference_from


def projection_months(session: Session) -> tuple[date, ...]:
    return get_projection_horizon(session).editor_months


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
    year: int | None = None,
) -> dict[str, object]:
    account = _editable_account(session, account_id)
    horizon = get_projection_horizon(session)
    months = horizon.editor_months
    rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    by_month = {row.fecha_periodo: row for row in rows}
    method_values = projection_method_values(session, account_id, require_active=False)
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
            ErpCashDiario.fecha < shift_month(months[-1], 1),
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
        "cuenta_cash_referencia_id": account.cuenta_cash_referencia_id,
        "porcentaje": float(account.porcentaje) if account.porcentaje is not None else None,
        "anio": horizon.start.year,
        "tipo_calculo": method_values["tipo_calculo"],
        **horizon.as_dict(),
        "primer_periodo_abierto": horizon.start.isoformat(),
        "values": [
            {
                "periodo": month.isoformat(),
                "importe_proyectado": float(by_month[month].importe_proyectado) if month in by_month else 0,
                "origen_proyectado": by_month[month].origen_proyectado if month in by_month else "CALCULADO",
                "importe_real": float(real_amounts[month]) if month in real_amounts else None,
                "estado_periodo": period_statuses.get(month, "ABIERTO"),
                "importe_pendiente": float(by_month[month].importe_pendiente) if month in by_month else 0,
                "importe_comprometido": float(by_month[month].importe_comprometido) if month in by_month else 0,
                "total_proyectado": float(by_month[month].total_proyectado) if month in by_month else 0,
                "id_metodo_proyeccion": by_month[month].id_metodo_proyeccion if month in by_month else method_values["id_metodo_proyeccion"],
                "tipo_calculo": by_month[month].tipo_calculo if month in by_month else method_values["tipo_calculo"],
                "descripcion": by_month[month].observacion if month in by_month else None,
            }
            for month in months
        ],
    }


def calculate_projection_quick_edit(
    session: Session,
    account_id: int,
    year: int | None = None,
    projection_method_id: int | None = None,
    period_from: date | None = None,
    period_to: date | None = None,
    relational_values: dict | None = None,
    preview_values: dict[date, tuple[Decimal, str]] | None = None,
    reference_from: date | None = None,
) -> dict[str, object]:
    account = _editable_account(session, account_id)
    horizon = get_projection_horizon(session)
    start = _reference_start(reference_from, horizon.start)
    if (period_from is None) != (period_to is None):
        raise ValueError("Debe indicar ambos limites del rango a calcular")
    calculation_from = period_from or start
    calculation_to = period_to or horizon.end
    if calculation_from.day != 1 or calculation_to.day != 1:
        raise ValueError("Los periodos a calcular deben comenzar el primer dia del mes")
    if calculation_from < start or calculation_to > horizon.end:
        raise ValueError("El rango a calcular debe estar dentro del horizonte de proyección")
    for month, (amount, origin) in (preview_values or {}).items():
        if month.day != 1 or not calculation_from <= month <= calculation_to:
            raise ValueError("Los valores de previsualización deben estar dentro del rango a calcular")
        if not amount.is_finite() or origin not in {"MANUAL", "CALCULADO"}:
            raise ValueError("El importe o el origen de la proyección no es válido")
    calculations = project_cash_account_range(
        session,
        cash_account_id=account_id,
        period_from=calculation_from,
        period_to=calculation_to,
        projection_method_id=projection_method_id,
        relational_values=relational_values,
        preview_values=preview_values,
        reference_from=start if start < horizon.start else None,
    )
    return {
        "cuenta_cash_id": account_id,
        "cuenta_cash_nombre": account.descripcion,
        "metodo_proyeccion_id": (
            projection_method_id or account.id_metodo_proyeccion
        ),
        "anio": horizon.start.year,
        **horizon.as_dict(),
        "periodo_desde": calculation_from.isoformat(),
        "periodo_hasta": calculation_to.isoformat(),
        "values": [
            {
                "periodo": calculation.target_month.isoformat(),
                "importe_proyectado": float(calculation.projected_value),
                "origen_proyectado": calculation.origen_proyectado,
                "parametros": {
                    "metodo_proyeccion_id": calculation.projection_method_id,
                    "metodo_proyeccion_nombre": calculation.projection_method_name,
                    "detalle_id": calculation.projection_detail_id,
                    "mes_base_desde": calculation.base_month_from,
                    "mes_base_hasta": calculation.base_month_to,
                    "funcion": calculation.function.value if calculation.function else None,
                    "factor": float(calculation.factor),
                    "tipo_calculo": calculation.tipo_calculo,
                    "cuenta_cash_referencia_id": calculation.cuenta_cash_referencia_id,
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
    year: int | None,
    values: dict[date, Decimal],
    projection_method_id: int | None = None,
    committed_values: dict[date, tuple[Decimal, str | None]] | None = None,
    pending_values: dict[date, Decimal] | None = None,
    projection_origins: dict[date, str] | None = None,
    relational_values: dict | None = None,
    reference_from: date | None = None,
    historical_confirmed: bool = False,
    calculate: bool = False,
) -> dict[str, int | str | None]:
    account = _editable_account(session, account_id)
    from app.services.cash_projection_configuration import lock_projection_configuration, validate_cash_dependencies
    lock_projection_configuration(session)
    horizon = get_projection_horizon(session)
    start = _reference_start(reference_from, horizon.start)
    historical_edit = start < horizon.start
    if historical_edit and not historical_confirmed:
        raise ValueError("Confirmar el guardado de cambios históricos")
    months = horizon.editor_months
    expected = set(month_range(start, horizon.end))
    received = set(values)
    if not expected.issubset(received) or not received.issubset(set(months)):
        missing = sorted(expected - received)
        extra = sorted(received - set(months))
        details: list[str] = []
        if missing:
            details.append("faltan " + ", ".join(month.strftime("%Y-%m") for month in missing))
        if extra:
            details.append("sobran " + ", ".join(month.strftime("%Y-%m") for month in extra))
        raise ValueError("Cambió el horizonte o faltan períodos de proyección; recargá el editor: " + "; ".join(details))

    existing_rows = session.exec(
        select(ErpCashProyectado).where(
            ErpCashProyectado.deleted_at.is_(None),
            ErpCashProyectado.cuenta_cash_id == account_id,
            ErpCashProyectado.fecha_periodo >= months[0],
            ErpCashProyectado.fecha_periodo <= months[-1],
        )
    ).all()
    existing_by_month = {row.fecha_periodo: row for row in existing_rows}
    period_statuses = dict(session.exec(
        select(ErpCashPeriodo.fecha_periodo, ErpCashPeriodo.estado).where(
            ErpCashPeriodo.deleted_at.is_(None),
            ErpCashPeriodo.fecha_periodo >= months[0],
            ErpCashPeriodo.fecha_periodo <= months[-1],
        )
    ).all())
    created = updated = unchanged = skipped_closed = 0
    changed_months: set[date] = set()
    calculated_count = 0
    now = current_utc_time()
    try:
        session.refresh(account)
        method_values = projection_method_values(session, account_id, projection_method_id)
        previous_configuration = (account.id_metodo_proyeccion, account.cuenta_cash_referencia_id, account.porcentaje)
        if projection_method_id is not None:
            account.id_metodo_proyeccion = projection_method_id
        if method_values["tipo_calculo"] == "RELACIONAL" and relational_values is not None:
            account.cuenta_cash_referencia_id = relational_values.get("cuenta_cash_referencia_id")
            account.porcentaje = relational_values.get("porcentaje")
        elif method_values["tipo_calculo"] != "RELACIONAL":
            account.cuenta_cash_referencia_id = None
            account.porcentaje = None
        with session.no_autoflush:
            validate_cash_dependencies(session)
        if previous_configuration != (account.id_metodo_proyeccion, account.cuenta_cash_referencia_id, account.porcentaje):
            account.updated_at = now
            account.version = int(account.version or 0) + 1
            session.add(account)

        for month in months:
            if month < start or (period_statuses.get(month) == "CERRADO" and not historical_edit):
                skipped_closed += 1
                continue
            existing = existing_by_month.get(month)
            changes = {}
            if existing and clean_projection_observation(existing.observacion) != existing.observacion:
                changes["observacion"] = None
            for field, source in (
                ("importe_proyectado", values),
                ("importe_pendiente", pending_values),
            ):
                if field == "importe_pendiente" and (month < horizon.start or period_statuses.get(month) == "CERRADO"):
                    continue
                if source is not None:
                    amount = source[month]
                    if not amount.is_finite():
                        raise ValueError(f"El importe de {month:%Y-%m} debe ser finito")
                    changes[field] = amount.quantize(Decimal("0.01"))
            if committed_values is not None:
                amount, description = committed_values[month]
                if not amount.is_finite():
                    raise ValueError(f"El importe comprometido de {month:%Y-%m} debe ser finito")
                changes["importe_comprometido"] = amount.quantize(Decimal("0.01"))
                changes["observacion"] = clean_projection_observation(str(description or "").strip() or None)
            if existing is None or projection_method_id is not None:
                changes.update(method_values)
            if projection_origins is not None:
                origin = projection_origins[month]
                if origin not in {"MANUAL", "CALCULADO"}:
                    raise ValueError("El origen de la proyección no es válido")
                changes["origen_proyectado"] = origin
            elif existing is None:
                changes["origen_proyectado"] = "CALCULADO"
            elif existing.importe_proyectado != changes["importe_proyectado"]:
                changes["origen_proyectado"] = "MANUAL"
            if existing is None:
                existing_by_month[month] = ErpCashProyectado(cuenta_cash_id=account_id, fecha_periodo=month, **changes)
                session.add(existing_by_month[month])
                changed_months.add(month)
                created += 1
            elif any(getattr(existing, field) != value for field, value in changes.items()):
                for field, value in changes.items():
                    setattr(existing, field, value)
                existing.updated_at = now
                existing.version = int(existing.version or 0) + 1
                session.add(existing)
                changed_months.add(month)
                updated += 1
            else:
                unchanged += 1
        if calculate:
            # El motor debe leer la configuración y los valores recién guardados.
            # El guardado y el cálculo se confirman juntos, o se revierten juntos.
            session.flush()
            calculations = project_cash_account_range(
                session,
                cash_account_id=account_id,
                period_from=start,
                period_to=horizon.end,
                reference_from=start if historical_edit else None,
            )
            for calculation in calculations:
                month = calculation.target_month
                if period_statuses.get(month) == "CERRADO" and not historical_edit:
                    continue
                row = existing_by_month[month]
                if row.origen_proyectado != "CALCULADO":
                    continue
                calculated_count += 1
                amount = calculation.projected_value.quantize(Decimal("0.01"))
                if row.importe_proyectado != amount:
                    row.importe_proyectado = amount
                    if month not in changed_months:
                        row.updated_at = now
                        row.version = int(row.version or 0) + 1
                        updated += 1
                        unchanged -= 1
                    session.add(row)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "cuenta_cash_id": account_id,
        "cuenta_cash_nombre": account.descripcion,
        "metodo_proyeccion_id": account.id_metodo_proyeccion,
        "anio": horizon.start.year,
        **horizon.as_dict(),
        "created": created,
        "updated": updated,
        "unchanged": unchanged,
        "skipped_closed": skipped_closed,
        "calculated": calculated_count,
    }
